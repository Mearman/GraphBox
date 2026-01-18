/**
 * Unit tests for conductance calculation
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import {
	calculateAverageConductance,
	calculateConductance,
	calculateWeightedAverageConductance,
} from "./conductance";

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

describe("calculateConductance", () => {
	describe("edge cases", () => {
		it("should return 0 for empty cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const cluster = new Set<TestNode>();

			const conductance = calculateConductance(graph, cluster);

			expect(conductance).toBe(0);
		});

		it("should return 0 when cluster is entire graph", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addEdge(createEdge("e1", "A", "B"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value]);

			const conductance = calculateConductance(graph, cluster);

			// No boundary edges when cluster is entire graph
			expect(conductance).toBe(0);
		});
	});

	describe("conductance calculation", () => {
		it("should calculate low conductance for well-separated cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Two triangles connected by a single bridge edge
			// Cluster 1: A-B-C (triangle)
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "A", "C"));

			// Cluster 2: D-E-F (triangle)
			graph.addNode(createNode("D"));
			graph.addNode(createNode("E"));
			graph.addNode(createNode("F"));
			graph.addEdge(createEdge("e4", "D", "E"));
			graph.addEdge(createEdge("e5", "E", "F"));
			graph.addEdge(createEdge("e6", "D", "F"));

			// Bridge edge
			graph.addEdge(createEdge("e7", "C", "D"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value, nodeC.value]);

			const conductance = calculateConductance(graph, cluster);

			// cut(S) = 1 (C-D bridge)
			// vol(S) = 2 + 2 + 3 = 7 (degrees of A, B, C)
			// vol(complement) = 3 + 2 + 2 = 7 (degrees of D, E, F)
			// conductance = 1 / min(7, 7) = 1/7 ≈ 0.143
			expect(conductance).toBeLessThan(0.5);
			expect(conductance).toBeGreaterThanOrEqual(0);
		});

		it("should calculate high conductance for poorly-separated cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Star graph: A connected to B, C, D
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "A", "C"));
			graph.addEdge(createEdge("e3", "A", "D"));

			const nodeA = graph.getNode("A");
			if (!nodeA.some) throw new Error("Node not found");

			// Cluster with just center node - all edges are boundary edges
			const cluster = new Set<TestNode>([nodeA.value]);

			const conductance = calculateConductance(graph, cluster);

			// High conductance (all edges cross boundary)
			expect(conductance).toBeGreaterThan(0.5);
			expect(conductance).toBeLessThanOrEqual(1);
		});

		it("should return 0 for isolated cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Two disconnected components
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addNode(createNode("D"));
			graph.addEdge(createEdge("e1", "A", "B")); // Component 1
			graph.addEdge(createEdge("e2", "C", "D")); // Component 2

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

			// Cluster is completely isolated component
			const cluster = new Set<TestNode>([nodeA.value, nodeB.value]);

			const conductance = calculateConductance(graph, cluster);

			// No boundary edges for isolated component
			expect(conductance).toBe(0);
		});
	});

	describe("conductance bounds", () => {
		it("should return conductance in valid range [0, 1]", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value]);

			const conductance = calculateConductance(graph, cluster);

			expect(conductance).toBeGreaterThanOrEqual(0);
			expect(conductance).toBeLessThanOrEqual(1);
		});
	});
});

describe("calculateAverageConductance", () => {
	it("should return 0 for empty clusters array", () => {
		const graph = new Graph<TestNode, TestEdge>(false);

		const avgConductance = calculateAverageConductance(graph, []);

		expect(avgConductance).toBe(0);
	});

	it("should calculate average across multiple clusters", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		// Two separate triangles
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addNode(createNode("D"));
		graph.addNode(createNode("E"));
		graph.addNode(createNode("F"));

		// Triangle 1
		graph.addEdge(createEdge("e1", "A", "B"));
		graph.addEdge(createEdge("e2", "B", "C"));
		graph.addEdge(createEdge("e3", "A", "C"));

		// Triangle 2
		graph.addEdge(createEdge("e4", "D", "E"));
		graph.addEdge(createEdge("e5", "E", "F"));
		graph.addEdge(createEdge("e6", "D", "F"));

		// Bridge edge
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

		const clusters: Set<TestNode>[] = [
			new Set([nodeA.value, nodeB.value, nodeC.value]),
			new Set([nodeD.value, nodeE.value, nodeF.value]),
		];

		const avgConductance = calculateAverageConductance(graph, clusters);

		expect(avgConductance).toBeGreaterThanOrEqual(0);
		expect(avgConductance).toBeLessThanOrEqual(1);
	});
});

describe("calculateWeightedAverageConductance", () => {
	it("should return 0 for empty clusters array", () => {
		const graph = new Graph<TestNode, TestEdge>(false);

		const weightedAvg = calculateWeightedAverageConductance(graph, []);

		expect(weightedAvg).toBe(0);
	});

	it("should weight by cluster size", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		// Large cluster: A-B-C-D (4 nodes)
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addNode(createNode("D"));
		graph.addEdge(createEdge("e1", "A", "B"));
		graph.addEdge(createEdge("e2", "B", "C"));
		graph.addEdge(createEdge("e3", "C", "D"));
		graph.addEdge(createEdge("e4", "A", "D"));

		// Small cluster: E (1 node)
		graph.addNode(createNode("E"));
		graph.addEdge(createEdge("e5", "D", "E"));

		const nodeA = graph.getNode("A");
		const nodeB = graph.getNode("B");
		const nodeC = graph.getNode("C");
		const nodeD = graph.getNode("D");
		const nodeE = graph.getNode("E");
		if (!nodeA.some || !nodeB.some || !nodeC.some || !nodeD.some || !nodeE.some) {
			throw new Error("Node not found");
		}

		const clusters: Set<TestNode>[] = [
			new Set([nodeA.value, nodeB.value, nodeC.value, nodeD.value]), // Large cluster
			new Set([nodeE.value]), // Small cluster
		];

		const weightedAvg = calculateWeightedAverageConductance(graph, clusters);

		expect(weightedAvg).toBeGreaterThanOrEqual(0);
		expect(weightedAvg).toBeLessThanOrEqual(1);
	});

	it("should return 0 when all clusters are empty", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));

		const clusters: Set<TestNode>[] = [new Set(), new Set()];

		const weightedAvg = calculateWeightedAverageConductance(graph, clusters);

		expect(weightedAvg).toBe(0);
	});
});
