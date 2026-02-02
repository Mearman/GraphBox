/**
 * Degree Distribution Jensen-Shannon Divergence
 *
 * Measures structural representativeness of a sampled subgraph by comparing
 * its degree distribution to the full graph. Lower JSD = more representative.
 *
 * Bins match the Python implementation in SCW oa_experiments for consistency.
 */

import type { Graph } from "@graph/algorithms/graph/graph.js";
import type { Edge, Node } from "@graph/algorithms/types/graph.js";

const DEGREE_BINS = [
	[1, 5],
	[6, 10],
	[11, 50],
	[51, 100],
	[101, 500],
	[501, 1000],
	[1001, Infinity],
] as const;

/**
 * Return the bin index for a given degree.
 * @param degree
 */
const binDegree = (degree: number): number => {
	for (const [i, [lo, hi]] of DEGREE_BINS.entries()) {
		if (degree >= lo && degree <= hi) return i;
	}
	return DEGREE_BINS.length - 1;
};

/**
 * Compute the KL divergence D(p || q) with smoothing.
 * @param p
 * @param q
 */
const klDivergence = (p: Float64Array, q: Float64Array): number => {
	let sum = 0;
	for (const [i, element] of p.entries()) {
		if (element > 0) {
			sum += element * Math.log2(element / q[i]);
		}
	}
	return sum;
};

/**
 * Compute Jensen-Shannon divergence between two probability distributions.
 * Returns a value in [0, 1] (using log base 2).
 * @param p
 * @param q
 */
const jensenShannonDivergence = (p: Float64Array, q: Float64Array): number => {
	const m = new Float64Array(p.length);
	for (const [i, element] of p.entries()) {
		m[i] = (element + q[i]) / 2;
	}
	return (klDivergence(p, m) + klDivergence(q, m)) / 2;
};

/**
 * Build a normalised histogram from degree values.
 * @param degrees
 */
const buildHistogram = (degrees: number[]): Float64Array => {
	const hist = new Float64Array(DEGREE_BINS.length);
	for (const d of degrees) {
		hist[binDegree(d)] += 1;
	}
	// Normalise + Laplace smoothing
	const total = degrees.length + DEGREE_BINS.length;
	for (let i = 0; i < hist.length; i++) {
		hist[i] = (hist[i] + 1) / total;
	}
	return hist;
};

/**
 * Compute JSD between sampled subgraph and full graph degree distributions.
 *
 * @param sampledDegrees - Degrees of nodes in the sampled subgraph (degrees in the *full* graph)
 * @param fullGraphDegrees - Degrees of all nodes in the full graph
 * @returns JSD value in [0, 1]. Lower = more representative.
 */
export const degreeDistributionJSD = (
	sampledDegrees: number[],
	fullGraphDegrees: number[],
): number => {
	if (sampledDegrees.length === 0 || fullGraphDegrees.length === 0) return 1;

	const sampledHist = buildHistogram(sampledDegrees);
	const fullHist = buildHistogram(fullGraphDegrees);

	return jensenShannonDivergence(sampledHist, fullHist);
};

/**
 * Extract degrees from a graph for all nodes or a subset.
 *
 * @param graph - The graph to extract degrees from
 * @param nodeIds - Optional subset of node IDs. If omitted, uses all nodes.
 * @returns Array of degree values
 */
export const extractDegrees = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodeIds?: Set<string>,
): number[] => {
	const degrees: number[] = [];

	if (nodeIds) {
		for (const id of nodeIds) {
			const result = graph.getNeighbors(id);
			if (result.ok) {
				degrees.push(result.value.length);
			}
		}
	} else {
		for (const node of graph.getAllNodes()) {
			const result = graph.getNeighbors(node.id);
			if (result.ok) {
				degrees.push(result.value.length);
			}
		}
	}

	return degrees;
};
