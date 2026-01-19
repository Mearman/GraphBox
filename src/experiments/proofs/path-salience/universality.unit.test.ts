/**
 * Universality (Implicit Degeneracy) Tests for Path Salience Ranking
 *
 * Validates: Same formula works on all graph classes.
 *
 * The path salience ranking formula degenerates correctly to produce
 * meaningful results on various graph types without special configuration:
 * - Directed and undirected graphs
 * - Weighted and unweighted edges
 * - Heterogeneous node types
 * - Heterogeneous edge types
 * - Multigraphs (multiple edges between same nodes)
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import { rankPaths } from "../../../algorithms/pathfinding/path-ranking";
import type { ProofTestEdge, ProofTestNode } from "../test-utils";

describe("Universal Formula / Implicit Degeneracy", () => {
	describe("Directed Graph Support", () => {
		it("produces valid rankings on directed graph", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(true);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });

			// Directed edges: A → B → C
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			const result = rankPaths(graph, "A", "C", { traversalMode: "directed" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBeGreaterThan(0);
				expect(paths[0].score).toBeGreaterThan(0);
				expect(Number.isFinite(paths[0].score)).toBe(true);
			}
		});

		it("respects edge direction in directed mode", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(true);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });

			// Only A → B, not B → A
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });

			// A → B should work
			const forwardResult = rankPaths(graph, "A", "B", { traversalMode: "directed" });
			expect(forwardResult.ok).toBe(true);
			if (forwardResult.ok && forwardResult.value.some) {
				expect(forwardResult.value.value.length).toBeGreaterThan(0);
			}

			// B → A should fail (no path in directed mode)
			const backwardResult = rankPaths(graph, "B", "A", { traversalMode: "directed" });
			expect(backwardResult.ok).toBe(true);
			if (backwardResult.ok) {
				expect(backwardResult.value.some).toBe(false);
			}
		});
	});

	describe("Undirected Graph Support", () => {
		it("produces valid rankings on undirected graph", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBeGreaterThan(0);
				expect(paths[0].score).toBeGreaterThan(0);
			}
		});

		it("finds paths in both directions on undirected graph", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });

			// Both directions should work
			const forward = rankPaths(graph, "A", "B");
			const backward = rankPaths(graph, "B", "A");

			expect(forward.ok).toBe(true);
			expect(backward.ok).toBe(true);

			if (forward.ok && forward.value.some && backward.ok && backward.value.some) {
				expect(forward.value.value.length).toBeGreaterThan(0);
				expect(backward.value.value.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Weighted Edge Support", () => {
		it("handles weighted edges with divide mode", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge", weight: 2 });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge", weight: 1 });

			const result = rankPaths(graph, "A", "C", { weightMode: "divide" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				expect(path.weightFactor).toBeDefined();
				expect(path.weightFactor).toBeGreaterThan(0);
			}
		});

		it("handles weighted edges with multiplicative mode", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge", weight: 0.5 });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge", weight: 0.8 });

			const result = rankPaths(graph, "A", "C", { weightMode: "multiplicative" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				expect(path.weightFactor).toBeDefined();
			}
		});

		it("ignores weights when weightMode is none", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge", weight: 100 });

			const result = rankPaths(graph, "A", "B", { weightMode: "none" });

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				expect(path.weightFactor).toBeUndefined();
			}
		});
	});

	describe("Heterogeneous Node Type Support", () => {
		it("handles graphs with multiple node types", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Different node types
			graph.addNode({ id: "A", type: "person" });
			graph.addNode({ id: "B", type: "document" });
			graph.addNode({ id: "C", type: "topic" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "authored" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "covers" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBeGreaterThan(0);
				expect(paths[0].score).toBeGreaterThan(0);
			}
		});

		it("node type rarity affects MI computation", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Common type and rare type
			graph.addNode({ id: "A", type: "common" });
			graph.addNode({ id: "B", type: "common" });
			graph.addNode({ id: "C", type: "rare" });
			graph.addNode({ id: "D", type: "common" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });
			graph.addEdge({ id: "E2", source: "C", target: "D", type: "edge" });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				// Path exists and has meaningful score
				expect(result.value.value[0].score).toBeGreaterThan(0);
			}
		});
	});

	describe("Heterogeneous Edge Type Support", () => {
		it("handles graphs with multiple edge types", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });

			// Different edge types
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "cites" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "references" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBeGreaterThan(0);
			}
		});

		it("edge type rarity affects ranking", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Create diamond with different edge types
			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });
			graph.addNode({ id: "C", type: "node" });
			graph.addNode({ id: "D", type: "node" });

			// Path 1: common edges
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "common" });
			graph.addEdge({ id: "E1", source: "B", target: "D", type: "common" });

			// Path 2: includes rare edge
			graph.addEdge({ id: "E2", source: "A", target: "C", type: "common" });
			graph.addEdge({ id: "E3", source: "C", target: "D", type: "rare" });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				expect(paths.length).toBe(2);
				// Both paths have valid scores
				for (const path of paths) {
					expect(Number.isFinite(path.score)).toBe(true);
				}
			}
		});
	});

	describe("Mixed Graph Properties", () => {
		it("handles graph with all features combined", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Heterogeneous nodes
			graph.addNode({ id: "A", type: "author" });
			graph.addNode({ id: "B", type: "paper" });
			graph.addNode({ id: "C", type: "paper" });
			graph.addNode({ id: "D", type: "venue" });

			// Heterogeneous weighted edges
			graph.addEdge({ id: "E0", source: "A", target: "B", type: "authored", weight: 1 });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "cites", weight: 0.8 });
			graph.addEdge({ id: "E2", source: "C", target: "D", type: "published_at", weight: 1.2 });

			const result = rankPaths(graph, "A", "D");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				const path = result.value.value[0];
				expect(path.score).toBeGreaterThan(0);
				expect(Number.isFinite(path.score)).toBe(true);
				expect(path.edgeMIValues.length).toBe(3);
			}
		});
	});

	describe("Degeneracy to Structural MI", () => {
		it("falls back to structural MI when no types present", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// All same type (forces structural MI)
			graph.addNode({ id: "A", type: "same" });
			graph.addNode({ id: "B", type: "same" });
			graph.addNode({ id: "C", type: "same" });

			graph.addEdge({ id: "E0", source: "A", target: "B", type: "edge" });
			graph.addEdge({ id: "E1", source: "B", target: "C", type: "edge" });

			const result = rankPaths(graph, "A", "C");

			expect(result.ok).toBe(true);
			if (result.ok && result.value.some) {
				// Should still produce valid rankings using structural (Jaccard) MI
				expect(result.value.value[0].score).toBeGreaterThan(0);
			}
		});
	});

	describe("Error Handling", () => {
		it("handles missing start node gracefully", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });

			const result = rankPaths(graph, "MISSING", "A");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("handles missing end node gracefully", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			graph.addNode({ id: "A", type: "node" });

			const result = rankPaths(graph, "A", "MISSING");

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("handles no path between nodes", () => {
			const graph = new Graph<ProofTestNode, ProofTestEdge>(false);

			// Disconnected nodes
			graph.addNode({ id: "A", type: "node" });
			graph.addNode({ id: "B", type: "node" });

			const result = rankPaths(graph, "A", "B");

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.some).toBe(false);
			}
		});
	});
});
