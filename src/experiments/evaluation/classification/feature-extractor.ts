/**
 * Structural Feature Extraction for Graph Classification
 *
 * Extracts a fixed-length feature vector from a Graph instance,
 * capturing degree statistics, clustering, density, and assortativity.
 * These features serve as input to the nearest-centroid classifier.
 */

import { type Graph } from "../../../algorithms/graph/graph.js";
import type { Edge, Node } from "../../../algorithms/types/graph.js";

/**
 * Structural feature vector extracted from a single graph.
 *
 * All features are deterministic given the same graph structure.
 */
export interface GraphFeatures {
	/** Total number of nodes */
	nodeCount: number;
	/** Total number of edges */
	edgeCount: number;
	/** Mean node degree */
	meanDegree: number;
	/** Standard deviation of node degrees */
	stdDegree: number;
	/** Maximum node degree */
	maxDegree: number;
	/** Minimum node degree */
	minDegree: number;
	/** Third standardised moment of the degree distribution */
	degreeSkewness: number;
	/** Global clustering coefficient (fraction of closed triangles) */
	clusteringCoefficient: number;
	/** Edge density: 2|E| / (|V|(|V|-1)) for undirected graphs */
	density: number;
	/** Degree assortativity: Pearson correlation of degrees at edge endpoints */
	degreeAssortativity: number;
}

/** Ordered list of feature names matching the feature vector layout. */
export const FEATURE_NAMES: ReadonlyArray<keyof GraphFeatures> = [
	"nodeCount",
	"edgeCount",
	"meanDegree",
	"stdDegree",
	"maxDegree",
	"minDegree",
	"degreeSkewness",
	"clusteringCoefficient",
	"density",
	"degreeAssortativity",
] as const;

/**
 * Convert a GraphFeatures object to a numeric array in canonical order.
 * @param features
 */
export const featuresToVector = (features: GraphFeatures): number[] =>
	FEATURE_NAMES.map((name) => features[name]);

/**
 * Extract structural features from a graph.
 *
 * For clustering coefficient: for each node, counts edges between its
 * neighbours (triangles) divided by the number of possible triangles.
 *
 * For degree assortativity: computes Pearson correlation of degrees at
 * both endpoints of every edge.
 *
 * @param graph - The graph to extract features from
 * @returns A GraphFeatures object with all computed metrics
 */
export const extractFeatures = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
): GraphFeatures => {
	const nodes = graph.getAllNodes();
	const edges = graph.getAllEdges();
	const nodeCount = nodes.length;
	const edgeCount = edges.length;

	// --- Degree distribution ---
	const degrees = computeDegrees(graph, nodes);
	const degreeValues = [...degrees.values()];

	const meanDegree = nodeCount > 0
		? degreeValues.reduce((sum, d) => sum + d, 0) / nodeCount
		: 0;

	const variance = nodeCount > 0
		? degreeValues.reduce((sum, d) => sum + (d - meanDegree) ** 2, 0) / nodeCount
		: 0;
	const stdDegree = Math.sqrt(variance);

	const maxDegree = nodeCount > 0 ? Math.max(...degreeValues) : 0;
	const minDegree = nodeCount > 0 ? Math.min(...degreeValues) : 0;

	// Skewness: third standardised moment E[((X-mu)/sigma)^3]
	const degreeSkewness = computeSkewness(degreeValues, meanDegree, stdDegree);

	// --- Clustering coefficient ---
	const clusteringCoefficient = computeGlobalClustering(graph, nodes, degrees);

	// --- Density ---
	const density = nodeCount > 1
		? (2 * edgeCount) / (nodeCount * (nodeCount - 1))
		: 0;

	// --- Degree assortativity ---
	const degreeAssortativity = computeDegreeAssortativity(edges, degrees);

	return {
		nodeCount,
		edgeCount,
		meanDegree,
		stdDegree,
		maxDegree,
		minDegree,
		degreeSkewness,
		clusteringCoefficient,
		density,
		degreeAssortativity,
	};
};

/**
 * Compute degree for every node by querying neighbours via the Result API.
 * @param graph
 * @param nodes
 */
const computeDegrees = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodes: N[],
): Map<string, number> => {
	const degrees = new Map<string, number>();
	for (const node of nodes) {
		const result = graph.getNeighbors(node.id);
		if (result.ok) {
			degrees.set(node.id, result.value.length);
		} else {
			degrees.set(node.id, 0);
		}
	}
	return degrees;
};

/**
 * Third standardised moment (skewness).
 * Returns 0 when standard deviation is zero to avoid division by zero.
 * @param values
 * @param mean
 * @param std
 */
const computeSkewness = (
	values: number[],
	mean: number,
	std: number,
): number => {
	if (std === 0 || values.length === 0) return 0;
	const n = values.length;
	const m3 = values.reduce((sum, v) => sum + ((v - mean) / std) ** 3, 0) / n;
	return m3;
};

/**
 * Global clustering coefficient.
 *
 * Average of local clustering coefficients across all nodes.
 * Local CC for node v = (edges between neighbours) / (k*(k-1)/2)
 * where k = degree(v). Nodes with degree < 2 contribute 0.
 * @param graph
 * @param nodes
 * @param degrees
 */
const computeGlobalClustering = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodes: N[],
	degrees: Map<string, number>,
): number => {
	if (nodes.length === 0) return 0;

	let totalCC = 0;
	let countable = 0;

	for (const node of nodes) {
		const degree = degrees.get(node.id) ?? 0;
		if (degree < 2) continue;

		const neighboursResult = graph.getNeighbors(node.id);
		if (!neighboursResult.ok) continue;

		const neighbours = neighboursResult.value;
		const neighbourSet = new Set(neighbours);

		// Count edges between neighbours
		let triangleEdges = 0;
		for (const neighbour of neighbours) {
			const nnResult = graph.getNeighbors(neighbour);
			if (!nnResult.ok) continue;
			for (const nn of nnResult.value) {
				if (neighbourSet.has(nn)) {
					triangleEdges++;
				}
			}
		}

		// Each triangle edge is counted twice (once from each endpoint)
		const actualTriangleEdges = triangleEdges / 2;
		const possibleTriangleEdges = (degree * (degree - 1)) / 2;
		const localCC = actualTriangleEdges / possibleTriangleEdges;

		totalCC += localCC;
		countable++;
	}

	return countable > 0 ? totalCC / countable : 0;
};

/**
 * Degree assortativity coefficient.
 *
 * Pearson correlation coefficient of degrees at both endpoints of each edge.
 * Positive values indicate assortative mixing (high-degree nodes connect to
 * high-degree nodes); negative values indicate disassortative mixing.
 *
 * Returns 0 when there are fewer than 2 edges or when variance is zero.
 * @param edges
 * @param degrees
 */
const computeDegreeAssortativity = <E extends Edge>(
	edges: E[],
	degrees: Map<string, number>,
): number => {
	if (edges.length < 2) return 0;

	const sourceDegrees: number[] = [];
	const targetDegrees: number[] = [];

	for (const edge of edges) {
		const sd = degrees.get(edge.source);
		const td = degrees.get(edge.target);
		if (sd !== undefined && td !== undefined) {
			sourceDegrees.push(sd);
			targetDegrees.push(td);
		}
	}

	if (sourceDegrees.length < 2) return 0;

	return pearsonCorrelation(sourceDegrees, targetDegrees);
};

/**
 * Pearson correlation coefficient between two numeric arrays.
 * Returns 0 when either array has zero variance.
 * @param xs
 * @param ys
 */
const pearsonCorrelation = (xs: number[], ys: number[]): number => {
	const n = xs.length;
	if (n === 0) return 0;

	const meanX = xs.reduce((s, v) => s + v, 0) / n;
	const meanY = ys.reduce((s, v) => s + v, 0) / n;

	let covXY = 0;
	let variableX = 0;
	let variableY = 0;

	for (let index = 0; index < n; index++) {
		const dx = xs[index] - meanX;
		const dy = ys[index] - meanY;
		covXY += dx * dy;
		variableX += dx * dx;
		variableY += dy * dy;
	}

	const denominator = Math.sqrt(variableX * variableY);
	if (denominator === 0) return 0;

	return covXY / denominator;
};
