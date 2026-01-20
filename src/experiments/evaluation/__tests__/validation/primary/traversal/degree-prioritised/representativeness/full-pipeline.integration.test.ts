/**
 * Tests for Full Representativeness Pipeline
 */

import { beforeAll, describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../graphbox/src/algorithms/traversal/degree-prioritised-expansion";
import { FrontierBalancedExpansion } from "../../../../baselines/frontier-balanced";
import { RandomPriorityExpansion } from "../../../../baselines/random-priority";
import { StandardBfsExpansion } from "../../../../baselines/standard-bfs";
import { enumerateBetweenGraph } from "../../../ground-truth/between-graph";
import { computeStructuralRepresentativeness } from "../../../metrics/structural-representativeness";
import { createGridGraph, GraphExpanderAdapter } from "./common/test-graph-expander";

describe("Full Representativeness Pipeline", () => {
	let graph: ReturnType<typeof createGridGraph>;
	let expander: GraphExpanderAdapter;

	beforeAll(() => {
		graph = createGridGraph(6, 6);
		expander = new GraphExpanderAdapter(graph, false);
	});

	it("should compute representativeness for expansion vs ground truth", async () => {
		const seedA = "0_0";
		const seedB = "5_5";

		// Compute ground truth
		const groundTruth = enumerateBetweenGraph(graph, seedA, seedB, {
			maxPathLength: 12,
			maxPaths: 500,
		});

		// Run expansion
		const expansion = new DegreePrioritisedExpansion(expander, [seedA, seedB]);
		const result = await expansion.run();

		// Compute sampled degrees
		const sampledDegrees = new Map<string, number>();
		for (const nodeId of result.sampledNodes) {
			sampledDegrees.set(nodeId, expander.getDegree(nodeId));
		}

		// Compute representativeness
		const metrics = computeStructuralRepresentativeness(
			result.sampledNodes,
			groundTruth.nodes,
			sampledDegrees,
			groundTruth.degrees
		);

		// Metrics should be in valid ranges
		expect(metrics.coverage).toBeGreaterThanOrEqual(0);
		expect(metrics.coverage).toBeLessThanOrEqual(1);
		expect(metrics.precision).toBeGreaterThanOrEqual(0);
		expect(metrics.precision).toBeLessThanOrEqual(1);
		expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
		expect(metrics.f1Score).toBeLessThanOrEqual(1);
		expect(metrics.degreeKL).toBeGreaterThanOrEqual(0);
	});

	it("should compare all expansion methods", async () => {
		const seedA = "1_1";
		const seedB = "4_4";

		// Compute ground truth
		const groundTruth = enumerateBetweenGraph(graph, seedA, seedB, {
			maxPathLength: 8,
			maxPaths: 200,
		});

		if (groundTruth.nodes.size < 3) {
			// Skip if ground truth is too small
			return;
		}

		const methods = [
			{ name: "Degree-Prioritised", expansion: new DegreePrioritisedExpansion(expander, [seedA, seedB]) },
			{ name: "Standard BFS", expansion: new StandardBfsExpansion(expander, [seedA, seedB]) },
			{ name: "Frontier-Balanced", expansion: new FrontierBalancedExpansion(expander, [seedA, seedB]) },
			{ name: "Random Priority", expansion: new RandomPriorityExpansion(expander, [seedA, seedB], 42) },
		];

		const results = await Promise.all(
			methods.map(async (m) => {
				const result = await m.expansion.run();

				const sampledDegrees = new Map<string, number>();
				for (const nodeId of result.sampledNodes) {
					sampledDegrees.set(nodeId, expander.getDegree(nodeId));
				}

				const metrics = computeStructuralRepresentativeness(
					result.sampledNodes,
					groundTruth.nodes,
					sampledDegrees,
					groundTruth.degrees
				);

				return { name: m.name, metrics };
			})
		);

		// All methods should produce valid metrics
		for (const r of results) {
			expect(r.metrics.coverage).toBeGreaterThanOrEqual(0);
			expect(r.metrics.precision).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(r.metrics.degreeKL)).toBe(true);
		}
	});
});
