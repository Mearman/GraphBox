import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import {
	computeEdgeMI,
	precomputeMutualInformation,
} from "./mutual-information";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: string;
	values?: number[];
	community?: string;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
	timestamp?: number;
	sign?: number;
	probability?: number;
}

// Helper to create a test node
const createNode = (id: string, type = "test", values?: number[], community?: string): TestNode => ({
	id,
	type,
	values,
	community,
});

// Helper to create a test edge
const createEdge = (
	id: string,
	source: string,
	target: string,
	type = "test",
	extras: Partial<TestEdge> = {}
): TestEdge => ({
	id,
	source,
	target,
	type,
	...extras,
});

describe("precomputeMutualInformation", () => {
	describe("basic functionality", () => {
		it("should compute MI for all edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "B", "C"));

			const cache = precomputeMutualInformation(graph);

			expect(cache.size).toBe(2);
			expect(cache.get("E1")).toBeDefined();
			expect(cache.get("E2")).toBeDefined();
		});

		it("should return positive MI values", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const cache = precomputeMutualInformation(graph);

			const mi = cache.get("E1");
			expect(mi).toBeDefined();
			expect(mi).toBeGreaterThan(0);
		});

		it("should provide keys iterator", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const cache = precomputeMutualInformation(graph);

			const keys = [...cache.keys()];
			expect(keys).toContain("E1");
		});
	});

	describe("attribute-based MI", () => {
		it("should use attribute extractor when provided", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "test", [1, 2, 3]));
			graph.addNode(createNode("B", "test", [1, 2, 3]));
			graph.addNode(createNode("C", "test", [4, 5, 6]));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const cache = precomputeMutualInformation(graph, {
				attributeExtractor: (node) => node.values,
			});

			const miAB = cache.get("E1")!;
			const miAC = cache.get("E2")!;

			// A and B have identical attributes, should have higher MI
			// A and C have different attributes
			expect(miAB).toBeDefined();
			expect(miAC).toBeDefined();
		});

		it("should fall back to structural MI when attributes undefined", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("E1", "A", "B"));

			const cache = precomputeMutualInformation(graph, {
				attributeExtractor: (node) => node.values, // undefined for these nodes
			});

			expect(cache.get("E1")).toBeDefined();
		});
	});

	describe("node type-based MI", () => {
		it("should use node types when heterogeneous", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "work"));
			graph.addNode(createNode("B", "author"));
			graph.addNode(createNode("C", "work"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const cache = precomputeMutualInformation(graph);

			// Different node types should affect MI
			expect(cache.get("E1")).toBeDefined();
			expect(cache.get("E2")).toBeDefined();
		});
	});

	describe("edge type-based MI", () => {
		it("should use edge types when heterogeneous", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", "citation"));
			graph.addEdge(createEdge("E2", "B", "C", "authorship"));

			const cache = precomputeMutualInformation(graph, { useEdgeTypes: true });

			expect(cache.get("E1")).toBeDefined();
			expect(cache.get("E2")).toBeDefined();
		});
	});

	describe("temporal modifier", () => {
		it("should apply temporal decay", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));

			const now = Date.now();
			graph.addEdge(createEdge("E1", "A", "B", "test", { timestamp: now }));
			graph.addEdge(createEdge("E2", "A", "C", "test", { timestamp: now - 1_000_000 }));

			const cache = precomputeMutualInformation(graph, {
				timestampExtractor: (edge) => edge.timestamp,
				temporalDecay: 0.001,
				referenceTime: now,
			});

			const miRecent = cache.get("E1")!;
			const miOld = cache.get("E2")!;

			// Recent edge should have higher MI (less decay)
			expect(miRecent).toBeGreaterThan(miOld);
		});
	});

	describe("sign modifier", () => {
		it("should penalize negative edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", "test", { sign: 1 }));
			graph.addEdge(createEdge("E2", "A", "C", "test", { sign: -1 }));

			const cache = precomputeMutualInformation(graph, {
				signExtractor: (edge) => edge.sign,
				negativePenalty: 0.5,
			});

			const miPositive = cache.get("E1")!;
			const miNegative = cache.get("E2")!;

			// Negative edge should have lower MI
			expect(miPositive).toBeGreaterThan(miNegative);
		});
	});

	describe("probability modifier", () => {
		it("should scale MI by probability", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B", "test", { probability: 1 }));
			graph.addEdge(createEdge("E2", "A", "C", "test", { probability: 0.5 }));

			const cache = precomputeMutualInformation(graph, {
				probabilityExtractor: (edge) => edge.probability,
			});

			const miHigh = cache.get("E1")!;
			const miLow = cache.get("E2")!;

			// Higher probability edge should have higher MI
			expect(miHigh).toBeGreaterThan(miLow);
		});
	});

	describe("community modifier", () => {
		it("should boost same-community edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "test", undefined, "comm1"));
			graph.addNode(createNode("B", "test", undefined, "comm1"));
			graph.addNode(createNode("C", "test", undefined, "comm2"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const cache = precomputeMutualInformation(graph, {
				communityExtractor: (node) => node.community,
				communityBoost: 0.5,
			});

			const miSameCommunity = cache.get("E1")!;
			const miDiffCommunity = cache.get("E2")!;

			// Same community edge should have higher MI
			expect(miSameCommunity).toBeGreaterThan(miDiffCommunity);
		});
	});

	describe("degree-based penalties", () => {
		it("should apply degree-based penalty", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Hub node A connected to many nodes
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));
			graph.addEdge(createEdge("E3", "A", "D"));
			graph.addEdge(createEdge("E4", "D", "E")); // Low degree edge

			const cache = precomputeMutualInformation(graph, {
				useDegreeBasedPenalty: true,
				degreeBasedPenaltyFactor: 0.5,
			});

			// All edges should have positive MI
			expect(cache.get("E1")).toBeGreaterThan(0);
			expect(cache.get("E4")).toBeGreaterThan(0);
		});

		it("should apply IDF weighting", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("E1", "A", "B"));
			graph.addEdge(createEdge("E2", "A", "C"));

			const cache = precomputeMutualInformation(graph, {
				useIDFWeighting: true,
			});

			expect(cache.get("E1")).toBeGreaterThan(0);
		});
	});

	describe("edge type rarity", () => {
		it("should boost rare edge types", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("E1", "A", "B", "common"));
			graph.addEdge(createEdge("E2", "B", "C", "common"));
			graph.addEdge(createEdge("E3", "C", "D", "rare"));

			const cache = precomputeMutualInformation(graph, {
				useEdgeTypeRarity: true,
			});

			// Rare edge type should have higher MI
			const miCommon = cache.get("E1")!;
			const miRare = cache.get("E3")!;
			expect(miRare).toBeGreaterThan(miCommon);
		});
	});
});

describe("computeEdgeMI", () => {
	describe("basic functionality", () => {
		it("should compute MI for single edge", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			const edge = createEdge("E1", "A", "B");
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge);

			expect(mi).toBeGreaterThan(0);
		});

		it("should return epsilon for invalid nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			const edge = createEdge("E1", "A", "B"); // B doesn't exist

			const mi = computeEdgeMI(graph, edge);

			// Should return epsilon (very small value)
			expect(mi).toBeLessThan(0.001);
		});
	});

	describe("with modifiers", () => {
		it("should apply temporal modifier", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			const now = Date.now();
			const edge = createEdge("E1", "A", "B", "test", { timestamp: now - 100_000 });
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge, {
				timestampExtractor: (e) => e.timestamp,
				temporalDecay: 0.001,
				referenceTime: now,
			});

			expect(mi).toBeGreaterThan(0);
		});

		it("should apply sign modifier", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			const edge = createEdge("E1", "A", "B", "test", { sign: -1 });
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge, {
				signExtractor: (e) => e.sign,
				negativePenalty: 0.5,
			});

			expect(mi).toBeGreaterThan(0);
		});

		it("should apply probability modifier", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			const edge = createEdge("E1", "A", "B", "test", { probability: 0.8 });
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge, {
				probabilityExtractor: (e) => e.probability,
			});

			expect(mi).toBeGreaterThan(0);
		});

		it("should apply community modifier", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "test", undefined, "comm1"));
			graph.addNode(createNode("B", "test", undefined, "comm1"));
			const edge = createEdge("E1", "A", "B");
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge, {
				communityExtractor: (node) => node.community,
				communityBoost: 0.5,
			});

			expect(mi).toBeGreaterThan(0);
		});
	});

	describe("attribute-based MI", () => {
		it("should use attribute extractor", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A", "test", [1, 2, 3]));
			graph.addNode(createNode("B", "test", [1, 2, 3]));
			const edge = createEdge("E1", "A", "B");
			graph.addEdge(edge);

			const mi = computeEdgeMI(graph, edge, {
				attributeExtractor: (node) => node.values,
			});

			expect(mi).toBeGreaterThan(0);
		});
	});
});
