/**
 * Ranking Case Registration Integration Tests
 *
 * Validates that ranking cases use valid node IDs that exist in their datasets.
 * Uses actual dataset discovery to validate node ID formats.
 */

import { describe, expect,it } from "vitest";

import { BenchmarkGraphExpander } from "../../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../../evaluation/fixtures/index.js";
import { RANKING_CASES } from "./register-ranking-cases.js";

describe("Ranking Case Registration Integration", () => {
	describe("Node ID Validation", () => {
		it("should validate all ranking case node IDs exist in their datasets", async () => {
			const failures: Array<{
				id: string;
				source: string;
				target: string;
				reason: string;
			}> = [];

			for (const caseSpec of RANKING_CASES) {
				const benchmarkData = await loadBenchmarkByIdFromUrl(caseSpec.id);
				const expander = new BenchmarkGraphExpander(
					benchmarkData.graph,
					benchmarkData.meta.directed
				);
				const nodes = expander.getAllNodeIds();

				const hasSource = nodes.includes(caseSpec.source);
				const hasTarget = nodes.includes(caseSpec.target);

				if (!hasSource) {
					failures.push({
						id: caseSpec.id,
						source: caseSpec.source,
						target: caseSpec.target,
						reason: `Source node '${caseSpec.source}' not found (graph has ${nodes.length} nodes)`,
					});
				} else if (!hasTarget) {
					failures.push({
						id: caseSpec.id,
						source: caseSpec.source,
						target: caseSpec.target,
						reason: `Target node '${caseSpec.target}' not found (graph has ${nodes.length} nodes)`,
					});
				}
			}

			if (failures.length > 0) {
				console.log("\n❌ Invalid node IDs found:");
				for (const failure of failures) {
					console.log(`  ${failure.id}: ${failure.source} -> ${failure.target}`);
					console.log(`    ${failure.reason}`);
				}
				throw new Error(
					`${failures.length} ranking cases have invalid node IDs`
				);
			}

			console.log("\n✓ All ranking cases have valid node IDs");
			expect(failures.length).toBe(0);
		});

		it("should document node ID formats for each dataset", async () => {
			const formats: Record<
				string,
				{
					nodes: number;
					firstIds: string[];
					lastIds: string[];
					sampleEdges: string[];
				}
			> = {};

			for (const caseSpec of RANKING_CASES) {
				if (formats[caseSpec.id]) continue; // Skip duplicates

				const benchmarkData = await loadBenchmarkByIdFromUrl(caseSpec.id);
				const expander = new BenchmarkGraphExpander(
					benchmarkData.graph,
					benchmarkData.meta.directed
				);
				const nodes = expander.getAllNodeIds();
				const edges = benchmarkData.graph.getAllEdges();

				formats[caseSpec.id] = {
					nodes: nodes.length,
					firstIds: nodes.slice(0, 5),
					lastIds: nodes.slice(-5),
					sampleEdges: edges.slice(0, 3).map((e) => `${e.source}→${e.target}`),
				};
			}

			console.log("\nDataset Node ID Formats:");
			for (const [id, info] of Object.entries(formats)) {
				console.log(`\n${id.toUpperCase()} (${info.nodes} nodes, ${info.sampleEdges.length * 3} edges):`);
				console.log(`  First 5: ${info.firstIds.join(", ")}`);
				console.log(`  Last 5: ${info.lastIds.join(", ")}`);
				console.log(`  Sample edges: ${info.sampleEdges.join(", ")}`);
			}

			// Verify expected formats
			expect(formats.karate.firstIds[0]).toBe("1");
			expect(formats.lesmis.firstIds[0]).toBe("Myriel");
			expect(formats.cora.firstIds).toContain("35");
			expect(formats.citeseer.firstIds).toContain("100157");
		});
	});

	describe("Dataset Discovery Tests", () => {
		it("should confirm Cora uses numeric paper IDs", async () => {
			const benchmarkData = await loadBenchmarkByIdFromUrl("cora");
			const expander = new BenchmarkGraphExpander(
				benchmarkData.graph,
				benchmarkData.meta.directed
			);
			const nodes = expander.getAllNodeIds();

			// Cora uses large numeric IDs (e.g., 35, 1033, 103482)
			// NOT 0-indexed sequential IDs
			const allNumeric = nodes.every((id) => /^\d+$/.test(id));
			expect(allNumeric).toBe(true);

			// Node 35 should exist (it's in the sample data)
			expect(nodes).toContain("35");

			// Node 0 should NOT exist (confirms non-0-indexed)
			expect(nodes).not.toContain("0");
		});

		it("should confirm CiteSeer uses mixed numeric and string IDs", async () => {
			const benchmarkData = await loadBenchmarkByIdFromUrl("citeseer");
			const expander = new BenchmarkGraphExpander(
				benchmarkData.graph,
				benchmarkData.meta.directed
			);
			const nodes = expander.getAllNodeIds();

			// CiteSeer has both numeric (100157, 364207) and string IDs (bradshaw97introduction)
			const hasNumeric = nodes.some((id) => /^\d+$/.test(id));
			const hasString = nodes.some((id) => /[a-z]/i.test(id));

			expect(hasNumeric).toBe(true);
			expect(hasString).toBe(true);

			// Known numeric IDs from sample data
			expect(nodes).toContain("100157");
			expect(nodes).toContain("364207");
		});
	});

	describe("Ranking Case Spec Validation", () => {
		it("should use correct node IDs for each dataset", () => {
			const expected: Record<string, { source: string; target: string }> = {
				karate: { source: "1", target: "34" },
				lesmis: { source: "Myriel", target: "Marius" },
				cora: { source: "35", target: "1033" },
				citeseer: { source: "100157", target: "364207" },
				facebook: { source: "0", target: "4000" },
			};

			for (const caseSpec of RANKING_CASES) {
				const expectedIds = expected[caseSpec.id];
				expect(caseSpec.source).toBe(expectedIds.source);
				expect(caseSpec.target).toBe(expectedIds.target);
			}
		});
	});
});
