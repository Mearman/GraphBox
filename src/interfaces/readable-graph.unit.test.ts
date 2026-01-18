import { describe, expect, it } from "vitest";

import type { EdgeBase, NodeBase, ReadableGraph } from "./readable-graph";

describe("NodeBase interface", () => {
	it("should require an id property", () => {
		const node: NodeBase = {
			id: "node-123",
		};

		expect(node.id).toBe("node-123");
	});

	it("should allow extending with additional properties", () => {
		interface ExtendedNode extends NodeBase {
			label: string;
			weight: number;
		}

		const node: ExtendedNode = {
			id: "node-1",
			label: "First Node",
			weight: 1.5,
		};

		expect(node.id).toBe("node-1");
		expect(node.label).toBe("First Node");
		expect(node.weight).toBe(1.5);
	});
});

describe("EdgeBase interface", () => {
	it("should require source and target properties", () => {
		const edge: EdgeBase = {
			source: "node-a",
			target: "node-b",
		};

		expect(edge.source).toBe("node-a");
		expect(edge.target).toBe("node-b");
	});

	it("should allow optional type property", () => {
		const edgeWithType: EdgeBase = {
			source: "A",
			target: "B",
			type: "friendship",
		};

		const edgeWithoutType: EdgeBase = {
			source: "C",
			target: "D",
		};

		expect(edgeWithType.type).toBe("friendship");
		expect(edgeWithoutType.type).toBeUndefined();
	});

	it("should allow extending with additional properties", () => {
		interface WeightedEdge extends EdgeBase {
			weight: number;
			timestamp: Date;
		}

		const edge: WeightedEdge = {
			source: "A",
			target: "B",
			type: "transaction",
			weight: 100.5,
			timestamp: new Date("2024-01-17"),
		};

		expect(edge.source).toBe("A");
		expect(edge.target).toBe("B");
		expect(edge.weight).toBe(100.5);
	});
});

describe("ReadableGraph interface", () => {
	// Create a simple in-memory graph implementation for testing
	class SimpleGraph<N extends NodeBase, E extends EdgeBase> implements ReadableGraph<N, E> {
		private nodes: Map<string, N> = new Map();
		private adjacencyList: Map<string, string[]> = new Map();
		private edges: E[] = [];
		private directed: boolean;

		constructor(directed = false) {
			this.directed = directed;
		}

		addNode(node: N): void {
			this.nodes.set(node.id, node);
			if (!this.adjacencyList.has(node.id)) {
				this.adjacencyList.set(node.id, []);
			}
		}

		addEdge(edge: E): void {
			this.edges.push(edge);
			this.adjacencyList.get(edge.source)?.push(edge.target);
			if (!this.directed) {
				this.adjacencyList.get(edge.target)?.push(edge.source);
			}
		}

		hasNode(id: string): boolean {
			return this.nodes.has(id);
		}

		getNode(id: string): N | null {
			return this.nodes.get(id) ?? null;
		}

		getNeighbors(id: string): string[] {
			return this.adjacencyList.get(id) ?? [];
		}

		getAllNodes(): N[] {
			return [...this.nodes.values()];
		}

		isDirected(): boolean {
			return this.directed;
		}

		getOutgoingEdges(id: string): E[] {
			if (this.directed) {
				return this.edges.filter((e) => e.source === id);
			}
			return this.edges.filter((e) => e.source === id || e.target === id);
		}
	}

	it("should support hasNode to check node existence", () => {
		const graph = new SimpleGraph<NodeBase, EdgeBase>();
		graph.addNode({ id: "A" });

		expect(graph.hasNode("A")).toBe(true);
		expect(graph.hasNode("B")).toBe(false);
	});

	it("should support getNode to retrieve node data", () => {
		interface LabeledNode extends NodeBase {
			label: string;
		}

		const graph = new SimpleGraph<LabeledNode, EdgeBase>();
		graph.addNode({ id: "N1", label: "Node One" });

		const node = graph.getNode("N1");
		const missing = graph.getNode("N2");

		expect(node).not.toBeNull();
		expect(node!.id).toBe("N1");
		expect(node!.label).toBe("Node One");
		expect(missing).toBeNull();
	});

	it("should support getNeighbors for undirected graphs", () => {
		const graph = new SimpleGraph<NodeBase, EdgeBase>(false);
		graph.addNode({ id: "A" });
		graph.addNode({ id: "B" });
		graph.addNode({ id: "C" });
		graph.addEdge({ source: "A", target: "B" });
		graph.addEdge({ source: "A", target: "C" });

		const neighborsA = graph.getNeighbors("A");
		const neighborsB = graph.getNeighbors("B");

		expect(neighborsA).toContain("B");
		expect(neighborsA).toContain("C");
		expect(neighborsB).toContain("A"); // Undirected: B -> A
	});

	it("should support getNeighbors for directed graphs", () => {
		const graph = new SimpleGraph<NodeBase, EdgeBase>(true);
		graph.addNode({ id: "A" });
		graph.addNode({ id: "B" });
		graph.addEdge({ source: "A", target: "B" });

		const neighborsA = graph.getNeighbors("A");
		const neighborsB = graph.getNeighbors("B");

		expect(neighborsA).toContain("B");
		expect(neighborsB).not.toContain("A"); // Directed: no reverse edge
	});

	it("should return empty array for non-existent node neighbors", () => {
		const graph = new SimpleGraph<NodeBase, EdgeBase>();

		const neighbors = graph.getNeighbors("non-existent");

		expect(neighbors).toEqual([]);
	});

	it("should support getAllNodes to iterate over all nodes", () => {
		const graph = new SimpleGraph<NodeBase, EdgeBase>();
		graph.addNode({ id: "1" });
		graph.addNode({ id: "2" });
		graph.addNode({ id: "3" });

		const allNodes = graph.getAllNodes();

		expect(allNodes).toHaveLength(3);
		expect(allNodes.map((n) => n.id).sort()).toEqual(["1", "2", "3"]);
	});

	it("should support isDirected to check graph directionality", () => {
		const undirected = new SimpleGraph<NodeBase, EdgeBase>(false);
		const directed = new SimpleGraph<NodeBase, EdgeBase>(true);

		expect(undirected.isDirected()).toBe(false);
		expect(directed.isDirected()).toBe(true);
	});

	it("should support optional getOutgoingEdges method", () => {
		interface TypedEdge extends EdgeBase {
			weight: number;
		}

		const graph = new SimpleGraph<NodeBase, TypedEdge>(true);
		graph.addNode({ id: "A" });
		graph.addNode({ id: "B" });
		graph.addNode({ id: "C" });
		graph.addEdge({ source: "A", target: "B", weight: 1 });
		graph.addEdge({ source: "A", target: "C", weight: 2 });
		graph.addEdge({ source: "B", target: "C", weight: 3 });

		const outgoingFromA = graph.getOutgoingEdges("A");
		const outgoingFromB = graph.getOutgoingEdges("B");
		const outgoingFromC = graph.getOutgoingEdges("C");

		expect(outgoingFromA).toHaveLength(2);
		expect(outgoingFromB).toHaveLength(1);
		expect(outgoingFromC).toHaveLength(0);
	});
});

describe("ReadableGraph use cases", () => {
	// Minimal implementation for testing interface satisfaction
	const createMinimalGraph = <N extends NodeBase, E extends EdgeBase>(
		nodes: N[],
		edges: E[],
		directed: boolean
	): ReadableGraph<N, E> => {
		const nodeMap = new Map(nodes.map((n) => [n.id, n]));
		const adjacency = new Map<string, string[]>();

		for (const node of nodes) {
			adjacency.set(node.id, []);
		}

		for (const edge of edges) {
			adjacency.get(edge.source)?.push(edge.target);
			if (!directed) {
				adjacency.get(edge.target)?.push(edge.source);
			}
		}

		return {
			hasNode: (id: string) => nodeMap.has(id),
			getNode: (id: string) => nodeMap.get(id) ?? null,
			getNeighbors: (id: string) => adjacency.get(id) ?? [],
			getAllNodes: () => nodes,
			isDirected: () => directed,
		};
	};

	it("should support BFS traversal pattern", () => {
		const graph = createMinimalGraph<NodeBase, EdgeBase>(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }],
			[
				{ source: "A", target: "B" },
				{ source: "A", target: "C" },
				{ source: "B", target: "D" },
			],
			false
		);

		// Simple BFS implementation
		const bfs = (start: string): string[] => {
			const visited = new Set<string>();
			const queue: string[] = [start];
			const result: string[] = [];

			while (queue.length > 0) {
				const current = queue.shift()!;
				if (visited.has(current)) continue;

				visited.add(current);
				result.push(current);

				for (const neighbor of graph.getNeighbors(current)) {
					if (!visited.has(neighbor)) {
						queue.push(neighbor);
					}
				}
			}

			return result;
		};

		const traversal = bfs("A");

		expect(traversal[0]).toBe("A");
		expect(traversal).toContain("B");
		expect(traversal).toContain("C");
		expect(traversal).toContain("D");
		expect(traversal).toHaveLength(4);
	});

	it("should support DFS traversal pattern", () => {
		const graph = createMinimalGraph<NodeBase, EdgeBase>(
			[{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
			[
				{ source: "1", target: "2" },
				{ source: "1", target: "3" },
				{ source: "2", target: "4" },
			],
			false
		);

		// Simple DFS implementation
		const dfs = (start: string): string[] => {
			const visited = new Set<string>();
			const result: string[] = [];

			const visit = (nodeId: string): void => {
				if (visited.has(nodeId)) return;
				visited.add(nodeId);
				result.push(nodeId);

				for (const neighbor of graph.getNeighbors(nodeId)) {
					visit(neighbor);
				}
			};

			visit(start);
			return result;
		};

		const traversal = dfs("1");

		expect(traversal[0]).toBe("1");
		expect(traversal).toHaveLength(4);
	});

	it("should support ego network extraction pattern", () => {
		interface PersonNode extends NodeBase {
			name: string;
		}

		const graph = createMinimalGraph<PersonNode, EdgeBase>(
			[
				{ id: "ego", name: "Central Person" },
				{ id: "friend1", name: "Friend 1" },
				{ id: "friend2", name: "Friend 2" },
				{ id: "stranger", name: "Stranger" },
			],
			[
				{ source: "ego", target: "friend1" },
				{ source: "ego", target: "friend2" },
				{ source: "friend1", target: "friend2" },
				{ source: "stranger", target: "friend1" },
			],
			false
		);

		// Extract 1-hop ego network
		const extractEgoNetwork = (
			egoId: string,
			depth: number
		): { nodes: PersonNode[]; edges: EdgeBase[] } => {
			const nodeIds = new Set<string>([egoId]);
			let frontier = new Set<string>([egoId]);

			for (let d = 0; d < depth; d++) {
				const nextFrontier = new Set<string>();
				for (const nodeId of frontier) {
					for (const neighbor of graph.getNeighbors(nodeId)) {
						if (!nodeIds.has(neighbor)) {
							nodeIds.add(neighbor);
							nextFrontier.add(neighbor);
						}
					}
				}
				frontier = nextFrontier;
			}

			const nodes = [...nodeIds]
				.map((id) => graph.getNode(id))
				.filter((n): n is PersonNode => n !== null);

			// For this simple test, we don't track edges
			return { nodes, edges: [] };
		};

		const egoNetwork = extractEgoNetwork("ego", 1);

		expect(egoNetwork.nodes.map((n) => n.id)).toContain("ego");
		expect(egoNetwork.nodes.map((n) => n.id)).toContain("friend1");
		expect(egoNetwork.nodes.map((n) => n.id)).toContain("friend2");
		expect(egoNetwork.nodes.map((n) => n.id)).not.toContain("stranger");
	});

	it("should support checking connectivity between nodes", () => {
		const graph = createMinimalGraph<NodeBase, EdgeBase>(
			[{ id: "A" }, { id: "B" }, { id: "C" }, { id: "X" }, { id: "Y" }],
			[
				{ source: "A", target: "B" },
				{ source: "B", target: "C" },
				{ source: "X", target: "Y" },
			],
			false
		);

		const isConnected = (source: string, target: string): boolean => {
			if (!graph.hasNode(source) || !graph.hasNode(target)) {
				return false;
			}

			const visited = new Set<string>();
			const queue = [source];

			while (queue.length > 0) {
				const current = queue.shift()!;
				if (current === target) return true;
				if (visited.has(current)) continue;

				visited.add(current);
				for (const neighbor of graph.getNeighbors(current)) {
					queue.push(neighbor);
				}
			}

			return false;
		};

		expect(isConnected("A", "C")).toBe(true);
		expect(isConnected("A", "X")).toBe(false);
		expect(isConnected("X", "Y")).toBe(true);
	});

	it("should support counting graph statistics", () => {
		const graph = createMinimalGraph<NodeBase, EdgeBase>(
			[{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
			[
				{ source: "1", target: "2" },
				{ source: "1", target: "3" },
				{ source: "2", target: "3" },
				{ source: "3", target: "4" },
				{ source: "4", target: "5" },
			],
			false
		);

		const nodeCount = graph.getAllNodes().length;
		const avgDegree =
			graph.getAllNodes().reduce((sum, node) => sum + graph.getNeighbors(node.id).length, 0) /
			nodeCount;

		expect(nodeCount).toBe(5);
		expect(avgDegree).toBe(2); // Each edge contributes 2 to total degree in undirected graph
	});
});
