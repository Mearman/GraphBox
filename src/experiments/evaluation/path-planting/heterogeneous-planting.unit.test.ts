/**
 * Unit tests for heterogeneous graph path planting
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../../../algorithms/graph/graph";
import type { Path } from "../../../algorithms/types/algorithm-results";
import type { Edge, Node } from "../../../algorithms/types/graph";
import {
	filterNodesByType,
	type HeterogeneousPathConfig,
	pathFollowsTemplate,
	plantHeterogeneousPaths,
} from "./heterogeneous-planting";

interface TypedNode extends Node {
	id: string;
	type: string;
	entityType?: string;
}

interface TypedEdge extends Edge {
	id: string;
	type: string;
	source: string;
	target: string;
	weight?: number;
}

const createHeterogeneousGraph = (): Graph<TypedNode, TypedEdge> => {
	const graph = new Graph<TypedNode, TypedEdge>(false);

	// Add nodes of different types
	graph.addNode({ id: "W1", type: "Work" });
	graph.addNode({ id: "W2", type: "Work" });
	graph.addNode({ id: "W3", type: "Work" });
	graph.addNode({ id: "W4", type: "Work" });

	graph.addNode({ id: "A1", type: "Author" });
	graph.addNode({ id: "A2", type: "Author" });

	graph.addNode({ id: "I1", type: "Institution" });
	graph.addNode({ id: "I2", type: "Institution" });

	return graph;
};

const createBaseConfig = (): HeterogeneousPathConfig<TypedNode, TypedEdge> => ({
	pathTemplate: ["Work", "Author", "Work"],
	entityTypes: ["Work", "Author", "Institution"],
	numPaths: 2,
	pathLength: { min: 2, max: 3 },
	signalStrength: "medium",
	allowOverlap: false,
	seed: 42,
});

describe("plantHeterogeneousPaths", () => {
	it("plants paths respecting type constraints", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();

		const result = plantHeterogeneousPaths(graph, ["Work", "Author", "Work"], config);

		expect(result).toBeDefined();
		expect(result.graph).toBe(graph);
		expect(result.groundTruthPaths).toBeDefined();
	});

	it("throws error for path template with fewer than 2 types", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.pathTemplate = ["Work"]; // Invalid - only 1 type

		expect(() => plantHeterogeneousPaths(graph, ["Work"], config)).toThrow(
			"Path template must have at least 2 node types"
		);
	});

	it("throws error when required node type is missing from graph", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.pathTemplate = ["Work", "Publisher", "Work"]; // Publisher doesn't exist
		config.entityTypes = ["Work", "Publisher"];

		expect(() => plantHeterogeneousPaths(graph, ["Work", "Publisher", "Work"], config)).toThrow(
			"No nodes found with type: Publisher"
		);
	});

	it("uses source nodes from first template type", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.pathTemplate = ["Work", "Author"];

		const result = plantHeterogeneousPaths(graph, ["Work", "Author"], config);

		// Source nodes should be Work nodes
		expect(result.groundTruthPaths).toBeDefined();
	});

	it("uses target nodes from last template type", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.pathTemplate = ["Author", "Work"];

		const result = plantHeterogeneousPaths(graph, ["Author", "Work"], config);

		expect(result.groundTruthPaths).toBeDefined();
	});

	it("handles template where first and last type are the same", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.pathTemplate = ["Work", "Author", "Work"];

		const result = plantHeterogeneousPaths(graph, ["Work", "Author", "Work"], config);

		expect(result.groundTruthPaths).toBeDefined();
	});

	it("respects entity types filter", () => {
		const graph = createHeterogeneousGraph();
		const config = createBaseConfig();
		config.entityTypes = ["Work", "Author"]; // Exclude Institution
		config.pathTemplate = ["Work", "Author"];

		const result = plantHeterogeneousPaths(graph, ["Work", "Author"], config);

		expect(result).toBeDefined();
	});

	it("handles nodes with entityType property instead of type", () => {
		const graph = new Graph<TypedNode, TypedEdge>(false);
		graph.addNode({ id: "W1", type: "Work", entityType: "Work" });
		graph.addNode({ id: "W2", type: "Work", entityType: "Work" });
		graph.addNode({ id: "A1", type: "Author", entityType: "Author" });
		graph.addNode({ id: "A2", type: "Author", entityType: "Author" });

		const config: HeterogeneousPathConfig<TypedNode, TypedEdge> = {
			pathTemplate: ["Work", "Author"],
			entityTypes: ["Work", "Author"],
			numPaths: 1,
			pathLength: { min: 1, max: 2 },
			signalStrength: "medium",
			allowOverlap: false,
			seed: 42,
		};

		const result = plantHeterogeneousPaths(graph, ["Work", "Author"], config);

		expect(result).toBeDefined();
	});
});

describe("filterNodesByType", () => {
	it("filters nodes by type property", () => {
		const nodes: TypedNode[] = [
			{ id: "W1", type: "Work" },
			{ id: "W2", type: "Work" },
			{ id: "A1", type: "Author" },
		];

		const works = filterNodesByType(nodes, "Work");

		expect(works).toHaveLength(2);
		expect(works.every(n => n.type === "Work")).toBe(true);
	});

	it("filters nodes by entityType property", () => {
		const nodes: TypedNode[] = [
			{ id: "W1", type: "Work", entityType: "Work" },
			{ id: "W2", type: "Work", entityType: "Work" },
			{ id: "A1", type: "Author", entityType: "Author" },
		];

		const works = filterNodesByType(nodes, "Work");

		expect(works).toHaveLength(2);
		expect(works.every(n => n.entityType === "Work")).toBe(true);
	});

	it("returns empty array when no nodes match", () => {
		const nodes: TypedNode[] = [
			{ id: "W1", type: "Work" },
			{ id: "W2", type: "Work" },
		];

		const authors = filterNodesByType(nodes, "Author");

		expect(authors).toHaveLength(0);
	});

	it("returns empty array for empty input", () => {
		const nodes: TypedNode[] = [];

		const result = filterNodesByType(nodes, "Work");

		expect(result).toHaveLength(0);
	});

	it("handles nodes without type or entityType", () => {
		const nodes: TypedNode[] = [
			{ id: "N1", type: "" }, // Empty type
			{ id: "W1", type: "Work" },
		];

		const works = filterNodesByType(nodes, "Work");

		expect(works).toHaveLength(1);
		expect(works[0].id).toBe("W1");
	});

	it("prefers type over entityType when both present", () => {
		const nodes: TypedNode[] = [
			{ id: "N1", type: "Work", entityType: "Author" }, // type wins
		];

		const works = filterNodesByType(nodes, "Work");
		const authors = filterNodesByType(nodes, "Author");

		expect(works).toHaveLength(1);
		expect(authors).toHaveLength(0);
	});
});

describe("pathFollowsTemplate", () => {
	it("returns true when path matches template exactly", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [
				{ id: "W1", type: "Work" },
				{ id: "A1", type: "Author" },
				{ id: "W2", type: "Work" },
			],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, ["Work", "Author", "Work"]);

		expect(result).toBe(true);
	});

	it("returns false when path length differs from template", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [
				{ id: "W1", type: "Work" },
				{ id: "A1", type: "Author" },
			],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, ["Work", "Author", "Work"]);

		expect(result).toBe(false);
	});

	it("returns false when node type does not match template", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [
				{ id: "W1", type: "Work" },
				{ id: "I1", type: "Institution" }, // Should be Author
				{ id: "W2", type: "Work" },
			],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, ["Work", "Author", "Work"]);

		expect(result).toBe(false);
	});

	it("handles entityType property", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [
				{ id: "W1", type: "Work", entityType: "Work" },
				{ id: "A1", type: "Author", entityType: "Author" },
			],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, ["Work", "Author"]);

		expect(result).toBe(true);
	});

	it("returns true for empty path with empty template", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, []);

		expect(result).toBe(true);
	});

	it("returns false for empty path with non-empty template", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [],
			edges: [],
			totalWeight: 0,
		};

		const result = pathFollowsTemplate(path, ["Work"]);

		expect(result).toBe(false);
	});

	it("handles nodes with empty type (returns empty string, not 'unknown')", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [{ id: "N1", type: "" }], // Empty type property
			edges: [],
			totalWeight: 0,
		};

		const matchesEmptyString = pathFollowsTemplate(path, [""]);
		const matchesUnknown = pathFollowsTemplate(path, ["unknown"]);
		const matchesWork = pathFollowsTemplate(path, ["Work"]);

		expect(matchesEmptyString).toBe(true); // Empty string type matches empty string template
		expect(matchesUnknown).toBe(false); // Empty string is not 'unknown'
		expect(matchesWork).toBe(false);
	});

	it("handles single-node paths", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [{ id: "W1", type: "Work" }],
			edges: [],
			totalWeight: 0,
		};

		expect(pathFollowsTemplate(path, ["Work"])).toBe(true);
		expect(pathFollowsTemplate(path, ["Author"])).toBe(false);
	});

	it("handles long paths", () => {
		const path: Path<TypedNode, TypedEdge> = {
			nodes: [
				{ id: "W1", type: "Work" },
				{ id: "A1", type: "Author" },
				{ id: "I1", type: "Institution" },
				{ id: "A2", type: "Author" },
				{ id: "W2", type: "Work" },
			],
			edges: [],
			totalWeight: 0,
		};

		const template = ["Work", "Author", "Institution", "Author", "Work"];
		const wrongTemplate = ["Work", "Author", "Author", "Institution", "Work"];

		expect(pathFollowsTemplate(path, template)).toBe(true);
		expect(pathFollowsTemplate(path, wrongTemplate)).toBe(false);
	});
});
