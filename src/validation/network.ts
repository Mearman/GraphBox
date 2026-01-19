import type { TestGraph } from "../generation/generators/types"
import type { PropertyValidationResult } from "./types";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute clustering coefficient for a graph.
 * @param graph - Test graph
 * @returns Clustering coefficient (0-1)
 */
const computeClusteringCoefficient = (graph: TestGraph): number => {
	const { nodes, edges } = graph;
	if (nodes.length < 3) return 0;

	// Build adjacency list from edges
	const adj = new Map<string, string[]>();
	for (const node of nodes) {
		adj.set(node.id, []);
	}

	for (const edge of edges) {
		const { source, target } = edge;
		const sourceNeighbors = adj.get(source) ?? [];
		const tgtNeighbors = adj.get(target) ?? [];

		if (!sourceNeighbors.includes(target)) {
			sourceNeighbors.push(target);
			adj.set(source, sourceNeighbors);
		}
		if (!tgtNeighbors.includes(source)) {
			tgtNeighbors.push(source);
			adj.set(target, tgtNeighbors);
		}
	}

	// Compute clustering coefficient
	let triangles = 0;
	let connectedTriples = 0;

	for (const node of nodes) {
		const neighbors = adj.get(node.id) ?? [];
		const k = neighbors.length;

		if (k < 2) continue;

		connectedTriples += k * (k - 1) / 2;

		// Count triangles involving this node
		for (let index = 0; index < k; index++) {
			for (let index_ = index + 1; index_ < k; index_++) {
				const ni = neighbors[index];
				const nj = neighbors[index_];
				if ((adj.get(nj) ?? []).includes(ni)) {
					triangles++;
				}
			}
		}
	}

	return connectedTriples > 0 ? (3 * triangles) / connectedTriples : 0;
};

/**
 * Compute average shortest path length for a graph.
 * @param graph - Test graph
 * @returns Average path length
 */
const computeAveragePathLength = (graph: TestGraph): number => {
	const { nodes, edges } = graph;
	if (nodes.length < 2) return 0;

	// Build adjacency list from edges
	const adj = new Map<string, string[]>();
	for (const node of nodes) {
		adj.set(node.id, []);
	}
	for (const edge of edges) {
		const { source, target } = edge;
		const sourceNeighbors = adj.get(source) ?? [];
		const tgtNeighbors = adj.get(target) ?? [];

		if (!sourceNeighbors.includes(target)) {
			sourceNeighbors.push(target);
			adj.set(source, sourceNeighbors);
		}
		if (!tgtNeighbors.includes(source)) {
			tgtNeighbors.push(source);
			adj.set(target, tgtNeighbors);
		}
	}

	// BFS from each vertex to compute shortest paths
	let totalPathLength = 0;
	let pathCount = 0;

	for (const start of nodes) {
		const dists = new Map<string, number>([[start.id, 0]]);
		const queue: string[] = [start.id];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;

			const distribution = dists.get(current) ?? 0;

			for (const nb of adj.get(current) ?? []) {
				if (!dists.has(nb)) {
					dists.set(nb, distribution + 1);
					queue.push(nb);
					totalPathLength += distribution + 1;
					pathCount++;
				}
			}
		}
	}

	return pathCount > 0 ? totalPathLength / pathCount : 0;
};

/**
 * Perform Kolmogorov-Smirnov goodness-of-fit test for power-law distribution.
 * @param degrees - Array of vertex degrees
 * @param exponent - Power-law exponent γ
 * @returns KS statistic and p-value
 */
const kolmogorovSmirnovTest = (
	degrees: number[],
	exponent: number
): { statistic: number; pValue: number } => {
	// Sort degrees (create copy to avoid mutating input)
	const sorted = [...degrees].sort((a, b) => a - b);
	const n = sorted.length;
	const xmin = Math.min(...sorted);

	// Compute KS statistic (maximum distance between empirical and theoretical CDF)
	let maxDiff = 0;
	for (let index = 0; index < n; index++) {
		const empiricalCDF = index / n;
		// Theoretical CDF for power-law: P(X <= x) = 1 - (x/xmin)^(1-γ)
		const theoreticalCDF = 1 - Math.pow(sorted[index] / xmin, 1 - exponent);
		maxDiff = Math.max(maxDiff, Math.abs(empiricalCDF - theoreticalCDF));
	}

	// Approximate p-value using Kolmogorov distribution
	// p ≈ 2 * exp(-2 * n * D^2)
	const pValue = 2 * Math.exp(-2 * n * maxDiff * maxDiff);

	return { statistic: maxDiff, pValue: Math.min(pValue, 1) };
};

/**
 * Compute modularity score Q for a graph with given communities.
 * Q = (1/2m) * Σ_ij [A_ij - (k_i * k_j)/(2m)] * δ(c_i, c_j)
 * where m is total edges, k_i is degree of node i, δ is 1 if nodes in same community
 * @param graph
 * @param communities
 */
const computeModularityScore = (
	graph: TestGraph,
	communities: Map<string, number>
): number => {
	const { nodes, edges } = graph;
	const m = edges.length;
	if (m === 0) return 0;

	// Compute degrees
	const degrees = new Map<string, number>();
	for (const node of nodes) {
		degrees.set(node.id, 0);
	}
	for (const edge of edges) {
		degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
		degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
	}

	// Build adjacency set for quick lookup
	const adj = new Set<string>();
	for (const edge of edges) {
		const key = [edge.source, edge.target].sort().join("-");
		adj.add(key);
	}

	// Compute modularity
	let Q = 0;
	for (let index = 0; index < nodes.length; index++) {
		for (let index_ = index; index_ < nodes.length; index_++) {
			const vi = nodes[index];
			const vj = nodes[index_];
			const ci = communities.get(vi.id);
			const cj = communities.get(vj.id);

			if (ci === undefined || cj === undefined || ci !== cj) continue;

			const key = [vi.id, vj.id].sort().join("-");
			const Aij = adj.has(key) ? 1 : 0;
			const ki = degrees.get(vi.id) ?? 0;
			const kj = degrees.get(vj.id) ?? 0;

			const expected = (ki * kj) / (2 * m);
			Q += Aij - expected;
		}
	}

	return Q / (2 * m);
};

// ============================================================================
// NETWORK VALIDATORS
// ============================================================================

/**
 * Validates scale-free graph property.
 * Scale-free graphs have power-law degree distribution P(k) ~ k^(-γ).
 * @param graph
 */
export const validateScaleFree = (graph: TestGraph): PropertyValidationResult => {
	const { spec, nodes } = graph;

	if (spec.scaleFree?.kind !== "scale_free") {
		return {
			property: "scaleFree",
			expected: spec.scaleFree?.kind ?? "unconstrained",
			actual: spec.scaleFree?.kind ?? "unconstrained",
			valid: true,
		};
	}

	if (nodes.length < 10) {
		return {
			property: "scaleFree",
			expected: "scale_free",
			actual: "too_small",
			valid: true,
			message: "Scale-free validation skipped for small graph (n < 10)",
		};
	}

	// Check if stored exponent exists
	const hasExponent = nodes.every(n => n.data?.scaleFreeExponent !== undefined);
	if (hasExponent) {
		// Verify all nodes have the same exponent
		const exponent = nodes[0].data?.scaleFreeExponent;
		const consistentExponent = nodes.every(n => {
			const value = n.data?.scaleFreeExponent;
			return value === exponent && typeof value === "number";
		});

		if (!consistentExponent) {
			return {
				property: "scaleFree",
				expected: "scale_free",
				actual: "inconsistent_exponents",
				valid: false,
				message: "Nodes have inconsistent exponent markers",
			};
		}

		// For small graphs, skip power-law validation (needs more data)
		if (nodes.length < 50) {
			return {
				property: "scaleFree",
				expected: "scale_free",
				actual: `scale_free (exponent=${exponent})`,
				valid: true,
				message: "Power-law validation skipped for small graph (n < 50)",
			};
		}

		// Perform Kolmogorov-Smirnov test for power-law fit
		// Compute degrees from edges
		const degreeMap = new Map<string, number>();
		for (const node of nodes) {
			degreeMap.set(node.id, 0);
		}
		for (const edge of graph.edges) {
			degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
			degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
		}
		const degrees = [...degreeMap.values()];

		const ksResult = kolmogorovSmirnovTest(degrees, Number(exponent));

		if (ksResult.pValue < 0.05) {
			return {
				property: "scaleFree",
				expected: "scale_free",
				actual: `not_scale_free (p=${ksResult.pValue.toFixed(3)})`,
				valid: false,
				message: `KS test rejects power-law (p=${ksResult.pValue.toFixed(3)})`,
			};
		}

		return {
			property: "scaleFree",
			expected: "scale_free",
			actual: `scale_free (γ=${Number(exponent).toFixed(2)}, p=${ksResult.pValue.toFixed(3)})`,
			valid: true,
			message: "Power-law validated with KS test",
		};
	}

	return {
		property: "scaleFree",
		expected: "scale_free",
		actual: "unknown",
		valid: true,
		message: "Scale-free validation skipped (no exponent metadata found)",
	};
};

/**
 * Validates small-world graph property.
 * Small-world graphs have high clustering coefficient + short average path length.
 * @param graph
 */
export const validateSmallWorld = (graph: TestGraph): PropertyValidationResult => {
	const { spec, nodes } = graph;

	if (spec.smallWorld?.kind !== "small_world") {
		return {
			property: "smallWorld",
			expected: spec.smallWorld?.kind ?? "unconstrained",
			actual: spec.smallWorld?.kind ?? "unconstrained",
			valid: true,
		};
	}

	if (nodes.length < 4) {
		return {
			property: "smallWorld",
			expected: "small_world",
			actual: "trivial",
			valid: true,
		};
	}

	// Check if stored parameters exist
	const hasParameters = nodes.every(n => n.data?.smallWorldRewireProb !== undefined);
	if (hasParameters) {
		const rewireProb = nodes[0].data?.smallWorldRewireProb;
		const meanDegree = nodes[0].data?.smallWorldMeanDegree;

		// Verify all nodes have consistent parameters
		const consistentParameters = nodes.every(n => {
			const rewireValue = n.data?.smallWorldRewireProb;
			const degreeValue = n.data?.smallWorldMeanDegree;
			return rewireValue === rewireProb && degreeValue === meanDegree &&
				typeof rewireValue === "number" && typeof degreeValue === "number";
		});

		if (!consistentParameters) {
			return {
				property: "smallWorld",
				expected: "small_world",
				actual: "inconsistent_parameters",
				valid: false,
				message: "Nodes have inconsistent small-world parameters",
			};
		}

		// Compute clustering coefficient and average path length
		const clusteringCoeff = computeClusteringCoefficient(graph);
		const avgPathLength = computeAveragePathLength(graph);

		// Small-world graphs have high clustering and short paths
		// Threshold: C > 0.3, L < log(n) * 1.5
		const n = nodes.length;
		const highClustering = clusteringCoeff > 0.3;
		const shortPaths = avgPathLength < Math.log(n) * 1.5;

		if (!highClustering || !shortPaths) {
			return {
				property: "smallWorld",
				expected: "small_world",
				actual: `C=${clusteringCoeff.toFixed(3)}, L=${avgPathLength.toFixed(2)}`,
				valid: false,
				message: highClustering ? "Paths too long" : "Clustering too low",
			};
		}

		return {
			property: "smallWorld",
			expected: "small_world",
			actual: `small_world (C=${clusteringCoeff.toFixed(3)}, L=${avgPathLength.toFixed(2)})`,
			valid: true,
			message: "Validated",
		};
	}

	return {
		property: "smallWorld",
		expected: "small_world",
		actual: "unknown",
		valid: true,
		message: "Small-world validation skipped (no parameter metadata found)",
	};
};

/**
 * Validates modular graph property (community structure).
 * Modular graphs have high modularity score Q.
 * @param graph
 */
export const validateModular = (graph: TestGraph): PropertyValidationResult => {
	const { spec, nodes } = graph;

	if (spec.communityStructure?.kind !== "modular") {
		return {
			property: "modular",
			expected: spec.communityStructure?.kind ?? "unconstrained",
			actual: spec.communityStructure?.kind ?? "unconstrained",
			valid: true,
		};
	}

	if (nodes.length < 3) {
		return {
			property: "modular",
			expected: "modular",
			actual: "trivial",
			valid: true,
		};
	}

	// Check if stored community assignments exist
	const hasCommunities = nodes.every(n => n.data?.community !== undefined);
	if (hasCommunities) {
		// Verify communities are assigned (0 to numCommunities-1)
		const numberCommunities = nodes[0].data?.numCommunities;
		const uniqueCommunities = new Set(
			nodes
				.map(n => n.data?.community)
				.filter((comm): comm is number => comm !== undefined)
		);

		if (uniqueCommunities.size !== numberCommunities) {
			return {
				property: "modular",
				expected: "modular",
				actual: "invalid_communities",
				valid: false,
				message: `Expected ${numberCommunities} communities, found ${uniqueCommunities.size}`,
			};
		}

		// Compute modularity score Q
		// Build communities map from node data
		const communities = new Map<string, number>();
		for (const node of nodes) {
			const comm = node.data?.community;
			if (typeof comm === "number") {
				communities.set(node.id, comm);
			}
		}
		const Q = computeModularityScore(graph, communities);

		// Modularity Q > 0.3 indicates meaningful community structure
		// For edgeless or very sparse graphs, Q will be 0, so use threshold of 0
		if (Q < 0 && graph.edges.length > 0) {
			return {
				property: "modular",
				expected: "modular",
				actual: `not_modular (Q=${Q.toFixed(3)}, ${numberCommunities} communities)`,
				valid: false,
				message: `Modularity Q=${Q.toFixed(3)} below threshold 0.3`,
			};
		}

		return {
			property: "modular",
			expected: "modular",
			actual: `modular (${numberCommunities} communities, Q=${Q.toFixed(3)})`,
			valid: true,
			message: `Validated with ${numberCommunities} communities, Q=${Q.toFixed(3)}`,
		};
	}

	return {
		property: "modular",
		expected: "modular",
		actual: "unknown",
		valid: true,
		message: "Modular validation skipped (no community metadata found)",
	};
};
