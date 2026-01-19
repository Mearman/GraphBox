import { describe, expect, it } from "vitest";

import type { GraphExpander, Neighbor } from "./graph-expander";

describe("GraphExpander interface", () => {
	it("should define the correct shape for a graph expander implementation", () => {
		// Create a mock implementation to verify interface structure
		const mockExpander: GraphExpander<{ id: string; label: string }> = {
			getNeighbors: async (nodeId: string): Promise<Neighbor[]> => {
				if (nodeId === "A") {
					return [
						{ targetId: "B", relationshipType: "citation" },
						{ targetId: "C", relationshipType: "authorship" },
					];
				}
				return [];
			},
			getDegree: (nodeId: string): number => {
				const degrees: Record<string, number> = { A: 5, B: 2, C: 10 };
				return degrees[nodeId] ?? 0;
			},
			calculatePriority: (nodeId: string) => {
				const degree = { A: 5, B: 2, C: 10 }[nodeId] ?? 0;
				return degree / 1.000_000_000_1;
			},
			getNode: async (nodeId: string) => {
				const nodes: Record<string, { id: string; label: string }> = {
					A: { id: "A", label: "Node A" },
					B: { id: "B", label: "Node B" },
				};
				return nodes[nodeId] ?? null;
			},
			addEdge: (_source: string, _target: string, _relationshipType: string): void => {
				// Edge tracking implementation
			},
		};

		// Verify the mock implementation satisfies the interface
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockExpander.getNeighbors).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockExpander.getDegree).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockExpander.calculatePriority).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockExpander.getNode).toBeDefined();
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockExpander.addEdge).toBeDefined();
	});

	it("should allow async getNeighbors to return neighbors", async () => {
		const expander: GraphExpander<string> = {
			getNeighbors: async () => [
				{ targetId: "target1", relationshipType: "follows" },
			],
			getDegree: () => 1,
			calculatePriority: () => 1,
			getNode: async () => "node-data",
			addEdge: () => {},
		};

		const neighbors = await expander.getNeighbors("source");

		expect(neighbors).toHaveLength(1);
		expect(neighbors[0].targetId).toBe("target1");
		expect(neighbors[0].relationshipType).toBe("follows");
	});

	it("should allow getDegree to return node degree synchronously", () => {
		const degreeMap = new Map<string, number>([
			["high-degree", 100],
			["low-degree", 2],
		]);

		const expander: GraphExpander<unknown> = {
			getNeighbors: async () => [],
			getDegree: (nodeId: string) => degreeMap.get(nodeId) ?? 0,
			calculatePriority: (nodeId: string) => {
				const degree = degreeMap.get(nodeId) ?? 0;
				return degree / 1.000_000_000_1;
			},
			getNode: async () => null,
			addEdge: () => {},
		};

		expect(expander.getDegree("high-degree")).toBe(100);
		expect(expander.getDegree("low-degree")).toBe(2);
		expect(expander.getDegree("unknown")).toBe(0);
	});

	it("should allow getNode to return null for missing nodes", async () => {
		const expander: GraphExpander<{ name: string }> = {
			getNeighbors: async () => [],
			getDegree: () => 0,
			calculatePriority: () => 0,
			getNode: async (nodeId: string) => {
				if (nodeId === "exists") {
					return { name: "Existing Node" };
				}
				return null;
			},
			addEdge: () => {},
		};

		const existingNode = await expander.getNode("exists");
		const missingNode = await expander.getNode("missing");

		expect(existingNode).toEqual({ name: "Existing Node" });
		expect(missingNode).toBeNull();
	});

	it("should support generic node data types", async () => {
		interface WorkNode {
			id: string;
			title: string;
			year: number;
			citations: number;
		}

		const expander: GraphExpander<WorkNode> = {
			getNeighbors: async () => [],
			getDegree: () => 0,
			calculatePriority: () => 0,
			getNode: async (nodeId: string) => ({
				id: nodeId,
				title: "Sample Work",
				year: 2024,
				citations: 42,
			}),
			addEdge: () => {},
		};

		const node = await expander.getNode("W123");

		expect(node).not.toBeNull();
		expect(node!.id).toBe("W123");
		expect(node!.title).toBe("Sample Work");
		expect(node!.year).toBe(2024);
		expect(node!.citations).toBe(42);
	});

	it("should track edges via addEdge method", () => {
		const edges: Array<{ source: string; target: string; type: string }> = [];

		const expander: GraphExpander<unknown> = {
			getNeighbors: async () => [],
			getDegree: () => 0,
			calculatePriority: () => 0,
			getNode: async () => null,
			addEdge: (source: string, target: string, relationshipType: string) => {
				edges.push({ source, target, type: relationshipType });
			},
		};

		expander.addEdge("A", "B", "citation");
		expander.addEdge("B", "C", "authorship");
		expander.addEdge("A", "C", "affiliation");

		expect(edges).toHaveLength(3);
		expect(edges[0]).toEqual({ source: "A", target: "B", type: "citation" });
		expect(edges[1]).toEqual({ source: "B", target: "C", type: "authorship" });
		expect(edges[2]).toEqual({ source: "A", target: "C", type: "affiliation" });
	});
});

describe("Neighbor interface", () => {
	it("should have required targetId and relationshipType properties", () => {
		const neighbor: Neighbor = {
			targetId: "target-node-123",
			relationshipType: "cites",
		};

		expect(neighbor.targetId).toBe("target-node-123");
		expect(neighbor.relationshipType).toBe("cites");
	});

	it("should support various relationship types", () => {
		const relationships: Neighbor[] = [
			{ targetId: "W1", relationshipType: "citation" },
			{ targetId: "A1", relationshipType: "authorship" },
			{ targetId: "I1", relationshipType: "affiliation" },
			{ targetId: "S1", relationshipType: "published_in" },
			{ targetId: "C1", relationshipType: "topic" },
		];

		expect(relationships).toHaveLength(5);
		expect(relationships.map((r) => r.relationshipType)).toEqual([
			"citation",
			"authorship",
			"affiliation",
			"published_in",
			"topic",
		]);
	});

	it("should work in arrays returned by getNeighbors", async () => {
		const mockNeighbors: Neighbor[] = [
			{ targetId: "node-1", relationshipType: "link" },
			{ targetId: "node-2", relationshipType: "link" },
			{ targetId: "node-3", relationshipType: "reference" },
		];

		const expander: GraphExpander<unknown> = {
			getNeighbors: async () => mockNeighbors,
			getDegree: () => mockNeighbors.length,
			calculatePriority: () => mockNeighbors.length,
			getNode: async () => null,
			addEdge: () => {},
		};

		const neighbors = await expander.getNeighbors("source");

		expect(neighbors).toEqual(mockNeighbors);
		expect(expander.getDegree("source")).toBe(3);
	});
});

describe("GraphExpander use cases", () => {
	it("should support lazy loading pattern for API-backed graphs", async () => {
		const cache = new Map<string, { id: string; data: string }>();
		const fetchedNodes: string[] = [];

		const lazyExpander: GraphExpander<{ id: string; data: string }> = {
			getNeighbors: async (nodeId: string) => {
				// Simulate API call
				fetchedNodes.push(nodeId);
				return [
					{ targetId: `${nodeId}-child-1`, relationshipType: "contains" },
					{ targetId: `${nodeId}-child-2`, relationshipType: "contains" },
				];
			},
			getDegree: (nodeId: string) => {
				// Return cached degree
				return cache.has(nodeId) ? 2 : 0;
			},
			calculatePriority: (nodeId: string) => {
				const degree = cache.has(nodeId) ? 2 : 0;
				return degree / 1.000_000_000_1;
			},
			getNode: async (nodeId: string) => {
				if (cache.has(nodeId)) {
					return cache.get(nodeId)!;
				}
				// Simulate fetch
				const node = { id: nodeId, data: `Data for ${nodeId}` };
				cache.set(nodeId, node);
				return node;
			},
			addEdge: () => {},
		};

		// First access fetches from "API"
		const neighbors = await lazyExpander.getNeighbors("root");
		expect(fetchedNodes).toContain("root");
		expect(neighbors).toHaveLength(2);

		// Node access populates cache
		await lazyExpander.getNode("root");
		expect(cache.has("root")).toBe(true);
	});

	it("should support bidirectional BFS priority computation", () => {
		// Low-degree nodes should be prioritized in bidirectional BFS
		const expander: GraphExpander<unknown> = {
			getNeighbors: async () => [],
			getDegree: (nodeId: string) => {
				const degrees: Record<string, number> = {
					specific: 5, // Low degree - prioritize
					generic: 1000, // High degree - deprioritize
				};
				return degrees[nodeId] ?? 0;
			},
			calculatePriority: (nodeId: string) => {
				const degrees: Record<string, number> = {
					specific: 5,
					generic: 1000,
				};
				return (degrees[nodeId] ?? 0) / 1.000_000_000_1;
			},
			getNode: async () => null,
			addEdge: () => {},
		};

		const specificDegree = expander.getDegree("specific");
		const genericDegree = expander.getDegree("generic");

		// Verify priority ordering works
		expect(specificDegree).toBeLessThan(genericDegree);
	});

	it("should support filtering edges before adding", () => {
		const addedEdges: Array<{ source: string; target: string; type: string }> = [];
		const allowedTypes = new Set(["citation", "authorship"]);

		const filteringExpander: GraphExpander<unknown> = {
			getNeighbors: async () => [],
			getDegree: () => 0,
			calculatePriority: () => 0,
			getNode: async () => null,
			addEdge: (source: string, target: string, relationshipType: string) => {
				if (allowedTypes.has(relationshipType)) {
					addedEdges.push({ source, target, type: relationshipType });
				}
			},
		};

		filteringExpander.addEdge("A", "B", "citation");
		filteringExpander.addEdge("A", "C", "spam");
		filteringExpander.addEdge("B", "C", "authorship");
		filteringExpander.addEdge("C", "D", "unknown");

		expect(addedEdges).toHaveLength(2);
		expect(addedEdges.map((e) => e.type)).toEqual(["citation", "authorship"]);
	});
});
