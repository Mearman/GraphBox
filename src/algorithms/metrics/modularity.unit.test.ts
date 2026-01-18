/**
 * Unit tests for modularity calculation
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import type { Community } from "../types/clustering-types";
import {
	calculateCommunityModularity,
	calculateModularity,
	calculateModularityDelta,
} from "./modularity";

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

// Helper to create a community with required fields
const createCommunity = (
	id: number,
	nodes: Set<TestNode>,
	internalEdges: number,
	externalEdges: number
): Community<TestNode> => ({
	id,
	nodes,
	internalEdges,
	externalEdges,
	modularity: 0,
	density: 0,
	size: nodes.size,
});

describe("calculateModularity", () => {
	describe("edge cases", () => {
		it("should return 0 for empty graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			const communities: Community<TestNode>[] = [];

			const Q = calculateModularity(graph, communities);

			expect(Q).toBe(0);
		});

		it("should return 0 for graph with no edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value, nodeB.value]), 0, 0),
			];

			const Q = calculateModularity(graph, communities);

			expect(Q).toBe(0);
		});
	});

	describe("single community", () => {
		it("should calculate modularity for single community covering all nodes", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value, nodeB.value, nodeC.value]), 3, 0),
			];

			const Q = calculateModularity(graph, communities);

			// Single community covering all nodes has modularity of 0
			expect(Q).toBeCloseTo(0, 3);
		});
	});

	describe("multiple communities", () => {
		it("should calculate positive modularity for well-separated communities", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Community 1: A-B-C (triangle)
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			// Community 2: D-E-F (triangle)
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addNode(createNode("F"));
			graph.addEdge(createEdge("e4", "D", "E"));
			graph.addEdge(createEdge("e5", "E", "F"));
			graph.addEdge(createEdge("e6", "D", "F"));

			// Single bridge edge between communities
			graph.addEdge(createEdge("e7", "C", "D"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			const nodeD = graph.getNode("D");
			const nodeE = graph.getNode("E");
			const nodeF = graph.getNode("F");
			if (!nodeA.some || !nodeB.some || !nodeC.some || !nodeD.some || !nodeE.some || !nodeF.some) {
				throw new Error("Node not found");
			}

			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value, nodeB.value, nodeC.value]), 3, 1),
				createCommunity(1, new Set([nodeD.value, nodeE.value, nodeF.value]), 3, 1),
			];

			const Q = calculateModularity(graph, communities);

			// Well-separated communities should have positive modularity
			expect(Q).toBeGreaterThan(0);
		});

		it("should calculate modularity for poorly separated communities", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Create a line graph: A-B-C-D
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "D"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			const nodeD = graph.getNode("D");
			if (!nodeA.some || !nodeB.some || !nodeC.some || !nodeD.some) {
				throw new Error("Node not found");
			}

			// Poor partition: separate middle nodes into different communities
			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value, nodeC.value]), 0, 2),
				createCommunity(1, new Set([nodeB.value, nodeD.value]), 0, 2),
			];

			const Q = calculateModularity(graph, communities);

			// Poor separation should have lower (possibly negative) modularity
			expect(Q).toBeLessThan(0.3);
		});
	});

	describe("directed graphs", () => {
		it("should calculate modularity for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value, nodeB.value, nodeC.value]), 3, 0),
			];

			const Q = calculateModularity(graph, communities);

			expect(typeof Q).toBe("number");
			expect(Q).not.toBeNaN();
		});
	});

	describe("modularity bounds", () => {
		it("should return modularity in valid range [-0.5, 1.0]", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const communities: Community<TestNode>[] = [
				createCommunity(0, new Set([nodeA.value]), 0, 1),
				createCommunity(1, new Set([nodeB.value]), 0, 2),
				createCommunity(2, new Set([nodeC.value]), 0, 1),
			];

			const Q = calculateModularity(graph, communities);

			expect(Q).toBeGreaterThanOrEqual(-0.5);
			expect(Q).toBeLessThanOrEqual(1);
		});
	});
});

describe("calculateCommunityModularity", () => {
	it("should return 0 for zero total edges", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));

		const nodeA = graph.getNode("A");
		if (!nodeA.some) throw new Error("Node not found");

		const community = createCommunity(0, new Set([nodeA.value]), 0, 0);

		const Q_c = calculateCommunityModularity(graph, community, 0);

		expect(Q_c).toBe(0);
	});

	it("should calculate community modularity correctly", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		// Two separate triangles - well-separated communities
		// Community 1: A-B-C
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("e1", "A", "B"));
		graph.addEdge(createEdge("e2", "B", "C"));
		graph.addEdge(createEdge("e3", "A", "C"));

		// Community 2: D-E-F
		graph.addNode(createNode("D"));
		graph.addNode(createNode("E"));
		graph.addNode(createNode("F"));
		graph.addEdge(createEdge("e4", "D", "E"));
		graph.addEdge(createEdge("e5", "E", "F"));
		graph.addEdge(createEdge("e6", "D", "F"));

		const nodeA = graph.getNode("A");
		const nodeB = graph.getNode("B");
		const nodeC = graph.getNode("C");
		if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

		const community = createCommunity(0, new Set([nodeA.value, nodeB.value, nodeC.value]), 3, 0);

		const Q_c = calculateCommunityModularity(graph, community, 6);

		// With no external edges and symmetric communities, modularity should be positive
		// Each node has degree 2, all edges internal, this is an ideal community structure
		expect(Q_c).toBeGreaterThan(0);
	});
});

describe("calculateModularityDelta", () => {
	it("should return positive delta for beneficial move", () => {
		// Scenario: moving a node to a community with high internal connectivity
		const k_index = 4; // Degree of node being moved
		const k_index_in = 3; // Edges to nodes in target community
		const sigma_tot = 10; // Sum of degrees in target community
		const sigma_in = 8; // Internal edges in target community
		const m = 20; // Total edges

		const deltaQ = calculateModularityDelta(k_index, k_index_in, sigma_tot, sigma_in, m);

		// Moving node with many connections to the target should improve modularity
		expect(deltaQ).toBeGreaterThan(0);
	});

	it("should return negative delta for detrimental move", () => {
		// Scenario: moving a node with few connections to target community
		const k_index = 4; // Degree of node being moved
		const k_index_in = 0; // No edges to nodes in target community
		const sigma_tot = 20; // High degree sum in target community
		const sigma_in = 15; // High internal edges in target community
		const m = 50; // Total edges

		const deltaQ = calculateModularityDelta(k_index, k_index_in, sigma_tot, sigma_in, m);

		// Moving node with no connections to target should decrease modularity
		expect(deltaQ).toBeLessThan(0);
	});

	it("should return 0 delta when move has no effect", () => {
		// Scenario: trivial case with zero values
		const deltaQ = calculateModularityDelta(0, 0, 0, 0, 10);

		expect(deltaQ).toBe(0);
	});
});
