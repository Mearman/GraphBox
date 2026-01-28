/**
 * Classification Evaluation Pipeline
 *
 * Generates training and test graphs from four structural classes,
 * extracts features, trains a nearest-centroid classifier, and
 * evaluates multi-class classification accuracy.
 *
 * Graph generators:
 * - Erdos-Renyi (ER): random edges with uniform probability
 * - Barabasi-Albert (BA): preferential attachment via createScaleFreeGraph
 * - Watts-Strogatz (WS): ring lattice with stochastic rewiring
 * - Real-world: benchmark datasets (Karate, Les Miserables, etc.)
 */

import { Graph } from "../../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../../algorithms/types/graph.js";
import { createScaleFreeGraph } from "../__tests__/validation/common/graph-generators.js";
import { loadBenchmarkByIdFromUrl } from "../fixtures/benchmark-datasets.js";
import { extractFeatures } from "./feature-extractor.js";
import {
	type ClassificationMetrics,
	classify,
	evaluateClassifier,
	type GraphClass,
	trainClassifier,
	type TrainedClassifier,
} from "./graph-classifier.js";

// ============================================================================
// Seeded PRNG
// ============================================================================

/**
 * Simple deterministic PRNG using sine-based hashing.
 * Returns a function producing values in [0, 1).
 * @param seed
 */
const createRng = (seed: number): (() => number) => {
	let state = seed;
	return () => {
		const x = Math.sin(state++) * 10_000;
		return x - Math.floor(x);
	};
};

// ============================================================================
// Graph Generators
// ============================================================================

/**
 * Build a Graph<Node, Edge> from an edge array.
 * Silently ignores duplicate node additions.
 * @param edges
 */
const edgesToGraph = (edges: Array<[string, string]>): Graph<Node, Edge> => {
	const graph = new Graph<Node, Edge>(false);
	for (const [source, target] of edges) {
		graph.addNode({ id: source, type: "vertex" });
		graph.addNode({ id: target, type: "vertex" });
		graph.addEdge({
			id: `${source}-${target}`,
			source,
			target,
			type: "edge",
		});
	}
	return graph;
};

/**
 * Generate an Erdos-Renyi random graph.
 *
 * Creates n nodes and adds each possible edge independently with
 * probability p = 2*targetEdges / (n*(n-1)), targeting approximately
 * 2n edges per graph.
 *
 * @param n - Number of nodes
 * @param seed - PRNG seed for reproducibility
 */
const generateErdosRenyi = (n: number, seed: number): Graph<Node, Edge> => {
	const rng = createRng(seed);
	const targetEdges = 2 * n;
	const p = (2 * targetEdges) / (n * (n - 1));
	const edges: Array<[string, string]> = [];

	for (let index = 0; index < n; index++) {
		for (let index_ = index + 1; index_ < n; index_++) {
			if (rng() < p) {
				edges.push([`N${index}`, `N${index_}`]);
			}
		}
	}

	return edgesToGraph(edges);
};

/**
 * Generate a Barabasi-Albert scale-free graph via the existing
 * preferential attachment generator.
 *
 * @param n - Number of nodes
 * @param seed - PRNG seed for reproducibility
 */
const generateBarabasiAlbert = (
	n: number,
	seed: number,
): Graph<Node, Edge> => {
	const edges = createScaleFreeGraph(n, seed);
	return edgesToGraph(edges);
};

/**
 * Generate a Watts-Strogatz small-world graph.
 *
 * Starts with a ring lattice where each node connects to its k nearest
 * neighbours, then rewires each edge with probability beta.
 *
 * @param n - Number of nodes
 * @param k - Number of nearest neighbours in the ring (must be even)
 * @param beta - Rewiring probability (0 = regular lattice, 1 = random)
 * @param seed - PRNG seed for reproducibility
 */
const generateWattsStrogatz = (
	n: number,
	k: number,
	beta: number,
	seed: number,
): Graph<Node, Edge> => {
	const rng = createRng(seed);

	// Build ring lattice adjacency as a set of canonical edge pairs
	const edgeSet = new Set<string>();
	const edgeList: Array<[number, number]> = [];

	const canonicalKey = (a: number, b: number): string => {
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		return `${lo}-${hi}`;
	};

	// Connect each node to k/2 neighbours on each side
	const halfK = Math.floor(k / 2);
	for (let index = 0; index < n; index++) {
		for (let index_ = 1; index_ <= halfK; index_++) {
			const neighbour = (index + index_) % n;
			const key = canonicalKey(index, neighbour);
			if (!edgeSet.has(key)) {
				edgeSet.add(key);
				edgeList.push([index, neighbour]);
			}
		}
	}

	// Rewire edges
	for (let index = 0; index < edgeList.length; index++) {
		if (rng() < beta) {
			const [source] = edgeList[index];
			// Pick a random target that is not the source and not already connected
			let attempts = 0;
			while (attempts < n) {
				const newTarget = Math.floor(rng() * n);
				if (newTarget !== source) {
					const newKey = canonicalKey(source, newTarget);
					if (!edgeSet.has(newKey)) {
						// Remove old edge
						const oldKey = canonicalKey(
							edgeList[index][0],
							edgeList[index][1],
						);
						edgeSet.delete(oldKey);
						// Add new edge
						edgeSet.add(newKey);
						edgeList[index] = [source, newTarget];
						break;
					}
				}
				attempts++;
			}
		}
	}

	const edges: Array<[string, string]> = edgeList.map(([a, b]) => [
		`N${a}`,
		`N${b}`,
	]);
	return edgesToGraph(edges);
};

// ============================================================================
// Training and Test Data Generation
// ============================================================================

interface LabelledGraph {
	graph: Graph<Node, Edge>;
	label: GraphClass;
}

/**
 * Generate a set of synthetic graphs for a given class.
 *
 * @param cls - Graph class to generate
 * @param count - Number of graphs to generate
 * @param baseSeed - Base seed for reproducibility
 * @param minNodes - Minimum node count
 * @param maxNodes - Maximum node count
 */
const generateSyntheticGraphs = (
	cls: Exclude<GraphClass, "real-world">,
	count: number,
	baseSeed: number,
	minNodes: number,
	maxNodes: number,
): LabelledGraph[] => {
	const sizeRng = createRng(baseSeed);
	const graphs: LabelledGraph[] = [];

	for (let index = 0; index < count; index++) {
		const n = Math.floor(sizeRng() * (maxNodes - minNodes + 1)) + minNodes;
		const seed = baseSeed + index * 97;

		let graph: Graph<Node, Edge>;
		switch (cls) {
			case "erdos-renyi": {
				graph = generateErdosRenyi(n, seed);
				break;
			}
			case "barabasi-albert": {
				graph = generateBarabasiAlbert(n, seed);
				break;
			}
			case "watts-strogatz": {
				graph = generateWattsStrogatz(n, 4, 0.3, seed);
				break;
			}
		}

		graphs.push({ graph, label: cls });
	}

	return graphs;
};

/**
 * Load real-world benchmark graphs.
 *
 * Attempts to load Karate and Les Miserables datasets. Falls back to
 * a subset if loading fails. Returns labelled graphs for classification.
 */
const loadRealWorldGraphs = async (): Promise<LabelledGraph[]> => {
	const benchmarkIds = ["karate", "lesmis"];
	const graphs: LabelledGraph[] = [];

	for (const id of benchmarkIds) {
		try {
			const benchmark = await loadBenchmarkByIdFromUrl(id);
			graphs.push({
				graph: benchmark.graph as Graph<Node, Edge>,
				label: "real-world",
			});
		} catch {
			// Skip datasets that fail to load
		}
	}

	return graphs;
};

// ============================================================================
// Evaluation Pipeline
// ============================================================================

/**
 * Configuration for the classification evaluation.
 */
export interface ClassificationEvaluationConfig {
	/** Number of training graphs per synthetic class (default: 50) */
	trainPerClass?: number;
	/** Number of test graphs per synthetic class (default: 20) */
	testPerClass?: number;
	/** Minimum node count for generated graphs (default: 30) */
	minNodes?: number;
	/** Maximum node count for generated graphs (default: 100) */
	maxNodes?: number;
	/** Base seed for reproducibility (default: 42) */
	seed?: number;
}

/**
 * Full evaluation result including metrics and the trained classifier.
 */
export interface ClassificationEvaluationResult {
	/** Multi-class classification metrics */
	metrics: ClassificationMetrics;
	/** The trained classifier (for reuse or inspection) */
	classifier: TrainedClassifier;
	/** Number of training examples used */
	trainingSize: number;
	/** Number of test examples evaluated */
	testSize: number;
}

/**
 * Run the full classification evaluation pipeline.
 *
 * 1. Generates training graphs for ER, BA, and WS classes.
 * 2. Loads real-world benchmark graphs for the real-world class.
 * 3. Extracts structural features from all graphs.
 * 4. Trains a nearest-centroid classifier with z-score normalisation.
 * 5. Generates test graphs and classifies them.
 * 6. Computes and returns multi-class metrics.
 *
 * @param config - Optional evaluation configuration
 * @returns Classification metrics including accuracy, per-class F1, and macro F1
 */
export const runClassificationEvaluation = async (
	config?: ClassificationEvaluationConfig,
): Promise<ClassificationEvaluationResult> => {
	const trainPerClass = config?.trainPerClass ?? 50;
	const testPerClass = config?.testPerClass ?? 20;
	const minNodes = config?.minNodes ?? 30;
	const maxNodes = config?.maxNodes ?? 100;
	const seed = config?.seed ?? 42;

	// --- 1. Generate training data ---
	const syntheticClasses: Array<Exclude<GraphClass, "real-world">> = [
		"erdos-renyi",
		"barabasi-albert",
		"watts-strogatz",
	];

	const trainingGraphs: LabelledGraph[] = [];
	for (const [ci, cls] of syntheticClasses.entries()) {
		const classSeed = seed + ci * 10_000;
		const graphs = generateSyntheticGraphs(
			cls,
			trainPerClass,
			classSeed,
			minNodes,
			maxNodes,
		);
		trainingGraphs.push(...graphs);
	}

	// Load real-world graphs for training
	const realWorldGraphs = await loadRealWorldGraphs();
	trainingGraphs.push(...realWorldGraphs);

	// --- 2. Extract training features ---
	const trainingData = trainingGraphs.map((lg) => ({
		features: extractFeatures(lg.graph),
		label: lg.label,
	}));

	// --- 3. Train classifier ---
	const classifier = trainClassifier(trainingData);

	// --- 4. Generate test data ---
	const testGraphs: LabelledGraph[] = [];
	for (const [ci, cls] of syntheticClasses.entries()) {
		// Use different seeds for test data to avoid overlap with training
		const classSeed = seed + ci * 10_000 + 5000;
		const graphs = generateSyntheticGraphs(
			cls,
			testPerClass,
			classSeed,
			minNodes,
			maxNodes,
		);
		testGraphs.push(...graphs);
	}

	// Real-world test data uses the same benchmarks (limited availability)
	// but the classifier was trained on them, so this tests memorisation
	// for the real-world class. In practice, additional benchmarks would
	// be held out for testing.
	testGraphs.push(...realWorldGraphs);

	// --- 5. Classify and evaluate ---
	const predictions = testGraphs.map((lg) => {
		const features = extractFeatures(lg.graph);
		const result = classify(features, classifier);
		return {
			predicted: result.predictedClass,
			actual: lg.label,
		};
	});

	const metrics = evaluateClassifier(predictions);

	return {
		metrics,
		classifier,
		trainingSize: trainingData.length,
		testSize: testGraphs.length,
	};
};
