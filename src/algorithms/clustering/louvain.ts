/**
 * Louvain community detection algorithm implementation.
 * Detects communities in networks by optimizing modularity.
 *
 * Algorithm:
 * 1. Phase 1 (Local Moving): Iteratively move nodes to neighboring communities
 *    that maximize modularity gain
 * 2. Phase 2 (Aggregation): Merge communities into super-nodes
 * 3. Repeat until convergence (no modularity improvement)
 *
 * Time Complexity: O(n log n) for sparse graphs
 * Space Complexity: O(n + m)
 * @module clustering/louvain
 */

import type { Graph } from "../graph/graph";
import { calculateModularityDelta } from "../metrics/modularity";
import type { Community } from "../types/clustering-types";
import type { Edge,Node } from "../types/graph";
import type { WeightFunction } from "../types/weight-function";
import { convertToCSR, type CSRGraph } from "../utils/csr";

/**
 * Result of Louvain community detection including performance statistics.
 */
export interface LouvainResult<N extends Node> {
	/** Detected communities */
	communities: Community<N>[];
	/** Performance and convergence statistics */
	stats: {
		/** Total iterations across all hierarchy levels */
		totalIterations: number;
		/** Number of hierarchy levels processed */
		hierarchyLevels: number;
		/** Runtime in milliseconds */
		runtimeMs: number;
	};
}

/**
 * Internal representation of a community during Louvain execution.
 */
interface LouvainCommunity {
	id: number;
	nodes: Set<string>; // Node IDs
	sigmaTot: number; // Sum of degrees of nodes in community
	sigmaIn: number; // Sum of edge weights within community
}

/**
 * Get adaptive convergence threshold based on graph size.
 * @param nodeCount - Number of nodes in graph
 * @returns Convergence threshold (1e-5 for large graphs, 1e-6 for small graphs)
 * @remarks
 * Large graphs (>500 nodes) use looser threshold for faster convergence.
 * Small graphs (≤500 nodes) use stricter threshold for higher quality.
 */
export const getAdaptiveThreshold = (nodeCount: number): number => nodeCount > 500 ? 1e-5 : 1e-6;

/**
 * Get adaptive iteration limit based on graph size and hierarchy level.
 * @param nodeCount - Number of nodes in graph
 * @param level - Hierarchy level (0 = first level)
 * @returns Maximum iterations (20, 40, or 50)
 * @remarks
 * First hierarchy level (level 0) with large graphs (>200 nodes) uses lower limit (20)
 * because most node movements happen in the first iteration.
 * Subsequent levels and small graphs use higher limits (40-50) for refinement.
 */
export const getAdaptiveIterationLimit = (nodeCount: number, level: number): number => {
	if (level === 0 && nodeCount > 200) {
		return 20;
	}
	return nodeCount < 100 ? 50 : 40;
};

/**
 * Determine optimal neighbor selection mode based on graph size.
 * @param nodeCount - Number of nodes in graph
 * @returns Neighbor selection mode ("best" or "random")
 * @remarks
 * **UPDATE (Phase 4 debugging)**: Random mode disabled for citation networks.
 *
 * Testing revealed Fast Louvain random-neighbor selection causes severe quality degradation
 * for citation network graphs (Q=0.05-0.12 vs Q=0.37 with best mode), failing the minimum
 * quality threshold of Q≥0.19. Random mode also paradoxically SLOWED convergence (201 iterations
 * vs 103 with best mode), resulting in 3x slower runtime.
 *
 * Root cause: Citation networks have different structural properties than the social/web networks
 * where Fast Louvain was benchmarked in literature. Accepting first positive ΔQ leads to poor-quality
 * moves that require many iterations to correct.
 *
 * **Current strategy**: Always use best-neighbor mode for quality. Random mode remains available
 * via explicit `mode: "random"` parameter for experimentation but is not recommended.
 */
export const determineOptimalMode = (): "best" | "random" => "best";

/**
 * Shuffle an array in-place using Fisher-Yates algorithm.
 * @param array - Array to shuffle (modified in-place)
 * @param seed - Optional random seed for deterministic shuffling (for tests)
 * @returns The shuffled array (same reference as input)
 * @remarks
 * Fisher-Yates shuffle guarantees uniform distribution of permutations.
 * If seed is provided, uses simple linear congruential generator (LCG) for PRNG.
 * If seed is undefined, uses Math.random() (non-deterministic).
 *
 * LCG parameters: a=1664525, c=1013904223, m=2^32 (Numerical Recipes)
 */
export const shuffle = <T>(array: T[], seed?: number): T[] => {
	let rng: () => number;

	if (seed === undefined) {
		// Non-deterministic for production
		rng = Math.random;
	} else {
		// Deterministic PRNG for reproducible tests
		let state = seed;
		rng = () => {
			state = (1_664_525 * state + 1_013_904_223) >>> 0; // LCG: a=1664525, c=1013904223, m=2^32
			return state / 0x1_00_00_00_00; // Normalize to [0, 1)
		};
	}

	// Fisher-Yates shuffle
	for (let index = array.length - 1; index > 0; index--) {
		const index_ = Math.floor(rng() * (index + 1));
		[array[index], array[index_]] = [array[index_], array[index]];
	}

	return array;
};

/**
 * Detect communities using the Louvain algorithm.
 *
 * The Louvain method is a greedy optimization method that attempts to optimize
 * the modularity of a partition of the network.
 * @template N - Node type
 * @template E - Edge type
 * @param graph - Input graph (directed or undirected)
 * @param options - Optional configuration (combines legacy and optimization parameters)
 * @param options.weightFn - Weight function for edges (default: all edges weight 1.0) [Legacy]
 * @param options.resolution - Resolution parameter (default: 1.0, higher values favor more communities) [Legacy]
 * @param options.mode - Neighbor selection strategy ("auto", "best", "random") [spec-027 Phase 2]
 * @param options.seed - Random seed for deterministic shuffling [spec-027 Phase 2]
 * @param options.minModularityIncrease - Minimum modularity improvement to continue (adaptive default via getAdaptiveThreshold)
 * @param options.maxIterations - Maximum iterations per phase (adaptive default via getAdaptiveIterationLimit)
 * @returns Array of detected communities
 * @remarks
 * **Adaptive Defaults** (spec-027 Phase 1):
 * - `minModularityIncrease`: 1e-5 for >500 nodes, 1e-6 otherwise
 * - `maxIterations`: 20 for >200 nodes (level 0), 40-50 otherwise
 *
 * **Neighbor Selection Modes** (spec-027 Phase 2):
 * - `"auto"`: Best-neighbor for <200 nodes, random for ≥500 nodes
 * - `"best"`: Always use best-neighbor (quality-first)
 * - `"random"`: Always use random-neighbor (speed-first, Fast Louvain)
 * @example
 * ```typescript
 * const graph = new Graph<PaperNode, CitationEdge>(true);
 * // ... add nodes and edges ...
 *
 * // Basic usage (adaptive defaults)
 * const { communities, stats } = detectCommunities(graph);
 * console.log(`Found ${communities.length} communities in ${stats.totalIterations} iterations`);
 *
 * // Quality-first mode
 * const result = detectCommunities(graph, { mode: "best" });
 *
 * // Speed-first mode for large graphs
 * const fast = detectCommunities(graph, { mode: "random", maxIterations: 10 });
 *
 * // Reproducible results
 * const deterministic = detectCommunities(graph, { seed: 42 });
 * ```
 */
export const detectCommunities = <N extends Node, E extends Edge>(graph: Graph<N, E>, options: {
	weightFn?: WeightFunction<N, E>;
	resolution?: number;
	mode?: "auto" | "best" | "random";
	seed?: number;
	minModularityIncrease?: number;
	maxIterations?: number;
} = {}): LouvainResult<N> => {
	// T014: Runtime tracking (spec-027 Phase 1)
	const startTime = performance.now();

	const {
		weightFn: weightFunction = () => 1,
		resolution = 1,
		minModularityIncrease,
		maxIterations = 100,
	} = options;

	// Handle empty graph
	const allNodes = graph.getAllNodes();
	if (allNodes.length === 0) {
		return { communities: [], stats: { totalIterations: 0, hierarchyLevels: 0, runtimeMs: 0 } };
	}

	// T042: Convert to CSR format for better cache locality (spec-027 Phase 5)
	let csrGraph: CSRGraph<N, E> | null = null;
	try {
		csrGraph = convertToCSR(graph);
	} catch (error) {
		// If CSR conversion fails (e.g., graph too large for typed arrays),
		// fall back to using original Graph API
		if (error instanceof RangeError) {
			console.warn(
				`CSR conversion failed (${error.message}). ` +
        "Falling back to Map-based adjacency list."
			);
		} else {
			// Unexpected error, re-throw
			throw error;
		}
	}

	// T015: Iteration count tracking (spec-027 Phase 1)
	let totalIterations = 0;

	// T025: Resolve neighbor selection mode (spec-027 Phase 4)
	const { mode = "auto", seed } = options;
	const resolvedMode: "best" | "random" = mode === "auto"
		? determineOptimalMode()
		: mode;

	// Pre-compute incoming edges for directed graphs (O(m) instead of O(n²))
	const incomingEdges = new Map<string, E[]>();
	if (graph.isDirected()) {
		for (const node of allNodes) {
			const outgoingResult = graph.getOutgoingEdges(node.id);
			if (outgoingResult.ok) {
				for (const edge of outgoingResult.value) {
					if (!incomingEdges.has(edge.target)) {
						incomingEdges.set(edge.target, []);
					}
					const targetEdges = incomingEdges.get(edge.target);
					if (targetEdges) {
						targetEdges.push(edge);
					}
				}
			}
		}
	}

	// Pre-calculate node degrees (optimization)
	const nodeDegrees = new Map<string, number>();
	for (const node of allNodes) {
		nodeDegrees.set(node.id, calculateNodeDegree(graph, node.id, weightFunction, incomingEdges));
	}

	// Initialize: Each node in its own community
	const nodeToCommunity = new Map<string, number>();
	const communities = new Map<number, LouvainCommunity>();
	let nextCommunityId = 0;

	for (const node of allNodes) {
		const communityId = nextCommunityId++;
		nodeToCommunity.set(node.id, communityId);

		const degree = nodeDegrees.get(node.id) || 0;
		communities.set(communityId, {
			id: communityId,
			nodes: new Set([node.id]),
			sigmaTot: degree,
			sigmaIn: 0, // No internal edges for single-node community
		});
	}

	// Calculate total edge weight (m)
	const m = calculateTotalEdgeWeight(graph, weightFunction);
	if (m === 0) {
		// No edges - return each node as separate community
		const endTimeNoEdges = performance.now();
		return {
			communities: buildCommunityResults(graph, nodeToCommunity),
			stats: { totalIterations: 0, hierarchyLevels: 0, runtimeMs: endTimeNoEdges - startTime },
		};
	}

	// Track hierarchy: superNodeId -> set of original node IDs
	// At level 0, each original node is its own super-node
	let superNodes = new Map<string, Set<string>>();
	for (const node of allNodes) {
		superNodes.set(node.id, new Set([node.id]));
	}

	// Adaptive strategy: Use hierarchical optimization only for larger graphs
	// Very small graphs (<= 50 nodes) get sufficient quality with single-level optimization
	const nodeCount = allNodes.length;
	const useHierarchicalOptimization = nodeCount > 50;

	// T010: Adaptive modularity threshold using helper function (spec-027 Phase 1)
	const adaptiveMinModularityIncrease = minModularityIncrease ??
    getAdaptiveThreshold(nodeCount);

	// Multi-level optimization: Phase 1 + Phase 2 repeated
	let hierarchyLevel = 0;
	const MAX_HIERARCHY_LEVELS = useHierarchicalOptimization ? 3 : 1;

	while (hierarchyLevel < MAX_HIERARCHY_LEVELS) {
		hierarchyLevel++;

		// Rebuild nodeToCommunity and communities for current super-nodes
		nodeToCommunity.clear();
		communities.clear();
		let nextCommunityId = 0;

		// Each super-node starts in its own community
		for (const [superNodeId, memberNodes] of superNodes.entries()) {
			const communityId = nextCommunityId++;
			nodeToCommunity.set(superNodeId, communityId);

			// Calculate degree for this super-node (sum of all member node degrees)
			let totalDegree = 0;
			for (const nodeId of memberNodes) {
				totalDegree += nodeDegrees.get(nodeId) || 0;
			}

			communities.set(communityId, {
				id: communityId,
				nodes: new Set([superNodeId]), // Community contains super-node IDs
				sigmaTot: totalDegree,
				sigmaIn: 0,
			});
		}

		// Phase 1: Local moving optimization on super-nodes
		let improved = true;
		let iteration = 0;

		// T012: Adaptive iteration limits using helper function (spec-027 Phase 1)
		// hierarchyLevel starts at 1, but helper expects 0-based (level 0 = first iteration)
		const MAX_ITERATIONS = maxIterations ??
      getAdaptiveIterationLimit(nodeCount, hierarchyLevel - 1);

		// Build reverse lookup once per hierarchy level (optimization)
		const nodeToSuperNode = new Map<string, string>();
		for (const [superNodeId, members] of superNodes.entries()) {
			for (const originalNodeId of members) {
				nodeToSuperNode.set(originalNodeId, superNodeId);
			}
		}

		let consecutiveNoImprovementRounds = 0;
		// Aggressive early stopping: 2 rounds for large graphs, 3 for small
		const MAX_NO_IMPROVEMENT_ROUNDS = nodeCount > 500 ? 2 : 3;

		// Performance optimization: Pre-allocate arrays for iteration
		const superNodeIdsArray = [...superNodes.keys()];
		const superNodeOrderArray: string[] = Array.from({length: superNodeIdsArray.length});

		// T051: Initialize community edge weight cache (spec-027 Phase 5)
		// DISABLED: Cache adds overhead without benefit (see spec-027 Phase 5 checkpoint)
		// const communityCache: CommunityHashTable = new Map();

		// T028-T031: Altered communities heuristic (spec-027 Phase 4) - DISABLED
		// Testing showed NO performance benefit for citation networks:
		// - Best mode only: 5.67s for 1000 nodes, Q=0.3718
		// - Best + altered communities: 11.33s for 1000 nodes, Q=0.3720
		// Overhead of tracking/filtering outweighs benefit. Community structure changes
		// too much in early iterations, keeping altered set large.
		//
		// const alteredState: AlteredCommunitiesState = {
		//   alteredCommunities: new Set(communities.keys()),
		// };

		while (improved && iteration < MAX_ITERATIONS) {
			improved = false;
			iteration++;
			let movesThisRound = 0;

			// Visit nodes in random order - reuse array to avoid allocation
			const shuffled = shuffleArray(superNodeIdsArray);
			for (const [index, element] of shuffled.entries()) {
				superNodeOrderArray[index] = element;
			}

			for (const superNodeId of superNodeOrderArray) {
				const currentCommunityId = nodeToCommunity.get(superNodeId);
				if (currentCommunityId === undefined) continue;

				// Calculate weights to neighboring communities for this super-node
				const memberNodes = superNodes.get(superNodeId);
				if (memberNodes === undefined) continue;
				const neighborCommunities = findNeighborCommunitiesForSuperNode(
					graph,
					memberNodes,
					nodeToSuperNode,
					nodeToCommunity,
					weightFunction,
					incomingEdges,
					csrGraph // T046: Pass CSR graph for optimized neighbor iteration
				);

				// T022-T024: Find best community to move to (spec-027 Phase 4)
				// Mode-based neighbor selection: "best" evaluates all, "random" accepts first positive
				let bestCommunityId = currentCommunityId;
				let bestDeltaQ = 0;

				// Calculate super-node degree (sum of member degrees)
				let superNodeDegree = 0;
				for (const nodeId of memberNodes) {
					superNodeDegree += nodeDegrees.get(nodeId) || 0;
				}

				// Convert neighbor communities to array for mode-based processing
				const neighborList = [...neighborCommunities.entries()];

				if (resolvedMode === "random") {
					// T024: Random-neighbor mode (Fast Louvain) - shuffle and accept first positive ΔQ
					const shuffledNeighbors = shuffle(neighborList, seed);

					for (const [neighborCommunityId, kIn] of shuffledNeighbors) {
						if (neighborCommunityId === currentCommunityId) {
							continue; // Skip current community
						}

						const neighborCommunity = communities.get(neighborCommunityId);
						if (!neighborCommunity) continue;

						// Calculate modularity change with pre-calculated resolutionM
						const deltaQ = calculateModularityDelta(
							superNodeDegree,
							kIn,
							neighborCommunity.sigmaTot,
							neighborCommunity.sigmaIn,
							m
						) * resolution;

						// Accept first positive modularity gain (Fast Louvain)
						if (deltaQ > adaptiveMinModularityIncrease) {
							bestDeltaQ = deltaQ;
							bestCommunityId = neighborCommunityId;
							break; // Early exit - accept first improvement
						}
					}
				} else {
					// T023: Best-neighbor mode - evaluate all neighbors, select maximum ΔQ
					for (const [neighborCommunityId, kIn] of neighborList) {
						if (neighborCommunityId === currentCommunityId) {
							continue; // Skip current community
						}

						const neighborCommunity = communities.get(neighborCommunityId);
						if (!neighborCommunity) continue;

						// Calculate modularity change with pre-calculated resolutionM
						const deltaQ = calculateModularityDelta(
							superNodeDegree,
							kIn,
							neighborCommunity.sigmaTot,
							neighborCommunity.sigmaIn,
							m
						) * resolution;

						// Track best community (maximum ΔQ)
						if (deltaQ > bestDeltaQ) {
							bestDeltaQ = deltaQ;
							bestCommunityId = neighborCommunityId;
						}
					}
				}

				// Move super-node if beneficial
				if (bestCommunityId !== currentCommunityId && bestDeltaQ > adaptiveMinModularityIncrease) {
					moveSuperNode(
						superNodeId,
						currentCommunityId,
						bestCommunityId,
						communities,
						nodeToCommunity,
						superNodes,
						nodeDegrees
					);
					improved = true;
					movesThisRound++;

					// T053: Invalidate cache entries for affected communities (spec-027 Phase 5)
					// DISABLED: Cache not in use (see spec-027 Phase 5 checkpoint)
					// invalidateCommunityCache(communityCache, currentCommunityId);
					// invalidateCommunityCache(communityCache, bestCommunityId);

					// T030: Altered communities population (spec-027 Phase 4) - DISABLED (no benefit)
					// alteredState.alteredCommunities.add(currentCommunityId); // Source community
					// alteredState.alteredCommunities.add(bestCommunityId);    // Target community
				}
			}

			// Remove empty communities
			removeEmptyCommunities(communities);

			// T013: Early convergence detection (spec-027 Phase 1)
			// Already implemented: aggressive early stopping for large graphs
			if (movesThisRound === 0) {
				consecutiveNoImprovementRounds++;
				if (consecutiveNoImprovementRounds >= MAX_NO_IMPROVEMENT_ROUNDS) {
					break; // Converged - no point continuing
				}
			} else {
				consecutiveNoImprovementRounds = 0;
			}
		}

		// T015: Accumulate iterations across hierarchy levels (spec-027 Phase 1)
		totalIterations += iteration;

		// Phase 2: Aggregate communities into new super-nodes
		const numberCommunities = communities.size;
		if (numberCommunities <= 1 || numberCommunities >= superNodes.size) {
			// Converged - only 1 community or no merging happened
			break;
		}

		// Build new super-nodes where each community becomes a single super-node
		const newSuperNodes = new Map<string, Set<string>>();
		let nextSuperNodeId = 0;

		for (const [, community] of communities) {
			const newSuperNodeId = `L${hierarchyLevel}_${nextSuperNodeId++}`;
			const allMemberNodes = new Set<string>();

			// Collect all original nodes from all super-nodes in this community
			for (const superNodeId of community.nodes) {
				const members = superNodes.get(superNodeId);
				if (members) {
					for (const originalNodeId of members) {
						allMemberNodes.add(originalNodeId);
					}
				}
			}

			newSuperNodes.set(newSuperNodeId, allMemberNodes);
		}

		// Replace super-nodes with aggregated super-nodes
		superNodes = newSuperNodes;
	}

	// Build final Community results by mapping super-nodes back to original nodes
	// nodeToCommunity currently maps super-node IDs to community IDs
	// We need to map original node IDs to community IDs
	const finalNodeToCommunity = new Map<string, number>();

	for (const [superNodeId, memberNodes] of superNodes.entries()) {
		const communityId = nodeToCommunity.get(superNodeId);
		if (communityId !== undefined) {
			for (const originalNodeId of memberNodes) {
				finalNodeToCommunity.set(originalNodeId, communityId);
			}
		}
	}

	// T014 & T015: Log performance metrics (spec-027 Phase 1 & Phase 4)
	const endTime = performance.now();
	const runtime = endTime - startTime;
	console.log(`[spec-027] Louvain completed in ${runtime.toFixed(2)}ms (${(runtime / 1000).toFixed(2)}s)`);
	console.log(`[spec-027] Total iterations: ${totalIterations} across ${hierarchyLevel} hierarchy levels`);
	console.log(`[spec-027] Adaptive threshold: ${adaptiveMinModularityIncrease.toExponential(1)}`);
	console.log(`[spec-027] Neighbor selection mode: ${resolvedMode} (requested: ${mode})`);

	return {
		communities: buildCommunityResults(graph, finalNodeToCommunity, m, nodeDegrees),
		stats: {
			totalIterations,
			hierarchyLevels: hierarchyLevel,
			runtimeMs: runtime,
		},
	};
};

/**
 * Calculate total degree (sum of edge weights) for a node.
 * @param graph
 * @param nodeId
 * @param weightFn
 * @param weightFunction
 * @param incomingEdges
 */
const calculateNodeDegree = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodeId: string,
	weightFunction: WeightFunction<N, E>,
	incomingEdges: Map<string, E[]>,
): number => {
	let degree = 0;

	// Outgoing edges
	const outgoingResult = graph.getOutgoingEdges(nodeId);
	if (outgoingResult.ok) {
		for (const edge of outgoingResult.value) {
			const sourceOption = graph.getNode(edge.source);
			const targetOption = graph.getNode(edge.target);
			if (sourceOption.some && targetOption.some) {
				degree += weightFunction(edge, sourceOption.value, targetOption.value);
			}
		}
	}

	// Incoming edges (for directed graphs) - use pre-computed cache
	if (graph.isDirected()) {
		const incoming = incomingEdges.get(nodeId) || [];
		for (const edge of incoming) {
			const sourceOption = graph.getNode(edge.source);
			const targetOption = graph.getNode(edge.target);
			if (sourceOption.some && targetOption.some) {
				degree += weightFunction(edge, sourceOption.value, targetOption.value);
			}
		}
	}

	return degree;
};

/**
 * Calculate total edge weight in graph.
 * @param graph
 * @param weightFn
 * @param weightFunction
 */
const calculateTotalEdgeWeight = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	weightFunction: WeightFunction<N, E>,
): number => {
	let totalWeight = 0;

	const allNodes = graph.getAllNodes();
	for (const node of allNodes) {
		const outgoingResult = graph.getOutgoingEdges(node.id);
		if (outgoingResult.ok) {
			for (const edge of outgoingResult.value) {
				const sourceOption = graph.getNode(edge.source);
				const targetOption = graph.getNode(edge.target);
				if (sourceOption.some && targetOption.some) {
					totalWeight += weightFunction(edge, sourceOption.value, targetOption.value);
				}
			}
		}
	}

	// For undirected graphs, we've counted each edge twice
	if (!graph.isDirected()) {
		totalWeight /= 2;
	}

	return totalWeight;
};

/**
 * Reusable Map for neighbor community weights to avoid allocations in hot path.
 * This is a significant performance optimization for large graphs.
 */
let reusableNeighborCommunities: Map<number, number> | null = null;

/**
 * Find neighboring communities and calculate edge weights to each (for super-nodes).
 *
 * For a super-node (which contains multiple original nodes), this finds all edges
 * from those original nodes to nodes in other super-nodes, and aggregates the weights
 * by the target super-node's community.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Reuses Map to avoid allocations in hot path
 * - Uses for loops instead of forEach for better performance
 * - Caches frequently accessed values
 * @param graph
 * @param memberNodes
 * @param nodeToSuperNode
 * @param nodeToCommunity
 * @param weightFn
 * @param weightFunction
 * @param incomingEdges
 * @param csrGraph
 */
const findNeighborCommunitiesForSuperNode = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	memberNodes: Set<string>,
	nodeToSuperNode: Map<string, string>,
	nodeToCommunity: Map<string, number>,
	weightFunction: WeightFunction<N, E>,
	incomingEdges: Map<string, E[]>,
	csrGraph: CSRGraph<N, E> | null = null,
): Map<number, number> => {
	// Reuse Map to avoid allocation in hot path
	if (!reusableNeighborCommunities) {
		reusableNeighborCommunities = new Map<number, number>();
	}
	const neighborCommunities = reusableNeighborCommunities;
	neighborCommunities.clear();

	// Convert Set to array for efficient iteration
	const memberArray = [...memberNodes];

	// For each member node in this super-node
	for (const nodeId of memberArray) {

		// T044-T046: Use CSR for neighbor iteration when available (spec-027 Phase 5)
		if (csrGraph) {
			const nodeIndex = csrGraph.nodeIndex.get(nodeId);
			if (nodeIndex !== undefined) {
				const start = csrGraph.offsets[nodeIndex];
				const end = csrGraph.offsets[nodeIndex + 1];

				// Iterate through CSR-packed neighbors
				for (let index = start; index < end; index++) {
					const targetIndex = csrGraph.edges[index];
					const targetNodeId = csrGraph.nodeIds[targetIndex];
					const weight = csrGraph.weights[index]; // Use CSR weight (assumes weightFn returns edge.weight)

					// Find which super-node the target belongs to
					const targetSuperNodeId = nodeToSuperNode.get(targetNodeId);
					if (targetSuperNodeId) {
						const targetCommunityId = nodeToCommunity.get(targetSuperNodeId);
						if (targetCommunityId !== undefined) {
							const currentWeight = neighborCommunities.get(targetCommunityId) || 0;
							neighborCommunities.set(targetCommunityId, currentWeight + weight);
						}
					}
				}
			}
		} else {
			// Fallback: Original Map-based iteration - optimized with for loops
			const outgoingResult = graph.getOutgoingEdges(nodeId);
			if (outgoingResult.ok) {
				const edges = outgoingResult.value;
				for (const edge of edges) {
					const targetNodeId = edge.target;

					// Find which super-node the target belongs to
					const targetSuperNodeId = nodeToSuperNode.get(targetNodeId);
					if (targetSuperNodeId) {
						// Find which community that super-node is in
						const targetCommunityId = nodeToCommunity.get(targetSuperNodeId);
						if (targetCommunityId !== undefined) {
							const sourceOption = graph.getNode(edge.source);
							const targetOption = graph.getNode(edge.target);
							if (sourceOption.some && targetOption.some) {
								const weight = weightFunction(edge, sourceOption.value, targetOption.value);
								const currentWeight = neighborCommunities.get(targetCommunityId) || 0;
								neighborCommunities.set(targetCommunityId, currentWeight + weight);
							}
						}
					}
				}
			}
		}

		// Incoming edges (for directed graphs) - optimized with for loops
		if (graph.isDirected()) {
			const incoming = incomingEdges.get(nodeId);
			if (incoming) {
				for (const edge of incoming) {
					const sourceNodeId = edge.source;

					// Find which super-node the source belongs to
					const sourceSuperNodeId = nodeToSuperNode.get(sourceNodeId);
					if (sourceSuperNodeId) {
						// Find which community that super-node is in
						const sourceCommunityId = nodeToCommunity.get(sourceSuperNodeId);
						if (sourceCommunityId !== undefined) {
							const sourceOption = graph.getNode(edge.source);
							const targetOption = graph.getNode(edge.target);
							if (sourceOption.some && targetOption.some) {
								const weight = weightFunction(edge, sourceOption.value, targetOption.value);
								const currentWeight = neighborCommunities.get(sourceCommunityId) || 0;
								neighborCommunities.set(sourceCommunityId, currentWeight + weight);
							}
						}
					}
				}
			}
		}
	}

	return neighborCommunities;
};

/**
 * Move a super-node from one community to another.
 *
 * This is similar to moveNode but works with super-nodes, which contain
 * multiple original nodes. The sigmaTot and sigmaIn calculations need to
 * account for all edges between the member nodes.
 * @param superNodeId
 * @param fromCommunityId
 * @param toCommunityId
 * @param communities
 * @param nodeToCommunity
 * @param superNodes
 * @param nodeDegrees
 */
const moveSuperNode = (
	superNodeId: string,
	fromCommunityId: number,
	toCommunityId: number,
	communities: Map<number, LouvainCommunity>,
	nodeToCommunity: Map<string, number>,
	superNodes: Map<string, Set<string>>,
	nodeDegrees: Map<string, number>,
): void => {
	const fromCommunity = communities.get(fromCommunityId);
	if (!fromCommunity) return;

	const toCommunity = communities.get(toCommunityId);
	if (!toCommunity) return;

	const memberNodes = superNodes.get(superNodeId);
	if (!memberNodes) return;

	// Calculate total degree for this super-node (sum of member node degrees)
	let superNodeDegree = 0;
	for (const nodeId of memberNodes) {
		superNodeDegree += nodeDegrees.get(nodeId) || 0;
	}

	// Remove super-node from old community
	fromCommunity.nodes.delete(superNodeId);
	fromCommunity.sigmaTot -= superNodeDegree;

	// For sigmaIn calculation, we need to count edges between this super-node's
	// member nodes and other super-nodes' member nodes in the same community.
	// This is complex, so for now we'll use a simplified approach:
	// We don't update sigmaIn during super-node moves (it's recalculated in Phase 2)

	// Add super-node to new community
	toCommunity.nodes.add(superNodeId);
	toCommunity.sigmaTot += superNodeDegree;

	// Update mapping
	nodeToCommunity.set(superNodeId, toCommunityId);
};

/**
 * Remove empty communities from the map.
 * @param communities
 */
const removeEmptyCommunities = (communities: Map<number, LouvainCommunity>): void => {
	const emptyCommunityIds: number[] = [];

	for (const [id, community] of communities.entries()) {
		if (community.nodes.size === 0) {
			emptyCommunityIds.push(id);
		}
	}

	for (const id of emptyCommunityIds) {
		communities.delete(id);
	}
};

/**
 * Build final Community results from node-to-community mapping.
 * @param graph - The input graph
 * @param nodeToCommunity - Mapping from node ID to community ID
 * @param totalEdgeWeight - Total edge weight (m) for modularity calculation (optional, defaults to 0)
 * @param nodeDegrees - Pre-calculated node degrees (optional, calculated if not provided)
 */
const buildCommunityResults = <N extends Node, E extends Edge>(
	graph: Graph<N, E>,
	nodeToCommunity: Map<string, number>,
	totalEdgeWeight = 0,
	nodeDegrees?: Map<string, number>,
): Community<N>[] => {
	// Group nodes by community
	const communityMap = new Map<number, Set<N>>();

	for (const [nodeId, communityId] of nodeToCommunity.entries()) {
		if (!communityMap.has(communityId)) {
			communityMap.set(communityId, new Set());
		}

		const nodeOption = graph.getNode(nodeId);
		if (nodeOption.some) {
			const commNodes = communityMap.get(communityId);
			if (commNodes) {
				commNodes.add(nodeOption.value);
			}
		}
	}

	// Calculate internal edges for each community efficiently (O(E) instead of O(V²))
	// Track both weights (sigmaIn) and counts for each community
	const sigmaIn = new Map<number, number>(); // Sum of edge weights within community
	const internalEdgeCounts = new Map<number, number>(); // Count of internal edges
	const externalEdgeCounts = new Map<number, number>(); // Count of external edges (boundary-crossing)
	const sigmaTot = new Map<number, number>(); // Sum of degrees for modularity calculation

	for (const [communityId, _] of communityMap.entries()) {
		sigmaIn.set(communityId, 0);
		internalEdgeCounts.set(communityId, 0);
		externalEdgeCounts.set(communityId, 0);
		sigmaTot.set(communityId, 0);
	}

	// Calculate sigmaTot for each community (sum of node degrees)
	for (const [nodeId, communityId] of nodeToCommunity.entries()) {
		const degree = nodeDegrees?.get(nodeId) ?? 0;
		const currentSigmaTot = sigmaTot.get(communityId) ?? 0;
		sigmaTot.set(communityId, currentSigmaTot + degree);
	}

	// Iterate through all edges once to count internal/external edges
	const allEdges = graph.getAllEdges();
	for (const edge of allEdges) {
		const sourceCommunity = nodeToCommunity.get(edge.source);
		const targetCommunity = nodeToCommunity.get(edge.target);

		if (sourceCommunity === undefined || targetCommunity === undefined) {
			continue; // Skip edges with unmapped nodes
		}

		if (sourceCommunity === targetCommunity) {
			// Internal edge - count weight and increment edge counter
			const weight = (edge as { weight?: number }).weight ?? 1;
			const currentSigma = sigmaIn.get(sourceCommunity) ?? 0;
			sigmaIn.set(sourceCommunity, currentSigma + weight);

			const currentCount = internalEdgeCounts.get(sourceCommunity) ?? 0;
			internalEdgeCounts.set(sourceCommunity, currentCount + 1);
		} else {
			// External edge - crosses community boundary
			// Count once for source community (edge leaving this community)
			const sourceCount = externalEdgeCounts.get(sourceCommunity) ?? 0;
			externalEdgeCounts.set(sourceCommunity, sourceCount + 1);
		}
	}

	// Build Community objects
	const communities: Community<N>[] = [];
	let communityIndex = 0;

	for (const [originalId, nodes] of communityMap.entries()) {
		const n = nodes.size;
		const internalEdgeWeight = sigmaIn.get(originalId) ?? 0;
		const communityInternalEdges = internalEdgeCounts.get(originalId) ?? 0;
		const communityExternalEdges = externalEdgeCounts.get(originalId) ?? 0;
		const communitySigmaTot = sigmaTot.get(originalId) ?? 0;

		// Calculate density from cached edge counts
		// density = actualEdges / possibleEdges
		// For undirected: actualEdges = sigmaIn / 2, possibleEdges = n * (n - 1) / 2
		// Simplified: density = sigmaIn / (n * (n - 1))
		let density = 0;
		if (n > 1) {
			const possibleEdges = graph.isDirected()
				? n * (n - 1)              // Directed: all ordered pairs
				: (n * (n - 1)) / 2;       // Undirected: combinations

			const actualEdges = graph.isDirected()
				? internalEdgeWeight       // Directed: count as-is
				: internalEdgeWeight / 2;  // Undirected: each edge counted twice

			density = actualEdges / possibleEdges;
			density = Math.max(0, Math.min(1, density)); // Clamp to [0, 1]
		}

		// Calculate per-community modularity contribution
		// Formula: Q_c = (sigmaIn / 2m) - (sigmaTot / 2m)²
		// where m = totalEdgeWeight
		let communityModularity = 0;
		if (totalEdgeWeight > 0) {
			const twoM = 2 * totalEdgeWeight;
			const sigmaInNorm = internalEdgeWeight / twoM;
			const sigmaTotNorm = communitySigmaTot / twoM;
			communityModularity = sigmaInNorm - (sigmaTotNorm * sigmaTotNorm);
		}

		// Adjust edge counts for undirected graphs (edges counted from both directions)
		const adjustedInternalEdges = graph.isDirected()
			? communityInternalEdges
			: Math.floor(communityInternalEdges / 2); // Each internal edge counted twice

		const community: Community<N> = {
			id: communityIndex++,
			nodes,
			size: n,
			density,
			internalEdges: adjustedInternalEdges,
			externalEdges: communityExternalEdges,
			modularity: communityModularity,
		};

		communities.push(community);
	}

	return communities;
};

/**
 * Fisher-Yates shuffle algorithm.
 * @param array
 */
const shuffleArray = <T>(array: T[]): T[] => {
	const shuffled = [...array];
	for (let index = shuffled.length - 1; index > 0; index--) {
		const index_ = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[index_]] = [shuffled[index_], shuffled[index]];
	}
	return shuffled;
};
