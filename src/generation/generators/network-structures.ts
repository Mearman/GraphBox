/**
 * Network structure generators for complex graph topologies.
 * Implements scale-free, small-world, and modular network models.
 */

import type { GraphSpec } from "../spec";
import type { TestEdge,TestNode } from "./types";
import { SeededRandom } from "./types";

/**
 * Add edge to edge list with optional type assignment.
 * For heterogeneous graphs, assigns random edge type.
 * Note: Edges are stored as directed but buildAdjacencyList will create bidirectional adjacency.
 * @param edges
 * @param source
 * @param target
 * @param spec
 * @param rng
 */
const addEdge = (edges: TestEdge[], source: string, target: string, spec: GraphSpec, rng: SeededRandom): void => {
	const edge: TestEdge = { source, target };

	if (spec.schema.kind === "heterogeneous") {
		// Assign random edge type (could be based on config.edgeTypes)
		edge.type = rng.choice(["type_a", "type_b", "type_c"]);
	}

	edges.push(edge);
};

/**
 * Check if edge exists between source and target.
 * @param edges - Edge list
 * @param source - Source node ID
 * @param target - Target node ID
 * @returns True if edge exists
 */
const hasEdge = (edges: TestEdge[], source: string, target: string): boolean => {
	return edges.some(e =>
		(e.source === source && e.target === target) ||
    (e.source === target && e.target === source)
	);
};

/**
 * Generate scale-free graph edges (Barabási-Albert preferential attachment).
 * Scale-free graphs have power-law degree distribution.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateScaleFreeEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	const exponent = spec.scaleFree?.kind === "scale_free" ? spec.scaleFree.exponent ?? 2.1 : 2.1;
	const initialCoreSize = Math.max(2, Math.floor(nodes.length / 10));

	// Create initial core (complete graph)
	for (let index = 0; index < initialCoreSize; index++) {
		for (let index_ = index + 1; index_ < initialCoreSize; index_++) {
			addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
		}
	}

	// Track degrees for preferential attachment
	const degrees = new Map<string, number>();
	for (const node of nodes) degrees.set(node.id, 0);
	for (const edge of edges) {
		degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
		degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
	}

	// Add remaining vertices with preferential attachment
	for (let index = initialCoreSize; index < nodes.length; index++) {
		const totalDegree = [...degrees.values()].reduce((a, b) => a + Math.pow(b, exponent), 0);
		const targetCount = Math.min(3, initialCoreSize);

		for (let t = 0; t < targetCount; t++) {
			// Select target with probability ∝ degree^exponent
			let rand = rng.next() * totalDegree;
			let selectedId = nodes[Math.floor(rng.next() * index)].id;

			for (const [nodeId, degree] of degrees) {
				const prob = Math.pow(degree, exponent);
				rand -= prob;
				if (rand <= 0) {
					selectedId = nodeId;
					break;
				}
			}

			// Avoid duplicate edges
			if (!hasEdge(edges, nodes[index].id, selectedId)) {
				addEdge(edges, nodes[index].id, selectedId, spec, rng);
				degrees.set(selectedId, (degrees.get(selectedId) || 0) + 1);
			}
		}

		degrees.set(nodes[index].id, targetCount);
	}

	// Store exponent for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.scaleFreeExponent = exponent;
	}
};

/**
 * Generate small-world graph edges (Watts-Strogatz model).
 * Small-world graphs have high clustering + short paths.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateSmallWorldEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 4) return;

	const rewireProb = spec.smallWorld?.kind === "small_world" ? spec.smallWorld.rewireProbability ?? 0.1 : 0.1;
	const meanDegree = spec.smallWorld?.kind === "small_world" ? spec.smallWorld.meanDegree ?? 4 : 4;

	// Create ring lattice
	const k = Math.floor(meanDegree / 2);
	for (let index = 0; index < nodes.length; index++) {
		for (let index_ = 1; index_ <= k; index_++) {
			const target = (index + index_) % nodes.length;
			addEdge(edges, nodes[index].id, nodes[target].id, spec, rng);
		}
	}

	// Rewire edges
	const edgesToRewire = [...edges];
	for (const edge of edgesToRewire) {
		if (rng.next() < rewireProb) {
			// Remove edge
			const index = edges.indexOf(edge);
			if (index !== -1) edges.splice(index, 1);

			// Add new random edge (avoid duplicates and self-loops)
			const sourceIndex = nodes.findIndex(n => n.id === edge.source);
			let newTargetIndex = Math.floor(rng.next() * nodes.length);
			let attempts = 0;
			const maxAttempts = nodes.length * 2;

			while (newTargetIndex === sourceIndex || hasEdge(edges, edge.source, nodes[newTargetIndex].id)) {
				newTargetIndex = (newTargetIndex + 1) % nodes.length;
				attempts++;
				if (attempts > maxAttempts) {
					// Can't find valid target, skip this edge
					break;
				}
			}

			if (attempts <= maxAttempts) {
				addEdge(edges, edge.source, nodes[newTargetIndex].id, spec, rng);
			}
		}
	}

	// Store parameters for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.smallWorldRewireProb = rewireProb;
		node.data.smallWorldMeanDegree = meanDegree;
	}
};

/**
 * Generate modular graph edges (community structure).
 * Modular graphs have dense communities + sparse inter-community edges.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateModularEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	const numberCommunities = spec.communityStructure?.kind === "modular" ? spec.communityStructure.numCommunities ?? 3 : 3;
	const intraDensity = spec.communityStructure?.kind === "modular" ? spec.communityStructure.intraCommunityDensity ?? 0.7 : 0.7;
	const interDensity = spec.communityStructure?.kind === "modular" ? spec.communityStructure.interCommunityDensity ?? 0.05 : 0.05;

	// Assign communities
	const communities: TestNode[][] = Array.from({ length: numberCommunities }, () => []);
	for (const [index, node] of nodes.entries()) {
		const comm = index % numberCommunities;
		communities[comm].push(node);
		node.data = node.data || {};
		node.data.community = comm;
	}

	// Add intra-community edges
	for (const community of communities) {
		for (let index = 0; index < community.length; index++) {
			for (let index_ = index + 1; index_ < community.length; index_++) {
				if (rng.next() < intraDensity) {
					addEdge(edges, community[index].id, community[index_].id, spec, rng);
				}
			}
		}
	}

	// Add inter-community edges
	for (let index = 0; index < communities.length; index++) {
		for (let index_ = index + 1; index_ < communities.length; index_++) {
			for (const u of communities[index]) {
				for (const v of communities[index_]) {
					if (rng.next() < interDensity) {
						addEdge(edges, u.id, v.id, spec, rng);
					}
				}
			}
		}
	}

	// Store parameters for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.numCommunities = numberCommunities;
		node.data.intraDensity = intraDensity;
		node.data.interDensity = interDensity;
	}
};
