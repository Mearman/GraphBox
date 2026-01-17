/**
 * Spectral graph partitioning implementation.
 * Divides graph into k balanced partitions while minimizing edge cuts.
 *
 * Algorithm:
 * 1. Compute normalized Laplacian: L = D^(-1/2) * (D - A) * D^(-1/2)
 * 2. Extract k smallest eigenvectors (excluding trivial eigenvector)
 * 3. Apply k-means clustering on eigenvector matrix
 * 4. Handle partition constraints (balance, minimum size)
 *
 * Time Complexity: O(n² + k*iterations) for eigenvector computation + k-means
 * Space Complexity: O(n² + n*k)
 * @module partitioning/spectral
 */

import type { Graph } from "../graph/graph";
import type { Partition, PartitioningError } from "../types/clustering-types";
import type { Edge,Node } from "../types/graph";
import { Err as Error_, Ok, type Result } from "../types/result";
import type { WeightFunction } from "../types/weight-function";

/**
 * Perform spectral graph partitioning.
 *
 * Divides graph into k balanced partitions by analyzing the spectral properties
 * of the graph Laplacian matrix.
 * @template N - Node type
 * @template E - Edge type
 * @param graph - Input graph (directed or undirected)
 * @param k - Number of partitions to create
 * @param options - Optional configuration
 * @param options.weightFn - Weight function for edges (default: all edges weight 1.0)
 * @param options.balanceTolerance - Maximum allowed imbalance (default: 1.2)
 * @param options.maxKMeansIterations - Max iterations for k-means (default: 100)
 * @param options.seed - Random seed for k-means initialization (default: undefined)
 * @returns Result containing array of k partitions or error
 * @example
 * ```typescript
 * const graph = new Graph<PaperNode, CitationEdge>(true);
 * // ... add nodes and edges ...
 *
 * const result = spectralPartition(graph, 4);
 * if (result.ok) {
 *   console.log(`Created ${result.value.length} partitions`);
 * }
 * ```
 */
export const spectralPartition = <N extends Node, E extends Edge>(graph: Graph<N, E>, k: number, options: {
	weightFn?: WeightFunction<N, E>;
	balanceTolerance?: number;
	maxKMeansIterations?: number;
	seed?: number;
} = {}): Result<Partition<N>[], PartitioningError> => {
	const {
		weightFn: weightFunction = () => 1,
		balanceTolerance = 1.2,
		maxKMeansIterations = 100,
	} = options;

	// Validate inputs
	const allNodes = graph.getAllNodes();
	const nodeCount = allNodes.length;

	if (nodeCount === 0) {
		return Error_({
			type: "EmptyGraph",
			message: "Cannot partition an empty graph",
		});
	}

	if (k < 2) {
		return Error_({
			type: "InvalidPartitionCount",
			message: "Number of partitions must be at least 2",
			k,
			nodeCount,
		});
	}

	if (k > nodeCount) {
		return Error_({
			type: "InvalidPartitionCount",
			message: `Number of partitions (${k}) exceeds number of nodes (${nodeCount})`,
			k,
			nodeCount,
		});
	}

	// Build node ID to index mapping
	const nodeIdToIndex = new Map<string, number>();
	for (const [index, node] of allNodes.entries()) {
		nodeIdToIndex.set(node.id, index);
	}

	// 1. Compute normalized Laplacian matrix
	const laplacian = computeNormalizedLaplacian(
		graph,
		allNodes,
		nodeIdToIndex,
		weightFunction
	);

	// 2. Extract k smallest eigenvectors (power iteration method)
	const eigenvectors = extractSmallestEigenvectors(laplacian, k, nodeCount);

	// 3. Apply k-means clustering on eigenvector matrix
	let assignments = kMeansClustering(eigenvectors, k, maxKMeansIterations);

	// 4. Rebalance partitions to meet balance tolerance
	assignments = rebalancePartitions(
		assignments,
		k,
		nodeCount,
		balanceTolerance
	);

	// 5. Build partition results
	const partitions = buildPartitions(
		graph,
		allNodes,
		assignments,
		k,
		weightFunction,
		nodeIdToIndex
	);

	return Ok(partitions);
};

/**
 * Compute normalized Laplacian matrix: L = D^(-1/2) * (D - A) * D^(-1/2)
 * where D is degree matrix and A is adjacency matrix.
 * @param graph
 * @param nodes
 * @param nodeIdToIndex
 * @param weightFn
 * @param weightFunction
 */
const computeNormalizedLaplacian = <N extends Node, E extends Edge>(graph: Graph<N, E>, nodes: N[], nodeIdToIndex: Map<string, number>, weightFunction: WeightFunction<N, E>): number[][] => {
	const n = nodes.length;
	const adjacency: number[][] = new Array(n)
		.fill(0)
		.map(() => new Array(n).fill(0));
	const degrees: number[] = new Array(n).fill(0);

	// Build adjacency matrix and compute degrees
	for (const [index, node] of nodes.entries()) {
		const outgoingResult = graph.getOutgoingEdges(node.id);
		if (outgoingResult.ok) {
			for (const edge of outgoingResult.value) {
				const index_ = nodeIdToIndex.get(edge.target);
				if (index_ !== undefined) {
					const sourceOption = graph.getNode(edge.source);
					const targetOption = graph.getNode(edge.target);
					if (sourceOption.some && targetOption.some) {
						const weight = weightFunction(edge, sourceOption.value, targetOption.value);
						adjacency[index][index_] = weight;
						degrees[index] += weight;

						// For undirected graphs, add reverse edge
						if (!graph.isDirected()) {
							adjacency[index_][index] = weight;
							degrees[index_] += weight;
						}
					}
				}
			}
		}
	}

	// Compute D^(-1/2)
	const invSqrtDegrees: number[] = degrees.map((d) =>
		d > 0 ? 1 / Math.sqrt(d) : 0
	);

	// Compute normalized Laplacian: L = I - D^(-1/2) * A * D^(-1/2)
	const laplacian: number[][] = new Array(n)
		.fill(0)
		.map(() => new Array(n).fill(0));

	for (let index = 0; index < n; index++) {
		for (let index_ = 0; index_ < n; index_++) {
			laplacian[index][index_] = index === index_ ? 1 : -invSqrtDegrees[index] * adjacency[index][index_] * invSqrtDegrees[index_];
		}
	}

	return laplacian;
};

/**
 * Extract k smallest eigenvectors using power iteration method.
 * Returns a matrix where each row represents a node's embedding in k-dimensional space.
 * @param laplacian
 * @param k
 * @param n
 */
const extractSmallestEigenvectors = (laplacian: number[][], k: number, n: number): number[][] => {
	// For spectral partitioning, we need k-1 smallest non-trivial eigenvectors
	// (excluding the trivial eigenvector corresponding to eigenvalue 0)

	// Simplified approach: Use power iteration for largest eigenvalues of (I - L)
	// This gives us the smallest eigenvalues of L

	const embeddings: number[][] = new Array(n)
		.fill(0)
		.map(() => new Array(k).fill(0));

	// Initialize with random values
	for (let node = 0; node < n; node++) {
		for (let dim = 0; dim < k; dim++) {
			embeddings[node][dim] = Math.random() - 0.5;
		}
	}

	// Orthogonalize using Gram-Schmidt process
	for (let dim = 0; dim < k; dim++) {
		// Orthogonalize against previous dimensions
		for (let previousDim = 0; previousDim < dim; previousDim++) {
			let dotProduct = 0;
			for (let node = 0; node < n; node++) {
				dotProduct += embeddings[node][dim] * embeddings[node][previousDim];
			}
			for (let node = 0; node < n; node++) {
				embeddings[node][dim] -= dotProduct * embeddings[node][previousDim];
			}
		}

		// Normalize
		let norm = 0;
		for (let node = 0; node < n; node++) {
			norm += embeddings[node][dim] * embeddings[node][dim];
		}
		norm = Math.sqrt(norm);
		if (norm > 1e-10) {
			for (let node = 0; node < n; node++) {
				embeddings[node][dim] /= norm;
			}
		}

		// Power iteration to refine this eigenvector
		const maxIterations = 20;
		for (let iter = 0; iter < maxIterations; iter++) {
			const newVector: number[] = new Array(n).fill(0);

			// Multiply by (I - L)
			for (let index = 0; index < n; index++) {
				for (let index_ = 0; index_ < n; index_++) {
					newVector[index] += index === index_ ? embeddings[index_][dim] : -laplacian[index][index_] * embeddings[index_][dim];
				}
			}

			// Orthogonalize against previous dimensions
			for (let previousDim = 0; previousDim < dim; previousDim++) {
				let dotProduct = 0;
				for (let node = 0; node < n; node++) {
					dotProduct += newVector[node] * embeddings[node][previousDim];
				}
				for (let node = 0; node < n; node++) {
					newVector[node] -= dotProduct * embeddings[node][previousDim];
				}
			}

			// Normalize
			let norm = 0;
			for (let node = 0; node < n; node++) {
				norm += newVector[node] * newVector[node];
			}
			norm = Math.sqrt(norm);

			if (norm > 1e-10) {
				for (let node = 0; node < n; node++) {
					embeddings[node][dim] = newVector[node] / norm;
				}
			}
		}
	}

	return embeddings;
};

/**
 * K-means clustering on eigenvector embeddings.
 * Returns cluster assignments for each node.
 * @param embeddings
 * @param k
 * @param maxIterations
 */
const kMeansClustering = (embeddings: number[][], k: number, maxIterations: number): number[] => {
	const n = embeddings.length;
	const dimensions = embeddings[0].length;

	// Initialize centroids using k-means++ strategy
	const centroids: number[][] = [];
	const assignments: number[] = new Array(n).fill(0);

	// First centroid: random node
	const firstIndex = Math.floor(Math.random() * n);
	centroids.push([...embeddings[firstIndex]]);

	// Remaining centroids: weighted by distance to nearest existing centroid
	for (let c = 1; c < k; c++) {
		const distances: number[] = new Array(n).fill(Infinity);

		// Compute distance to nearest centroid for each point
		for (let index = 0; index < n; index++) {
			for (const centroid of centroids) {
				const distribution = euclideanDistance(embeddings[index], centroid);
				distances[index] = Math.min(distances[index], distribution);
			}
		}

		// Select point with maximum distance as next centroid
		let maxDistribution = -1;
		let maxIndex = 0;
		for (let index = 0; index < n; index++) {
			if (distances[index] > maxDistribution) {
				maxDistribution = distances[index];
				maxIndex = index;
			}
		}

		centroids.push([...embeddings[maxIndex]]);
	}

	// K-means iterations
	let converged = false;
	let iteration = 0;

	while (!converged && iteration < maxIterations) {
		converged = true;
		iteration++;

		// Assignment step: assign each point to nearest centroid
		for (let index = 0; index < n; index++) {
			let minDistribution = Infinity;
			let bestCluster = 0;

			for (let c = 0; c < k; c++) {
				const distribution = euclideanDistance(embeddings[index], centroids[c]);
				if (distribution < minDistribution) {
					minDistribution = distribution;
					bestCluster = c;
				}
			}

			if (assignments[index] !== bestCluster) {
				assignments[index] = bestCluster;
				converged = false;
			}
		}

		// Update step: recompute centroids
		const clusterSizes: number[] = new Array(k).fill(0);
		const newCentroids: number[][] = new Array(k)
			.fill(0)
			.map(() => new Array(dimensions).fill(0));

		for (let index = 0; index < n; index++) {
			const cluster = assignments[index];
			clusterSizes[cluster]++;
			for (let d = 0; d < dimensions; d++) {
				newCentroids[cluster][d] += embeddings[index][d];
			}
		}

		for (let c = 0; c < k; c++) {
			if (clusterSizes[c] > 0) {
				for (let d = 0; d < dimensions; d++) {
					centroids[c][d] = newCentroids[c][d] / clusterSizes[c];
				}
			}
		}
	}

	return assignments;
};

/**
 * Euclidean distance between two vectors.
 * @param v1
 * @param v2
 */
const euclideanDistance = (v1: number[], v2: number[]): number => {
	let sum = 0;
	for (const [index, element] of v1.entries()) {
		const diff = element - v2[index];
		sum += diff * diff;
	}
	return Math.sqrt(sum);
};

/**
 * Rebalance partitions to meet balance tolerance.
 * Moves nodes from oversized partitions to undersized ones.
 * @param assignments
 * @param k
 * @param nodeCount
 * @param balanceTolerance
 */
const rebalancePartitions = (assignments: number[], k: number, nodeCount: number, balanceTolerance: number): number[] => {
	const idealSize = nodeCount / k;

	// Count partition sizes
	const partitionSizes = new Array(k).fill(0);
	for (const partitionId of assignments) {
		partitionSizes[partitionId]++;
	}

	// Calculate current balance ratio
	const maxCurrentSize = Math.max(...partitionSizes);
	const currentBalanceRatio = maxCurrentSize / idealSize;

	// If already balanced, return original
	if (currentBalanceRatio <= balanceTolerance) {
		return assignments;
	}

	// Greedy rebalancing: repeatedly move nodes from largest to smallest partition
	const rebalanced = [...assignments];
	const maxIterations = 1000; // Prevent infinite loops
	let iteration = 0;

	while (iteration < maxIterations) {
		iteration++;

		// Recalculate partition sizes
		partitionSizes.fill(0);
		for (const partitionId of rebalanced) {
			partitionSizes[partitionId]++;
		}

		// Find largest and smallest partitions
		let largestPartition = 0;
		let smallestPartition = 0;
		let maxSize = partitionSizes[0];
		let minSize = partitionSizes[0];

		for (let index = 1; index < k; index++) {
			if (partitionSizes[index] > maxSize) {
				maxSize = partitionSizes[index];
				largestPartition = index;
			}
			if (partitionSizes[index] < minSize) {
				minSize = partitionSizes[index];
				smallestPartition = index;
			}
		}

		// Check if balanced
		const balanceRatio = maxSize / idealSize;
		if (balanceRatio <= balanceTolerance) {
			break;
		}

		// Check if we can improve by moving a node
		if (maxSize - minSize <= 1) {
			// Already as balanced as possible
			break;
		}

		// Move one node from largest to smallest partition
		for (let index = 0; index < rebalanced.length; index++) {
			if (rebalanced[index] === largestPartition) {
				rebalanced[index] = smallestPartition;
				break;
			}
		}
	}

	return rebalanced;
};

/**
 * Build partition results from cluster assignments.
 * @param graph
 * @param nodes
 * @param assignments
 * @param k
 * @param weightFn
 * @param weightFunction
 * @param nodeIdToIndex
 */
const buildPartitions = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodes: N[],
	assignments: number[],
	k: number,
	weightFunction: WeightFunction<N, E>,
	nodeIdToIndex: Map<string, number>,
): Partition<N>[] => {
	// Group nodes by partition
	const partitionNodes: Map<number, Set<N>> = new Map();
	for (let index = 0; index < k; index++) {
		partitionNodes.set(index, new Set());
	}

	for (const [index, node] of nodes.entries()) {
		const partitionId = assignments[index];
		const partition = partitionNodes.get(partitionId);
		if (partition) {
			partition.add(node);
		}
	}

	// Calculate edge cuts for each partition
	const partitions: Partition<N>[] = [];
	const totalNodes = nodes.length;
	const idealSize = totalNodes / k;

	for (let partitionId = 0; partitionId < k; partitionId++) {
		const partitionNodeSet = partitionNodes.get(partitionId);
		if (!partitionNodeSet) continue;
		let edgeCuts = 0;

		// Count edges that cross partition boundary
		for (const node of partitionNodeSet) {
			const outgoingResult = graph.getOutgoingEdges(node.id);
			if (outgoingResult.ok) {
				for (const edge of outgoingResult.value) {
					const targetIndex = nodeIdToIndex.get(edge.target);
					if (targetIndex !== undefined) {
						const targetPartition = assignments[targetIndex];
						if (targetPartition !== partitionId) {
							const sourceOption = graph.getNode(edge.source);
							const targetOption = graph.getNode(edge.target);
							if (sourceOption.some && targetOption.some) {
								edgeCuts += weightFunction(edge, sourceOption.value, targetOption.value);
							}
						}
					}
				}
			}
		}

		const size = partitionNodeSet.size;
		const balance = size / idealSize;

		partitions.push({
			id: partitionId,
			nodes: partitionNodeSet,
			size,
			edgeCuts,
			balance,
		});
	}

	return partitions;
};
