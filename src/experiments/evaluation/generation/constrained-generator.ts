/**
 * Feature-Constrained Graph Generator
 *
 * Wraps the existing graph generators (ER, BA, WS) with iterative refinement:
 * generate a candidate graph, extract features, classify it, and accept only
 * graphs that the classifier assigns to the target class.
 *
 * This validates that generators produce structurally distinguishable graphs
 * and that the classifier can recognise them reliably.
 */

import { Graph } from "../../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../../algorithms/types/graph.js";
import { createScaleFreeGraph } from "../__tests__/validation/common/graph-generators.js";
import {
	extractFeatures,
	type GraphFeatures,
} from "../classification/feature-extractor.js";
import {
	classify,
	type GraphClass,
	type TrainedClassifier,
} from "../classification/graph-classifier.js";

// ============================================================================
// Seeded PRNG (duplicated from classification-evaluator for independence)
// ============================================================================

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

const generateBarabasiAlbert = (n: number, seed: number): Graph<Node, Edge> => {
	const edges = createScaleFreeGraph(n, seed);
	return edgesToGraph(edges);
};

const generateWattsStrogatz = (
	n: number,
	k: number,
	beta: number,
	seed: number,
): Graph<Node, Edge> => {
	const rng = createRng(seed);
	const edgeSet = new Set<string>();
	const edgeList: Array<[number, number]> = [];

	const canonicalKey = (a: number, b: number): string => {
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		return `${lo}-${hi}`;
	};

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

	for (let index = 0; index < edgeList.length; index++) {
		if (rng() < beta) {
			const [source] = edgeList[index];
			let attempts = 0;
			while (attempts < n) {
				const newTarget = Math.floor(rng() * n);
				if (newTarget !== source) {
					const newKey = canonicalKey(source, newTarget);
					if (!edgeSet.has(newKey)) {
						const oldKey = canonicalKey(edgeList[index][0], edgeList[index][1]);
						edgeSet.delete(oldKey);
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
// Constrained Generation
// ============================================================================

/**
 * Configuration for constrained graph generation.
 */
export interface ConstrainedGeneratorConfig {
	/** Minimum node count for generated graphs (default: 30) */
	minNodes?: number;
	/** Maximum node count for generated graphs (default: 100) */
	maxNodes?: number;
	/** Maximum generation attempts per graph (default: 50) */
	maxAttempts?: number;
	/** Base seed for reproducibility (default: 42) */
	seed?: number;
}

/**
 * Result of a single constrained generation attempt.
 */
export interface GeneratedGraph {
	/** The generated graph */
	graph: Graph<Node, Edge>;
	/** Target class the graph was generated for */
	targetClass: Exclude<GraphClass, "real-world">;
	/** Classified class (should match target) */
	classifiedAs: GraphClass;
	/** Whether classification matched the target */
	matchesTarget: boolean;
	/** Structural features of the generated graph */
	features: GraphFeatures;
	/** Classification confidence */
	confidence: number;
	/** Number of attempts before acceptance */
	attempts: number;
}

/**
 * Generate a graph of a target class that the classifier correctly identifies.
 *
 * Iteratively generates candidates using the class-appropriate generator,
 * extracts features, classifies, and accepts only if the classifier assigns
 * the target class. Returns the first accepted graph or the best attempt
 * after maxAttempts.
 *
 * @param targetClass - The graph class to generate
 * @param classifier - A trained classifier for validation
 * @param config - Generation configuration
 * @returns A GeneratedGraph with classification validation
 */
export const generateConstrainedGraph = (
	targetClass: Exclude<GraphClass, "real-world">,
	classifier: TrainedClassifier,
	config: ConstrainedGeneratorConfig = {},
): GeneratedGraph => {
	const {
		minNodes = 30,
		maxNodes = 100,
		maxAttempts = 50,
		seed = 42,
	} = config;

	const sizeRng = createRng(seed);
	let bestAttempt: GeneratedGraph | undefined = undefined;
	let bestConfidence = -1;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const n = Math.floor(sizeRng() * (maxNodes - minNodes + 1)) + minNodes;
		const graphSeed = seed + attempt * 137;

		let graph: Graph<Node, Edge>;
		switch (targetClass) {
			case "erdos-renyi": {
				graph = generateErdosRenyi(n, graphSeed);
				break;
			}
			case "barabasi-albert": {
				graph = generateBarabasiAlbert(n, graphSeed);
				break;
			}
			case "watts-strogatz": {
				graph = generateWattsStrogatz(n, 4, 0.3, graphSeed);
				break;
			}
		}

		const features = extractFeatures(graph);
		const result = classify(features, classifier);

		const entry: GeneratedGraph = {
			graph,
			targetClass,
			classifiedAs: result.predictedClass,
			matchesTarget: result.predictedClass === targetClass,
			features,
			confidence: result.confidence,
			attempts: attempt,
		};

		if (entry.matchesTarget) {
			return entry;
		}

		if (result.confidence > bestConfidence || bestAttempt === undefined) {
			bestConfidence = result.confidence;
			bestAttempt = entry;
		}
	}

	// Always assigned since maxAttempts >= 1 guarantees at least one iteration
	if (bestAttempt === undefined) {
		throw new Error("No attempts were made — maxAttempts must be >= 1");
	}
	return bestAttempt;
};

/**
 * Generate a batch of constrained graphs for a target class.
 *
 * @param targetClass - The graph class to generate
 * @param count - Number of graphs to generate
 * @param classifier - A trained classifier for validation
 * @param config - Generation configuration
 * @returns Array of GeneratedGraph results
 */
export const generateConstrainedBatch = (
	targetClass: Exclude<GraphClass, "real-world">,
	count: number,
	classifier: TrainedClassifier,
	config: ConstrainedGeneratorConfig = {},
): GeneratedGraph[] => {
	const baseSeed = config.seed ?? 42;
	const results: GeneratedGraph[] = [];

	for (let index = 0; index < count; index++) {
		const graphConfig: ConstrainedGeneratorConfig = {
			...config,
			seed: baseSeed + index * 1000,
		};
		results.push(generateConstrainedGraph(targetClass, classifier, graphConfig));
	}

	return results;
};
