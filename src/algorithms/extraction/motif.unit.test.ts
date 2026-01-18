/**
 * Unit tests for motif detection algorithms
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import {
	detectBibliographicCoupling,
	detectCoCitations,
	detectStarPatterns,
	detectTriangles,
} from "./motif";

interface TestNode {
	id: string;
	type: string;
	[key: string]: unknown;
}

interface TestEdge {
	id: string;
	source: string;
	target: string;
	type: string;
	[key: string]: unknown;
}

const createNode = (id: string): TestNode => ({ id, type: "test" });
const createEdge = (id: string, source: string, target: string): TestEdge => ({
	id,
	source,
	target,
	type: "test",
});

describe("detectTriangles", () => {
	describe("empty and trivial graphs", () => {
		it("should return empty array for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			const result = detectTriangles(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});

		it("should return empty array for graph without triangles", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const result = detectTriangles(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});

	describe("triangle detection", () => {
		it("should detect single triangle", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const result = detectTriangles(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].nodes).toHaveLength(3);
			}
		});

		it("should detect multiple triangles", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Triangle 1: A-B-C
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));
			// Triangle 2: B-C-D (shares B-C edge)
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e4", "B", "D"));
			graph.addEdge(createEdge("e5", "C", "D"));

			const result = detectTriangles(graph);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeGreaterThanOrEqual(2);
			}
		});
	});
});

describe("detectStarPatterns", () => {
	describe("star detection", () => {
		it("should detect out-star pattern", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("hub"));
			graph.addNode(createNode("leaf1"));
			graph.addNode(createNode("leaf2"));
			graph.addNode(createNode("leaf3"));
			graph.addEdge(createEdge("e1", "hub", "leaf1"));
			graph.addEdge(createEdge("e2", "hub", "leaf2"));
			graph.addEdge(createEdge("e3", "hub", "leaf3"));

			const result = detectStarPatterns(graph, { minDegree: 3, type: "out" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].hub.id).toBe("hub");
				expect(result.value[0].leaves).toHaveLength(3);
				expect(result.value[0].type).toBe("out");
			}
		});

		it("should detect in-star pattern", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("hub"));
			graph.addNode(createNode("src1"));
			graph.addNode(createNode("src2"));
			graph.addEdge(createEdge("e1", "src1", "hub"));
			graph.addEdge(createEdge("e2", "src2", "hub"));

			const result = detectStarPatterns(graph, { minDegree: 2, type: "in" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].hub.id).toBe("hub");
				expect(result.value[0].type).toBe("in");
			}
		});

		it("should respect minimum degree", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("hub"));
			graph.addNode(createNode("leaf1"));
			graph.addNode(createNode("leaf2"));
			graph.addEdge(createEdge("e1", "hub", "leaf1"));
			graph.addEdge(createEdge("e2", "hub", "leaf2"));

			const result = detectStarPatterns(graph, { minDegree: 5, type: "out" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});

		it("should return empty for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = detectStarPatterns(graph, { minDegree: 1, type: "out" });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});
});

describe("detectCoCitations", () => {
	describe("co-citation detection", () => {
		it("should detect co-cited papers", () => {
			// Citing paper C cites both A and B (co-citation)
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "C", "A")); // C cites A
			graph.addEdge(createEdge("e2", "C", "B")); // C cites B

			const result = detectCoCitations(graph, { minCount: 1 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				const pair = result.value[0];
				expect(pair.count).toBeGreaterThanOrEqual(1);
			}
		});

		it("should respect minimum count", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "C", "A"));
			graph.addEdge(createEdge("e2", "C", "B"));

			const result = detectCoCitations(graph, { minCount: 5 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});

		it("should count multiple co-citations", () => {
			// Both C and D cite A and B
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "C", "A"));
			graph.addEdge(createEdge("e2", "C", "B"));
			graph.addEdge(createEdge("e3", "D", "A"));
			graph.addEdge(createEdge("e4", "D", "B"));

			const result = detectCoCitations(graph, { minCount: 2 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].count).toBe(2);
			}
		});

		it("should return empty for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = detectCoCitations(graph, { minCount: 1 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});
});

describe("detectBibliographicCoupling", () => {
	describe("bibliographic coupling detection", () => {
		it("should detect papers with shared references", () => {
			// Papers A and B both cite C (bibliographic coupling)
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "C")); // A cites C
			graph.addEdge(createEdge("e2", "B", "C")); // B cites C

			const result = detectBibliographicCoupling(graph, { minShared: 1 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				const pair = result.value[0];
				expect(pair.sharedReferences).toBeGreaterThanOrEqual(1);
			}
		});

		it("should respect minimum shared references", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "C"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const result = detectBibliographicCoupling(graph, { minShared: 5 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});

		it("should count multiple shared references", () => {
			// A and B both cite C and D
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "C"));
			graph.addEdge(createEdge("e2", "A", "D"));
			graph.addEdge(createEdge("e3", "B", "C"));
			graph.addEdge(createEdge("e4", "B", "D"));

			const result = detectBibliographicCoupling(graph, { minShared: 2 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].sharedReferences).toBe(2);
			}
		});

		it("should return empty for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);

			const result = detectBibliographicCoupling(graph, { minShared: 1 });

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});
	});
});
