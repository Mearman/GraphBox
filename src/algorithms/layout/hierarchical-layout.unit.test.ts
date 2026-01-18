/**
 * Unit tests for hierarchical layout algorithm
 */

import { describe, expect, it } from "vitest";

import type { LayoutEdge, LayoutNode } from "../types/graph";
import { hierarchicalLayout, toNodePositionMap } from "./hierarchical-layout";

const createLayoutNode = (id: string, type = "test"): LayoutNode => ({
	id,
	type,
	x: 0,
	y: 0,
});

const createLayoutEdge = (
	id: string,
	source: string,
	target: string,
	type = "REFERENCE"
): LayoutEdge => ({
	id,
	source,
	target,
	type,
});

describe("hierarchicalLayout", () => {
	describe("empty graph", () => {
		it("should handle empty nodes array", () => {
			const result = hierarchicalLayout([], []);

			expect(result.nodes).toHaveLength(0);
			expect(result.maxDepth).toBe(0);
			expect(result.rootNodeId).toBe("");
		});
	});

	describe("single node", () => {
		it("should position single node at origin", () => {
			const nodes: LayoutNode[] = [createLayoutNode("A")];

			const result = hierarchicalLayout(nodes, []);

			expect(result.nodes).toHaveLength(1);
			expect(result.rootNodeId).toBe("A");
			expect(result.maxDepth).toBe(0);
		});
	});

	describe("tree structure", () => {
		it("should layout simple parent-child tree", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("root"),
				createLayoutNode("child1"),
				createLayoutNode("child2"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "root", "child1", "AUTHORSHIP"),
				createLayoutEdge("e2", "root", "child2", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges);

			expect(result.nodes).toHaveLength(3);
			expect(result.maxDepth).toBe(1);

			// Root should be at level 0, children at level 1
			const rootNode = result.nodes.find((n) => n.node.id === "root");
			const child1Node = result.nodes.find((n) => n.node.id === "child1");

			expect(rootNode?.level).toBe(0);
			expect(child1Node?.level).toBe(1);
		});

		it("should layout three-level tree", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("root"),
				createLayoutNode("child"),
				createLayoutNode("grandchild"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "root", "child", "AUTHORSHIP"),
				createLayoutEdge("e2", "child", "grandchild", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges);

			expect(result.maxDepth).toBe(2);

			const grandchild = result.nodes.find((n) => n.node.id === "grandchild");
			expect(grandchild?.level).toBe(2);
		});
	});

	describe("edge types", () => {
		it("should handle REFERENCE edges", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("work1"),
				createLayoutNode("work2"),
			];
			// work1 references work2, so work2 is parent (earlier work)
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "work1", "work2", "REFERENCE"),
			];

			const result = hierarchicalLayout(nodes, edges);

			expect(result.nodes).toHaveLength(2);
		});

		it("should handle AUTHORSHIP edges", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("author"),
				createLayoutNode("work"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "author", "work", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges);

			expect(result.nodes).toHaveLength(2);
		});

		it("should handle AFFILIATION edges", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("institution"),
				createLayoutNode("author"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "institution", "author", "AFFILIATION"),
			];

			const result = hierarchicalLayout(nodes, edges);

			expect(result.nodes).toHaveLength(2);
		});

		it("should ignore non-parent-child edges", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("A"),
				createLayoutNode("B"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "A", "B", "UNKNOWN_TYPE"),
			];

			const result = hierarchicalLayout(nodes, edges);

			// Without valid parent-child edges, both nodes should be roots
			expect(result.nodes).toHaveLength(2);
		});
	});

	describe("options", () => {
		it("should use custom rootNodeId", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("A"),
				createLayoutNode("B"),
				createLayoutNode("C"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "B", "A", "AUTHORSHIP"),
				createLayoutEdge("e2", "B", "C", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges, { rootNodeId: "B" });

			expect(result.rootNodeId).toBe("B");

			const rootNode = result.nodes.find((n) => n.node.id === "B");
			expect(rootNode?.level).toBe(0);
		});

		it("should apply levelSpacing", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("root"),
				createLayoutNode("child"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "root", "child", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges, { levelSpacing: 200 });

			const rootNode = result.nodes.find((n) => n.node.id === "root");
			const childNode = result.nodes.find((n) => n.node.id === "child");

			// In horizontal direction, level determines x position
			expect(childNode!.x - rootNode!.x).toBe(200);
		});

		it("should apply vertical direction", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("root"),
				createLayoutNode("child"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "root", "child", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges, {
				direction: "vertical",
				levelSpacing: 150,
			});

			const rootNode = result.nodes.find((n) => n.node.id === "root");
			const childNode = result.nodes.find((n) => n.node.id === "child");

			// In vertical direction, level determines y position
			expect(childNode!.y - rootNode!.y).toBe(150);
		});
	});

	describe("positioned node properties", () => {
		it("should include all required properties", () => {
			const nodes: LayoutNode[] = [createLayoutNode("A")];

			const result = hierarchicalLayout(nodes, []);

			expect(result.nodes[0]).toHaveProperty("node");
			expect(result.nodes[0]).toHaveProperty("x");
			expect(result.nodes[0]).toHaveProperty("y");
			expect(result.nodes[0]).toHaveProperty("level");
		});

		it("should have numeric coordinates", () => {
			const nodes: LayoutNode[] = [
				createLayoutNode("A"),
				createLayoutNode("B"),
			];
			const edges: LayoutEdge[] = [
				createLayoutEdge("e1", "A", "B", "AUTHORSHIP"),
			];

			const result = hierarchicalLayout(nodes, edges);

			for (const positioned of result.nodes) {
				expect(typeof positioned.x).toBe("number");
				expect(typeof positioned.y).toBe("number");
				expect(Number.isNaN(positioned.x)).toBe(false);
				expect(Number.isNaN(positioned.y)).toBe(false);
			}
		});
	});
});

describe("toNodePositionMap", () => {
	it("should convert layout result to position map", () => {
		const nodes: LayoutNode[] = [
			createLayoutNode("A"),
			createLayoutNode("B"),
		];
		const edges: LayoutEdge[] = [
			createLayoutEdge("e1", "A", "B", "AUTHORSHIP"),
		];

		const layoutResult = hierarchicalLayout(nodes, edges);
		const positionMap = toNodePositionMap(layoutResult);

		expect(positionMap.size).toBe(2);
		expect(positionMap.has("A")).toBe(true);
		expect(positionMap.has("B")).toBe(true);

		const posA = positionMap.get("A");
		expect(posA).toHaveProperty("x");
		expect(posA).toHaveProperty("y");
	});

	it("should return empty map for empty layout", () => {
		const layoutResult = hierarchicalLayout([], []);
		const positionMap = toNodePositionMap(layoutResult);

		expect(positionMap.size).toBe(0);
	});
});
