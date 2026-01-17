/**
 * Unit tests for GML parser
 */

import { describe, expect, it } from "vitest";

import { gmlToJson, parseGml } from "./parse";

describe("parseGml", () => {
	describe("basic parsing", () => {
		it("should parse empty graph", () => {
			const gml = "graph [ ]";
			const result = parseGml(gml);

			expect(result.nodes).toHaveLength(0);
			expect(result.edges).toHaveLength(0);
		});

		it("should parse graph with single node", () => {
			const gml = `graph [
				node [ id 1 label "A" ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].id).toBe(1);
			expect(result.nodes[0].label).toBe("A");
		});

		it("should parse graph with multiple nodes", () => {
			const gml = `graph [
				node [ id 1 label "A" ]
				node [ id 2 label "B" ]
				node [ id 3 label "C" ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes).toHaveLength(3);
		});

		it("should parse graph with edges", () => {
			const gml = `graph [
				node [ id 1 ]
				node [ id 2 ]
				edge [ source 1 target 2 ]
			]`;
			const result = parseGml(gml);

			expect(result.edges).toHaveLength(1);
			expect(result.edges[0].source).toBe(1);
			expect(result.edges[0].target).toBe(2);
		});

		it("should parse directed graph flag", () => {
			const gml = "graph [ directed 1 ]";
			const result = parseGml(gml);

			expect(result.graph.directed).toBe(1);
		});
	});

	describe("node attributes", () => {
		it("should parse numeric node attributes", () => {
			const gml = `graph [
				node [ id 1 value 42 weight 3.14 ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes[0].value).toBe(42);
			expect(result.nodes[0].weight).toBeCloseTo(3.14);
		});

		it("should parse string node attributes", () => {
			const gml = `graph [
				node [ id 1 label "Test Node" type "person" ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes[0].label).toBe("Test Node");
			expect(result.nodes[0].type).toBe("person");
		});

		it("should handle escape sequences in strings", () => {
			const gml = String.raw`graph [
				node [ id 1 label "Line1\nLine2" ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes[0].label).toBe("Line1\nLine2");
		});
	});

	describe("edge attributes", () => {
		it("should parse edge weight", () => {
			const gml = `graph [
				node [ id 1 ]
				node [ id 2 ]
				edge [ source 1 target 2 weight 0.75 ]
			]`;
			const result = parseGml(gml);

			expect(result.edges[0].weight).toBeCloseTo(0.75);
		});

		it("should parse edge value", () => {
			const gml = `graph [
				node [ id 1 ]
				node [ id 2 ]
				edge [ source 1 target 2 value 5 ]
			]`;
			const result = parseGml(gml);

			expect(result.edges[0].value).toBe(5);
		});

		it("should parse edge label", () => {
			const gml = `graph [
				node [ id 1 ]
				node [ id 2 ]
				edge [ source 1 target 2 label "knows" ]
			]`;
			const result = parseGml(gml);

			expect(result.edges[0].label).toBe("knows");
		});
	});

	describe("comments", () => {
		it("should skip comment lines", () => {
			const gml = `# This is a comment
graph [
	# Another comment
	node [ id 1 ]
]`;
			const result = parseGml(gml);

			expect(result.nodes).toHaveLength(1);
		});
	});

	describe("creator", () => {
		it("should parse Creator field", () => {
			const gml = `Creator "NetworkX"
graph [
	node [ id 1 ]
]`;
			const result = parseGml(gml);

			expect(result.creator).toBe("NetworkX");
		});
	});

	describe("number formats", () => {
		it("should parse negative numbers", () => {
			const gml = `graph [
				node [ id 1 x -10 y -20.5 ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes[0].x).toBe(-10);
			expect(result.nodes[0].y).toBeCloseTo(-20.5);
		});

		it("should parse scientific notation", () => {
			const gml = `graph [
				node [ id 1 value 1.5e10 ]
			]`;
			const result = parseGml(gml);

			expect(result.nodes[0].value).toBe(1.5e10);
		});
	});
});

describe("gmlToJson", () => {
	const defaultMeta = {
		name: "Test Graph",
		description: "Test description",
		source: "test",
		url: "https://example.com",
		citation: { authors: [], title: "Test", year: 2024 },
		retrieved: "2024-01-01",
	};

	it("should convert empty graph", () => {
		const document = parseGml("graph []");
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.nodes).toHaveLength(0);
		expect(json.edges).toHaveLength(0);
		expect(json.meta.directed).toBe(false);
	});

	it("should convert nodes with labels", () => {
		const gml = `graph [
			node [ id 1 label "Alice" ]
			node [ id 2 label "Bob" ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.nodes).toHaveLength(2);
		expect(json.nodes.map(n => n.id)).toContain("Alice");
		expect(json.nodes.map(n => n.id)).toContain("Bob");
	});

	it("should use numeric ID as string when no label", () => {
		const gml = `graph [
			node [ id 1 ]
			node [ id 2 ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.nodes.map(n => n.id)).toContain("1");
		expect(json.nodes.map(n => n.id)).toContain("2");
	});

	it("should convert edges with correct source/target", () => {
		const gml = `graph [
			node [ id 1 label "A" ]
			node [ id 2 label "B" ]
			edge [ source 1 target 2 ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.edges).toHaveLength(1);
		expect(json.edges[0].source).toBe("A");
		expect(json.edges[0].target).toBe("B");
	});

	it("should preserve edge weight", () => {
		const gml = `graph [
			node [ id 1 ]
			node [ id 2 ]
			edge [ source 1 target 2 weight 0.5 ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.edges[0].weight).toBeCloseTo(0.5);
	});

	it("should preserve edge value", () => {
		const gml = `graph [
			node [ id 1 ]
			node [ id 2 ]
			edge [ source 1 target 2 value 10 ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.edges[0].value).toBe(10);
	});

	it("should set directed flag correctly", () => {
		const gmlDirected = "graph [ directed 1 node [ id 1 ] ]";
		const gmlUndirected = "graph [ directed 0 node [ id 1 ] ]";

		const documentDirected = parseGml(gmlDirected);
		const documentUndirected = parseGml(gmlUndirected);

		const jsonDirected = gmlToJson(documentDirected, { meta: defaultMeta });
		const jsonUndirected = gmlToJson(documentUndirected, { meta: defaultMeta });

		expect(jsonDirected.meta.directed).toBe(true);
		expect(jsonUndirected.meta.directed).toBe(false);
	});

	it("should include creator in meta", () => {
		const gml = `Creator "TestCreator"
graph [
	node [ id 1 ]
]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		expect(json.meta.creator).toBe("TestCreator");
	});

	it("should use custom node ID mapper", () => {
		const gml = `graph [
			node [ id 1 customField "custom1" ]
			node [ id 2 customField "custom2" ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, {
			meta: defaultMeta,
			nodeIdMapper: (id, node) => `node_${node.customField}`,
		});

		expect(json.nodes.map(n => n.id)).toContain("node_custom1");
		expect(json.nodes.map(n => n.id)).toContain("node_custom2");
	});

	it("should throw for edge referencing unknown node", () => {
		const gml = `graph [
			node [ id 1 ]
			edge [ source 1 target 99 ]
		]`;
		const document = parseGml(gml);

		expect(() => gmlToJson(document, { meta: defaultMeta })).toThrow("unknown node");
	});

	it("should preserve additional node properties", () => {
		const gml = `graph [
			node [ id 1 label "A" x 100 y 200 group 3 ]
		]`;
		const document = parseGml(gml);
		const json = gmlToJson(document, { meta: defaultMeta });

		const node = json.nodes[0];
		expect(node.x).toBe(100);
		expect(node.y).toBe(200);
		expect(node.group).toBe(3);
	});
});
