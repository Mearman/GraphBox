/**
 * Unit tests for cluster quality metrics
 */

import { describe, expect, it } from "vitest";

import { Graph } from "../graph/graph";
import type { Community } from "../types/clustering-types";
import {
	calculateAverageDensity,
	calculateClusterMetrics,
	calculateCoverageRatio,
	calculateDensity,
	updateCommunityDensities,
} from "./cluster-quality";

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

describe("calculateDensity", () => {
	describe("edge cases", () => {
		it("should return 0 for empty cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);

			const cluster = new Set<TestNode>();

			const density = calculateDensity(graph, cluster);

			expect(density).toBe(0);
		});

		it("should return 0 for single-node cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));

			const nodeA = graph.getNode("A");
			if (!nodeA.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value]);

			const density = calculateDensity(graph, cluster);

			expect(density).toBe(0);
		});
	});

	describe("density calculation", () => {
		it("should return 1 for complete graph cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Complete graph (triangle)
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

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value, nodeC.value]);

			const density = calculateDensity(graph, cluster);

			// Triangle has all possible edges: density = 3/3 = 1.0
			expect(density).toBeCloseTo(1, 3);
		});

		it("should calculate partial density for sparse cluster", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			// Line graph (not complete)
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			// Missing A-C edge

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value, nodeC.value]);

			const density = calculateDensity(graph, cluster);

			// Line has 2 edges, possible = 3: density = 2/3 ≈ 0.667
			expect(density).toBeCloseTo(2 / 3, 3);
		});

		it("should return 0 for cluster with no internal edges", () => {
			const graph = new Graph<TestNode, TestEdge>(false);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// No edges between cluster nodes

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value]);

			const density = calculateDensity(graph, cluster);

			expect(density).toBe(0);
		});
	});

	describe("directed graphs", () => {
		it("should calculate density correctly for directed graph", () => {
			const graph = new Graph<TestNode, TestEdge>(true);
			graph.addNode(createNode("A"));
			graph.addNode(createNode("B"));
			graph.addNode(createNode("C"));
			// Directed cycle: A→B, B→C, C→A
			graph.addEdge(createEdge("e1", "A", "B"));
			graph.addEdge(createEdge("e2", "B", "C"));
			graph.addEdge(createEdge("e3", "C", "A"));

			const nodeA = graph.getNode("A");
			const nodeB = graph.getNode("B");
			const nodeC = graph.getNode("C");
			if (!nodeA.some || !nodeB.some || !nodeC.some) throw new Error("Node not found");

			const cluster = new Set<TestNode>([nodeA.value, nodeB.value, nodeC.value]);

			const density = calculateDensity(graph, cluster);

			// Implementation iterates unique pairs (A,B), (A,C), (B,C) and checks forward edges only:
			// - (A,B): A→B exists ✓
			// - (A,C): A→C does not exist (C→A is different) ✗
			// - (B,C): B→C exists ✓
			// Actual edges = 2, possible = 6, density = 2/6 ≈ 0.333
			expect(density).toBeCloseTo(1 / 3, 3);
		});
	});
});

describe("calculateAverageDensity", () => {
	it("should return 0 for empty clusters array", () => {
		const graph = new Graph<TestNode, TestEdge>(false);

		const avgDensity = calculateAverageDensity(graph, []);

		expect(avgDensity).toBe(0);
	});

	it("should calculate average across multiple clusters", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		// Triangle cluster 1
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("e1", "A", "B"));
		graph.addEdge(createEdge("e2", "B", "C"));
		graph.addEdge(createEdge("e3", "A", "C"));

		// Line cluster 2
		graph.addNode(createNode("D"));
		graph.addNode(createNode("E"));
		graph.addNode(createNode("F"));
		graph.addEdge(createEdge("e4", "D", "E"));
		graph.addEdge(createEdge("e5", "E", "F"));

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
			new Set([nodeA.value, nodeB.value, nodeC.value]), // density = 1.0
			new Set([nodeD.value, nodeE.value, nodeF.value]), // density = 2/3
		];

		const avgDensity = calculateAverageDensity(graph, clusters);

		// Average = (1.0 + 2/3) / 2 ≈ 0.833
		expect(avgDensity).toBeCloseTo((1 + 2 / 3) / 2, 2);
	});
});

describe("calculateCoverageRatio", () => {
	it("should return 0 for graph with no edges", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));

		const nodeA = graph.getNode("A");
		const nodeB = graph.getNode("B");
		if (!nodeA.some || !nodeB.some) throw new Error("Node not found");

		const clusters: Set<TestNode>[] = [new Set([nodeA.value, nodeB.value])];

		const coverage = calculateCoverageRatio(graph, clusters);

		expect(coverage).toBe(0);
	});

	it("should return 1 when all edges are within clusters", () => {
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

		// Single cluster containing all nodes
		const clusters: Set<TestNode>[] = [new Set([nodeA.value, nodeB.value, nodeC.value])];

		const coverage = calculateCoverageRatio(graph, clusters);

		expect(coverage).toBeCloseTo(1, 3);
	});

	it("should calculate partial coverage", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addNode(createNode("D"));
		graph.addEdge(createEdge("e1", "A", "B")); // Internal to cluster 1
		graph.addEdge(createEdge("e2", "C", "D")); // Internal to cluster 2
		graph.addEdge(createEdge("e3", "B", "C")); // Between clusters

		const nodeA = graph.getNode("A");
		const nodeB = graph.getNode("B");
		const nodeC = graph.getNode("C");
		const nodeD = graph.getNode("D");
		if (!nodeA.some || !nodeB.some || !nodeC.some || !nodeD.some) {
			throw new Error("Node not found");
		}

		const clusters: Set<TestNode>[] = [
			new Set([nodeA.value, nodeB.value]),
			new Set([nodeC.value, nodeD.value]),
		];

		const coverage = calculateCoverageRatio(graph, clusters);

		// 2 internal edges out of 3 total = 2/3
		expect(coverage).toBeCloseTo(2 / 3, 3);
	});
});

describe("calculateClusterMetrics", () => {
	it("should return all metrics", () => {
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

		const metrics = calculateClusterMetrics(graph, communities);

		expect(metrics).toHaveProperty("modularity");
		expect(metrics).toHaveProperty("avgConductance");
		expect(metrics).toHaveProperty("avgDensity");
		expect(metrics).toHaveProperty("coverageRatio");
		expect(metrics).toHaveProperty("numClusters");
		expect(metrics.numClusters).toBe(1);
	});

	it("should handle empty communities", () => {
		const graph = new Graph<TestNode, TestEdge>(false);

		const communities: Community<TestNode>[] = [];

		const metrics = calculateClusterMetrics(graph, communities);

		expect(metrics.numClusters).toBe(0);
		expect(metrics.modularity).toBe(0);
		expect(metrics.avgConductance).toBe(0);
		expect(metrics.avgDensity).toBe(0);
		expect(metrics.coverageRatio).toBe(0);
	});
});

describe("updateCommunityDensities", () => {
	it("should update density field in communities", () => {
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

		updateCommunityDensities(graph, communities);

		// Triangle has density 1.0
		expect(communities[0].density).toBeCloseTo(1, 3);
	});

	it("should update multiple communities", () => {
		const graph = new Graph<TestNode, TestEdge>(false);
		// Complete triangle
		graph.addNode(createNode("A"));
		graph.addNode(createNode("B"));
		graph.addNode(createNode("C"));
		graph.addEdge(createEdge("e1", "A", "B"));
		graph.addEdge(createEdge("e2", "B", "C"));
		graph.addEdge(createEdge("e3", "A", "C"));

		// Line
		graph.addNode(createNode("D"));
		graph.addNode(createNode("E"));
		graph.addEdge(createEdge("e4", "D", "E"));

		const nodeA = graph.getNode("A");
		const nodeB = graph.getNode("B");
		const nodeC = graph.getNode("C");
		const nodeD = graph.getNode("D");
		const nodeE = graph.getNode("E");
		if (!nodeA.some || !nodeB.some || !nodeC.some || !nodeD.some || !nodeE.some) {
			throw new Error("Node not found");
		}

		const communities: Community<TestNode>[] = [
			createCommunity(0, new Set([nodeA.value, nodeB.value, nodeC.value]), 3, 0),
			createCommunity(1, new Set([nodeD.value, nodeE.value]), 1, 0),
		];

		updateCommunityDensities(graph, communities);

		expect(communities[0].density).toBeCloseTo(1, 3); // Triangle
		expect(communities[1].density).toBeCloseTo(1, 3); // Two nodes with one edge = complete
	});
});
