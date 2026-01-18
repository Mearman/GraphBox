import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import { type Edge, type Node } from "../types/graph";
import {
	type EgoNetworkOptions,
	type KTrussOptions,
	type SubgraphFilter,
	validateEgoNetworkOptions,
	validateKTrussOptions,
	validateSubgraphFilter,
} from "./validators";

// Test node and edge types
interface TestNode extends Node {
	id: string;
	type: string;
	value?: number;
}

interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
}

// Helper to create a test node
const createNode = (id: string, value?: number): TestNode => ({
	id,
	type: "test",
	value,
});

// Helper to create a test edge (unused, available for future tests)
const _createEdge = (id: string, source: string, target: string): TestEdge => ({
	id,
	source,
	target,
	type: "test",
});

describe("validateEgoNetworkOptions", () => {
	describe("radius validation", () => {
		it("should accept valid radius", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 2,
				seedNodes: ["A"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.radius).toBe(2);
			}
		});

		it("should accept radius of 0", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 0,
				seedNodes: ["A"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(true);
		});

		it("should reject negative radius", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: -1,
				seedNodes: ["A"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-radius");
			}
		});

		it("should reject non-integer radius", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 1.5,
				seedNodes: ["A"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-radius");
			}
		});
	});

	describe("seed nodes validation", () => {
		it("should accept valid seed nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: ["A", "B"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(true);
		});

		it("should reject empty seed nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: [],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should reject non-existent seed node", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: ["X"], // Does not exist
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("node-not-found");
			}
		});

		it("should reject when one of multiple seed nodes does not exist", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: ["A", "X"], // X does not exist
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("node-not-found");
			}
		});
	});

	describe("includeSeed option", () => {
		it("should default includeSeed to true", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: ["A"],
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.includeSeed).toBe(true);
			}
		});

		it("should preserve explicit includeSeed=false", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const options: EgoNetworkOptions = {
				radius: 1,
				seedNodes: ["A"],
				includeSeed: false,
			};

			const result = validateEgoNetworkOptions(graph, options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.includeSeed).toBe(false);
			}
		});
	});
});

describe("validateSubgraphFilter", () => {
	describe("null/undefined handling", () => {
		it("should reject null filter", () => {
			const result = validateSubgraphFilter(null as unknown as SubgraphFilter);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-filter");
			}
		});

		it("should reject undefined filter", () => {
			const result = validateSubgraphFilter(undefined as unknown as SubgraphFilter);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-filter");
			}
		});
	});

	describe("empty filter", () => {
		it("should accept empty filter (returns full graph)", () => {
			const filter: SubgraphFilter = {};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.combineMode).toBe("and");
			}
		});
	});

	describe("filter with predicates", () => {
		it("should accept filter with node predicate", () => {
			const filter: SubgraphFilter<TestNode> = {
				nodePredicate: (node) => node.value !== undefined && node.value > 10,
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
		});

		it("should accept filter with edge predicate", () => {
			const filter: SubgraphFilter<TestNode, TestEdge> = {
				edgePredicate: (edge) => edge.type === "citation",
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
		});

		it("should accept filter with both predicates", () => {
			const filter: SubgraphFilter<TestNode, TestEdge> = {
				nodePredicate: (node) => node.type === "work",
				edgePredicate: (edge) => edge.type === "citation",
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
		});
	});

	describe("filter with attributes", () => {
		it("should accept filter with node attributes", () => {
			const filter: SubgraphFilter = {
				nodeAttributes: { type: "work", value: 42 },
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
		});

		it("should accept filter with edge types", () => {
			const filter: SubgraphFilter = {
				edgeTypes: new Set(["citation", "authorship"]),
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
		});
	});

	describe("combineMode", () => {
		it("should default combineMode to 'and'", () => {
			const filter: SubgraphFilter = {
				nodePredicate: () => true,
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.combineMode).toBe("and");
			}
		});

		it("should preserve explicit combineMode='or'", () => {
			const filter: SubgraphFilter = {
				nodePredicate: () => true,
				combineMode: "or",
			};

			const result = validateSubgraphFilter(filter);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.combineMode).toBe("or");
			}
		});
	});
});

describe("validateKTrussOptions", () => {
	describe("null/undefined handling", () => {
		it("should reject null options", () => {
			const result = validateKTrussOptions(null as unknown as KTrussOptions);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});

		it("should reject undefined options", () => {
			const result = validateKTrussOptions(undefined as unknown as KTrussOptions);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-input");
			}
		});
	});

	describe("k validation", () => {
		it("should accept k >= 2", () => {
			const options: KTrussOptions = { k: 2 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.k).toBe(2);
			}
		});

		it("should accept large k value", () => {
			const options: KTrussOptions = { k: 100 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(true);
		});

		it("should reject k < 2", () => {
			const options: KTrussOptions = { k: 1 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-truss");
			}
		});

		it("should reject k = 0", () => {
			const options: KTrussOptions = { k: 0 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-truss");
			}
		});

		it("should reject negative k", () => {
			const options: KTrussOptions = { k: -1 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-truss");
			}
		});

		it("should reject non-integer k", () => {
			const options: KTrussOptions = { k: 2.5 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.type).toBe("invalid-truss");
			}
		});
	});

	describe("returnHierarchy option", () => {
		it("should default returnHierarchy to false", () => {
			const options: KTrussOptions = { k: 3 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.returnHierarchy).toBe(false);
			}
		});

		it("should preserve explicit returnHierarchy=true", () => {
			const options: KTrussOptions = { k: 3, returnHierarchy: true };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.returnHierarchy).toBe(true);
			}
		});
	});

	describe("error messages", () => {
		it("should include k value in error message", () => {
			const options: KTrussOptions = { k: 1 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("1");
			}
		});

		it("should indicate k must be >= 2", () => {
			const options: KTrussOptions = { k: 0 };

			const result = validateKTrussOptions(options);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("2");
			}
		});
	});
});
