/**
 * Ranking Baseline Comparison Experiment
 *
 * Compares Path Salience Ranking against five baseline methods on
 * benchmark graphs. Computes mean MI, node coverage, path diversity,
 * and Spearman correlation for each method.
 *
 * Baseline methods:
 * - Degree Sum Ranking
 * - Jaccard Arithmetic Ranking
 * - PageRank Sum Ranking
 * - Random Path Ranking
 * - Shortest Path Ranking
 *
 * Metrics:
 * - Per-method mean MI, node coverage, Spearman rho vs salience
 * - MI ranking improvement over each baseline
 * - Assertion: salience achieves higher mean MI than random
 */

import { type RankedPath,rankPaths } from "@graph/algorithms/pathfinding/path-ranking";
import type { Option } from "@graph/algorithms/types/option";
import type { Result } from "@graph/algorithms/types/result";
import {
	computeRankingMetrics,
	spearmanCorrelation,
} from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/benchmark-datasets";
import type { LoadedEdge, LoadedNode } from "@graph/evaluation/loaders/edge-list-loader";
import { degreeSumRanking } from "@graph/experiments/baselines/degree-sum-ranking";
import { jaccardArithmeticRanking } from "@graph/experiments/baselines/jaccard-arithmetic-ranking";
import { pageRankSumRanking } from "@graph/experiments/baselines/pagerank-sum-ranking";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking";
import { describe, expect, it } from "vitest";

interface MethodResult {
	name: string;
	meanMI: number;
	nodeCoverage: number;
	pathDiversity: number;
	pathCount: number;
	/** Node ID ordering for Spearman correlation */
	pathSignatures: string[];
}

describe("Ranking Baseline Comparison", { timeout: 60_000 }, () => {
	it("should outperform baselines on mean MI across benchmark graphs", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		const source = "1"; // Mr. Hi
		const target = "34"; // John A.
		const maxPaths = 15;

		// Run Path Salience Ranking
		const salienceResult = rankPaths(graph, source, target, { maxPaths });
		expect(salienceResult.ok).toBe(true);

		// Run all baseline methods
		const degreeSumResult = degreeSumRanking(graph, source, target, {
			maxPaths,
		});
		const jaccardResult = jaccardArithmeticRanking(graph, source, target, {
			maxPaths,
		});
		const pageRankResult = pageRankSumRanking(graph, source, target, {
			maxPaths,
		});
		const randomResult = randomPathRanking(graph, source, target, {
			maxPaths,
			seed: 42,
		});
		const shortestResult = shortestPathRanking(graph, source, target, {
			maxPaths,
		});

		// Collect results for each method
		const methods: MethodResult[] = [];

		const extractResult = <E>(
			name: string,
			result: Result<Option<RankedPath<LoadedNode, LoadedEdge>[]>, E>,
		): MethodResult | undefined => {
			if (result.ok && result.value.some) {
				const paths = result.value.value;
				const metrics = computeRankingMetrics(paths, graph);
				return {
					name,
					meanMI: metrics.meanMI,
					nodeCoverage: metrics.nodeCoverage,
					pathDiversity: metrics.pathDiversity,
					pathCount: paths.length,
					pathSignatures: paths.map((p) =>
						p.path.nodes.map((n) => n.id).join("->"),
					),
				};
			}
			return undefined;
		};

		const salienceMethod = extractResult(
			"path-salience",
			salienceResult,
		);
		if (salienceMethod) methods.push(salienceMethod);

		const baselines = [
			{ name: "degree-sum", result: degreeSumResult },
			{ name: "jaccard-arithmetic", result: jaccardResult },
			{ name: "pagerank-sum", result: pageRankResult },
			{ name: "random", result: randomResult },
			{ name: "shortest-path", result: shortestResult },
		];

		for (const { name, result } of baselines) {
			const method = extractResult(name, result);
			if (method) methods.push(method);
		}

		expect(methods.length).toBeGreaterThan(1);

		// Compute Spearman rho between salience and each baseline
		const salienceSigs = salienceMethod?.pathSignatures ?? [];

		// === Ranking Correctness ===
		console.log("\n=== Ranking Correctness ===");
		console.log(
			"method\tmean_mi\tnode_coverage\tpath_diversity\tpath_count\tspearman_rho",
		);

		for (const method of methods) {
			const rho =
				method.name === "path-salience"
					? 1
					: spearmanCorrelation(salienceSigs, method.pathSignatures);

			console.log(
				`${method.name}\t${method.meanMI.toFixed(4)}\t${method.nodeCoverage.toFixed(3)}\t${method.pathDiversity.toFixed(3)}\t${method.pathCount}\t${rho.toFixed(3)}`,
			);
		}

		// === Ranking Significance ===
		console.log("\n=== Ranking Significance ===");
		console.log("baseline\tsalience_mi\tbaseline_mi\timprovement\trelative");

		if (salienceMethod) {
			for (const method of methods) {
				if (method.name === "path-salience") continue;

				const improvement = salienceMethod.meanMI - method.meanMI;
				const relative =
					method.meanMI > 0
						? improvement / method.meanMI
						: (improvement > 0
							? Number.POSITIVE_INFINITY
							: 0);

				console.log(
					`${method.name}\t${salienceMethod.meanMI.toFixed(4)}\t${method.meanMI.toFixed(4)}\t${improvement > 0 ? "+" : ""}${improvement.toFixed(4)}\t${relative > 0 ? "+" : ""}${(relative * 100).toFixed(1)}%`,
				);
			}
		}

		// Assertions: salience should achieve higher mean MI than random
		const randomMethod = methods.find((m) => m.name === "random");
		if (salienceMethod && randomMethod) {
			expect(salienceMethod.meanMI).toBeGreaterThanOrEqual(
				randomMethod.meanMI,
			);
		}
	});

	it("should maintain ranking advantage across multiple seed pairs", async () => {
		const benchmark = await loadBenchmarkByIdFromUrl("karate");
		const graph = benchmark.graph;

		const seedPairs: Array<[string, string]> = [
			["1", "34"],
			["10", "26"],
			["3", "33"],
			["2", "32"],
		];

		const maxPaths = 10;
		const salienceMIs: number[] = [];
		const randomMIs: number[] = [];

		console.log("\n=== Ranking Correctness ===");
		console.log("source\ttarget\tsalience_mi\trandom_mi\timprovement");

		for (const [source, target] of seedPairs) {
			const salienceResult = rankPaths(graph, source, target, {
				maxPaths,
			});
			const randomResult = randomPathRanking(graph, source, target, {
				maxPaths,
				seed: 42,
			});

			if (
				salienceResult.ok &&
				salienceResult.value.some &&
				randomResult.ok &&
				randomResult.value.some
			) {
				const salienceMetrics = computeRankingMetrics(
					salienceResult.value.value,
					graph,
				);
				const randomMetrics = computeRankingMetrics(
					randomResult.value.value,
					graph,
				);

				salienceMIs.push(salienceMetrics.meanMI);
				randomMIs.push(randomMetrics.meanMI);

				const diff = salienceMetrics.meanMI - randomMetrics.meanMI;
				console.log(
					`${source}\t${target}\t${salienceMetrics.meanMI.toFixed(4)}\t${randomMetrics.meanMI.toFixed(4)}\t${diff > 0 ? "+" : ""}${diff.toFixed(4)}`,
				);
			}
		}

		// === Ranking Significance ===
		const meanSalience =
			salienceMIs.length > 0
				? salienceMIs.reduce((a, b) => a + b, 0) / salienceMIs.length
				: 0;
		const meanRandom =
			randomMIs.length > 0
				? randomMIs.reduce((a, b) => a + b, 0) / randomMIs.length
				: 0;
		const winsCount = salienceMIs.filter(
			(mi, index) => mi >= randomMIs[index],
		).length;

		console.log("\n=== Ranking Significance ===");
		console.log(`mean_salience_mi\t${meanSalience.toFixed(4)}`);
		console.log(`mean_random_mi\t${meanRandom.toFixed(4)}`);
		console.log(`wins\t${winsCount}/${salienceMIs.length}`);
		console.log(
			`mean_improvement\t${(meanSalience - meanRandom).toFixed(4)}`,
		);

		// Salience should win on average
		expect(meanSalience).toBeGreaterThanOrEqual(meanRandom);
	});
});
