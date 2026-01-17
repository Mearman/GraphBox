/**
 * Hierarchical clustering algorithm implementation.
 * Builds dendrogram using agglomerative clustering with various linkage methods.
 *
 * Algorithm:
 * 1. Start with each node as a singleton cluster
 * 2. Compute pairwise distance matrix from graph adjacency
 * 3. Repeatedly merge the two closest clusters
 * 4. Update distance matrix using linkage method
 * 5. Repeat until all clusters merged into one
 *
 * Time Complexity: O(n³) for naive implementation, O(n² log n) with optimizations
 * Space Complexity: O(n²) for distance matrix
 * @module hierarchical/clustering
 */

import type { Graph } from "../graph/graph";
import type {
	Dendrogram,
	HierarchicalResult,
	MergeStep,
} from "../types/clustering-types";
import type { Edge,Node } from "../types/graph";
import { Err as Error_,Ok } from "../types/result";

/**
 * Linkage method for computing cluster-to-cluster distances.
 */
type LinkageMethod = "single" | "complete" | "average";

/**
 * Distance matrix for efficient lookup.
 * Stored as upper triangular matrix (i < j).
 */
class DistanceMatrix {
	private distances: Map<string, number>;
	private n: number;

	constructor(n: number) {
		this.distances = new Map();
		this.n = n;
	}

	/**
	 * Get distance between clusters i and j.
	 * @param i
	 * @param index
	 * @param j
	 * @param index_
	 */
	get(index: number, index_: number): number {
		if (index === index_) return 0;
		const key = index < index_ ? `${index},${index_}` : `${index_},${index}`;
		return this.distances.get(key) ?? Infinity;
	}

	/**
	 * Set distance between clusters i and j.
	 * @param i
	 * @param index
	 * @param j
	 * @param index_
	 * @param distance
	 */
	set(index: number, index_: number, distance: number): void {
		if (index === index_) return;
		const key = index < index_ ? `${index},${index_}` : `${index_},${index}`;
		this.distances.set(key, distance);
	}

	/**
	 * Find the pair of clusters with minimum distance.
	 * Returns [i, j, distance] where i < j.
	 * @param activeClusters
	 */
	findMinimum(activeClusters: Set<number>): [number, number, number] | undefined {
		let minI = -1;
		let minJ = -1;
		let minDistribution = Infinity;

		const clusters = [...activeClusters];
		for (let index = 0; index < clusters.length; index++) {
			for (let index_ = index + 1; index_ < clusters.length; index_++) {
				const distribution = this.get(clusters[index], clusters[index_]);
				if (distribution < minDistribution) {
					minDistribution = distribution;
					minI = clusters[index];
					minJ = clusters[index_];
				}
			}
		}

		return minI >= 0 && minJ >= 0 ? [minI, minJ, minDistribution] : undefined;
	}
}

/**
 * Build adjacency matrix from graph (1.0 if edge exists, 0.0 otherwise).
 * For undirected graphs, matrix is symmetric.
 * For directed graphs, treats as undirected (combines both directions).
 * @param graph
 * @param nodeIndexMap
 */
const buildAdjacencyMatrix = <N extends Node, E extends Edge>(graph: Graph<N, E>, nodeIndexMap: Map<string, number>): number[][] => {
	const n = nodeIndexMap.size;
	const adjMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

	// Set diagonal to 1 (node is adjacent to itself)
	for (let index = 0; index < n; index++) {
		adjMatrix[index][index] = 1;
	}

	// Fill adjacency from edges
	const edges = graph.getAllEdges();
	for (const edge of edges) {
		const sourceIndex = nodeIndexMap.get(edge.source);
		const targetIndex = nodeIndexMap.get(edge.target);

		if (sourceIndex !== undefined && targetIndex !== undefined) {
			adjMatrix[sourceIndex][targetIndex] = 1;

			// For undirected graphs or treating directed as undirected
			if (!graph.isDirected()) {
				adjMatrix[targetIndex][sourceIndex] = 1;
			}
		}
	}

	return adjMatrix;
};

/**
 * Compute initial distance matrix from adjacency matrix.
 * Distance = 1.0 - adjacency (0 if connected, 1 if not connected).
 * @param adjMatrix
 */
const computeDistanceMatrix = (adjMatrix: number[][]): DistanceMatrix => {
	const n = adjMatrix.length;
	const distributionMatrix = new DistanceMatrix(n);

	for (let index = 0; index < n; index++) {
		for (let index_ = index + 1; index_ < n; index_++) {
			// Distance = 1 - adjacency (0 if edge exists, 1 if no edge)
			const distance = 1 - adjMatrix[index][index_];
			distributionMatrix.set(index, index_, distance);
		}
	}

	return distributionMatrix;
};

/**
 * Update distance matrix after merging two clusters.
 * Uses linkage method to compute new distances.
 * @param distMatrix
 * @param distributionMatrix
 * @param merged
 * @param cluster1
 * @param cluster2
 * @param activeClusters
 * @param linkage
 * @param clusterSizes
 */
const updateDistances = (distributionMatrix: DistanceMatrix, merged: number, cluster1: number, cluster2: number, activeClusters: Set<number>, linkage: LinkageMethod, clusterSizes: Map<number, number>): void => {
	const size1 = clusterSizes.get(cluster1) ?? 1;
	const size2 = clusterSizes.get(cluster2) ?? 1;

	for (const k of activeClusters) {
		if (k === merged) continue;

		const distribution1 = distributionMatrix.get(cluster1, k);
		const distribution2 = distributionMatrix.get(cluster2, k);

		let newDistribution: number;

		switch (linkage) {
			case "single": {
				// Single linkage: minimum distance
				newDistribution = Math.min(distribution1, distribution2);
				break;
			}

			case "complete": {
				// Complete linkage: maximum distance
				newDistribution = Math.max(distribution1, distribution2);
				break;
			}

			case "average": {
				// Average linkage: weighted average by cluster sizes
				newDistribution = (distribution1 * size1 + distribution2 * size2) / (size1 + size2);
				break;
			}

			default: {
				newDistribution = Math.min(distribution1, distribution2);
			}
		}

		distributionMatrix.set(merged, k, newDistribution);
	}
};

/**
 * Build dendrogram from merge history.
 * @param nodes
 * @param merges
 * @param heights
 */
const buildDendrogram = <N extends Node>(nodes: N[], merges: MergeStep[], heights: number[]): Dendrogram<string> => {
	const leafNodes = nodes.map((node) => node.id);
	const clusterSizes = merges.map((merge) => merge.size);

	return {
		merges,
		heights,
		leafNodes,
		clusterSizes,

		/**
		 * Cut dendrogram at specified height to produce flat clusters.
		 * @param height
		 */
		cutAtHeight: (height: number): Set<string>[] => {
			// Start with all nodes in singleton clusters (indices 0 to n-1)
			const clusters = new Map<number, Set<string>>();
			for (const [index, nodeId] of leafNodes.entries()) {
				clusters.set(index, new Set([nodeId]));
			}

			// Apply merges up to the specified height
			for (const [index, merge] of merges.entries()) {
				if (heights[index] > height) break;

				const cluster1 = clusters.get(merge.cluster1);
				const cluster2 = clusters.get(merge.cluster2);

				if (!cluster1 || !cluster2) continue;

				// Merge cluster2 into cluster1
				const newCluster = new Set([...cluster1, ...cluster2]);

				// Remove old clusters
				clusters.delete(merge.cluster1);
				clusters.delete(merge.cluster2);

				// Add new merged cluster with index (n + i)
				const n = leafNodes.length;
				clusters.set(n + index, newCluster);
			}

			return [...clusters.values()];
		},

		/**
		 * Get exactly k clusters by cutting dendrogram.
		 * @param numClusters
		 * @param numberClusters
		 */
		getClusters: (numberClusters: number): Set<string>[] => {
			if (numberClusters <= 0) return [];
			if (numberClusters >= leafNodes.length) {
				// Return singleton clusters
				return leafNodes.map((nodeId) => new Set([nodeId]));
			}

			// Find the merge index that produces k clusters
			// After merge i, we have (n - i - 1) clusters
			const n = leafNodes.length;
			const mergeIndex = n - numberClusters;

			if (mergeIndex < 0 || mergeIndex >= merges.length) {
				return leafNodes.map((nodeId) => new Set([nodeId]));
			}

			// Apply first mergeIndex merges
			const clusters = new Map<number, Set<string>>();
			for (const [index, nodeId] of leafNodes.entries()) {
				clusters.set(index, new Set([nodeId]));
			}

			for (let index = 0; index < mergeIndex; index++) {
				const merge = merges[index];
				const cluster1 = clusters.get(merge.cluster1);
				const cluster2 = clusters.get(merge.cluster2);

				if (!cluster1 || !cluster2) continue;

				// Merge cluster2 into cluster1
				const newCluster = new Set([...cluster1, ...cluster2]);

				// Remove old clusters
				clusters.delete(merge.cluster1);
				clusters.delete(merge.cluster2);

				// Add new merged cluster with index (n + i)
				clusters.set(n + index, newCluster);
			}

			return [...clusters.values()];
		},
	};
};

/**
 * Perform hierarchical clustering on a graph.
 * @template N - Node type
 * @template E - Edge type
 * @param graph - Input graph (directed or undirected)
 * @param options - Configuration options
 * @param options.linkage - Linkage method: 'single', 'complete', or 'average' (default: 'average')
 * @returns Result containing dendrogram or error
 * @example
 * ```typescript
 * const graph = new Graph<TopicNode, TopicEdge>(false);
 * // ... add nodes and edges ...
 *
 * const result = hierarchicalClustering(graph, { linkage: 'average' });
 * if (result.ok) {
 *   const { dendrogram } = result.value;
 *   const clusters = dendrogram.getClusters(5);
 *   console.log(`Extracted ${clusters.length} clusters`);
 * }
 * ```
 */
export const hierarchicalClustering = <N extends Node, E extends Edge>(graph: Graph<N, E>, options: {
	linkage?: LinkageMethod;
} = {}): HierarchicalResult<string> => {
	const startTime = performance.now();
	const linkage = options.linkage ?? "average";

	// Validate input
	const allNodes = graph.getAllNodes();
	const n = allNodes.length;

	if (n === 0) {
		return Error_({
			type: "EmptyGraph",
			message: "Cannot perform hierarchical clustering on empty graph",
		});
	}

	if (n === 1) {
		// Single node: return trivial dendrogram
		const dendrogram: Dendrogram<string> = {
			merges: [],
			heights: [],
			leafNodes: [allNodes[0].id],
			clusterSizes: [],
			cutAtHeight: () => [new Set([allNodes[0].id])],
			getClusters: () => [new Set([allNodes[0].id])],
		};

		return Ok({
			dendrogram,
			metadata: {
				algorithm: "hierarchical",
				runtime: performance.now() - startTime,
				parameters: { linkage },
			},
		});
	}

	// Build node index map (node ID → index)
	const nodeIndexMap = new Map<string, number>();
	for (const [index, node] of allNodes.entries()) {
		nodeIndexMap.set(node.id, index);
	}

	// Build adjacency matrix
	const adjMatrix = buildAdjacencyMatrix(graph, nodeIndexMap);

	// Compute initial distance matrix
	const distributionMatrix = computeDistanceMatrix(adjMatrix);

	// Initialize clusters (use positive indices 0 to n-1 for leaves)
	const activeClusters = new Set<number>();
	for (let index = 0; index < n; index++) {
		activeClusters.add(index);
	}

	// Track cluster contents and sizes
	const clusterNodes = new Map<number, Set<string>>();
	const clusterSizes = new Map<number, number>();

	for (const [index, node] of allNodes.entries()) {
		clusterNodes.set(index, new Set([node.id]));
		clusterSizes.set(index, 1);
	}

	// Merge history
	const merges: MergeStep[] = [];
	const heights: number[] = [];

	let nextClusterId = n; // Start from n (after leaf nodes 0 to n-1)

	// Agglomerative clustering: merge n-1 times
	for (let step = 0; step < n - 1; step++) {
		// Find closest pair of clusters
		const minPair = distributionMatrix.findMinimum(activeClusters);

		if (!minPair) {
			// Should not happen if graph is connected
			break;
		}

		const [cluster1, cluster2, distance] = minPair;

		// Record merge
		const size1 = clusterSizes.get(cluster1) ?? 1;
		const size2 = clusterSizes.get(cluster2) ?? 1;
		const mergedSize = size1 + size2;

		merges.push({
			cluster1,
			cluster2,
			distance,
			size: mergedSize,
		});
		heights.push(distance);

		// Create new merged cluster
		const newClusterId = nextClusterId++;
		const nodes1 = clusterNodes.get(cluster1) ?? new Set();
		const nodes2 = clusterNodes.get(cluster2) ?? new Set();
		const mergedNodes = new Set([...nodes1, ...nodes2]);

		clusterNodes.set(newClusterId, mergedNodes);
		clusterSizes.set(newClusterId, mergedSize);

		// Update distance matrix
		updateDistances(distributionMatrix, newClusterId, cluster1, cluster2, activeClusters, linkage, clusterSizes);

		// Remove merged clusters and add new cluster
		activeClusters.delete(cluster1);
		activeClusters.delete(cluster2);
		activeClusters.add(newClusterId);
	}

	// Build final dendrogram
	const dendrogram = buildDendrogram(allNodes, merges, heights);

	const endTime = performance.now();

	return Ok({
		dendrogram,
		metadata: {
			algorithm: "hierarchical",
			runtime: endTime - startTime,
			parameters: { linkage },
		},
	});
};
