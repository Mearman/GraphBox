/**
 * Path Salience Ranking Experiments
 *
 * Evaluates the Mutual Information-based path ranking algorithm.
 * Measures MI quality, node coverage, and path diversity across benchmark datasets.
 */

import { rankPaths } from "@graph/algorithms/pathfinding/path-ranking.js";
import { computeRankingMetrics } from "@graph/evaluation/__tests__/validation/common/path-ranking-helpers.js";
import { cohensD, mannWhitneyUTest } from "@graph/evaluation/__tests__/validation/common/statistical-functions.js";
import { loadBenchmarkByIdFromUrl } from "@graph/evaluation/fixtures/index.js";
import { randomPathRanking } from "@graph/experiments/baselines/random-path-ranking.js";
import { shortestPathRanking } from "@graph/experiments/baselines/shortest-path-ranking.js";
import { metrics } from "@graph/experiments/metrics/index.js";
import type { MIRankingQualityMetric } from "@graph/experiments/metrics/types.js";

/**
 * Run MI ranking quality experiments on benchmark datasets.
 *
 * Measures mean MI, node coverage, and path diversity for Path Salience Ranking.
 */
export const runMIRankingQualityExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", name: "Karate Club", source: "1", target: "34", maxPaths: 15 },
		{ id: "lesmis", name: "Les Misérables", source: "11", target: "27", maxPaths: 18 },
	];

	for (const dataset of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
		const graph = benchmark.graph;

		const result = rankPaths(graph, dataset.source, dataset.target, {
			maxPaths: dataset.maxPaths,
		});

		if (result.ok && result.value.some) {
			const paths = result.value.value;
			const rankingMetrics = computeRankingMetrics(paths, graph);

			metrics.record("mi-ranking-quality", {
				dataset: dataset.name,
				meanMI: Math.round(rankingMetrics.meanMI * 100) / 100,
				nodeCoverage: Math.round(rankingMetrics.nodeCoverage * 100) / 100,
				pathDiversity: Math.round(rankingMetrics.pathDiversity * 1000) / 1000,
				paths: paths.length,
			} satisfies MIRankingQualityMetric);
		}
	}
};

/**
 * Run statistical significance tests for Path Salience Ranking.
 *
 * Compares Path Salience against Random baseline using Mann-Whitney U test.
 */
export const runStatisticalSignificanceExperiments = async (): Promise<void> => {
	const benchmark = await loadBenchmarkByIdFromUrl("lesmis");
	const graph = benchmark.graph;
	const source = "11";
	const target = "27";

	// Run multiple trials for statistical significance
	const salienceMI: number[] = [];
	const randomMI: number[] = [];
	const trials = 10;

	for (let index = 0; index < trials; index++) {
		const salienceResult = rankPaths(graph, source, target, { maxPaths: 10 });
		const randomResult = randomPathRanking(graph, source, target, {
			maxPaths: 10,
			seed: 100 + index,
		});

		if (salienceResult.ok && randomResult.ok &&
			salienceResult.value.some && randomResult.value.some) {

			const salienceMetrics = computeRankingMetrics(salienceResult.value.value, graph);
			const randomMetrics = computeRankingMetrics(randomResult.value.value, graph);

			salienceMI.push(salienceMetrics.meanMI);
			randomMI.push(randomMetrics.meanMI);
		}
	}

	const salienceMean = salienceMI.reduce((a, b) => a + b, 0) / salienceMI.length;
	const randomMean = randomMI.reduce((a, b) => a + b, 0) / randomMI.length;

	// Perform Mann-Whitney U test
	const statTest = mannWhitneyUTest(salienceMI, randomMI);
	const effectSize = cohensD(salienceMI, randomMI);

	metrics.record("statistical-significance", {
		comparison: "Path Salience vs Random",
		method1Mean: Math.round(salienceMean * 1000) / 1000,
		method2Mean: Math.round(randomMean * 1000) / 1000,
		statistic: "Mann-Whitney U",
		u: Math.round(statTest.u * 100) / 100,
		pValue: Math.round(statTest.pValue * 10_000) / 10_000,
		cohensD: Math.round(effectSize * 1000) / 1000,
	});
};

/**
 * Run ranking benchmark experiments.
 *
 * Compares Path Salience against Shortest Path and Random baselines.
 */
export const runRankingBenchmarkExperiments = async (): Promise<void> => {
	const datasets = [
		{ id: "karate", name: "Karate Club", source: "1", target: "34" },
		{ id: "lesmis", name: "Les Misérables", source: "11", target: "27" },
	];

	for (const dataset of datasets) {
		const benchmark = await loadBenchmarkByIdFromUrl(dataset.id);
		const graph = benchmark.graph;

		const salienceResult = rankPaths(graph, dataset.source, dataset.target, { maxPaths: 10 });
		const shortestResult = shortestPathRanking(graph, dataset.source, dataset.target, { maxPaths: 10 });
		const randomResult = randomPathRanking(graph, dataset.source, dataset.target, { maxPaths: 10, seed: 42 });

		if (salienceResult.ok && shortestResult.ok && randomResult.ok &&
			salienceResult.value.some && shortestResult.value.some && randomResult.value.some) {

			const salienceMetrics = computeRankingMetrics(salienceResult.value.value, graph);
			const shortestMetrics = computeRankingMetrics(shortestResult.value.value, graph);
			const randomMetrics = computeRankingMetrics(randomResult.value.value, graph);

			// Record Path Salience results
			metrics.record("ranking-benchmarks", {
				dataset: dataset.name,
				method: "Path Salience",
				meanMI: Math.round(salienceMetrics.meanMI * 100) / 100,
				nodeCoverage: Math.round(salienceMetrics.nodeCoverage * 100) / 100,
				pathDiversity: Math.round(salienceMetrics.pathDiversity * 1000) / 1000,
			});

			// Record Shortest Path results
			metrics.record("ranking-benchmarks", {
				dataset: dataset.name,
				method: "Shortest Path",
				meanMI: Math.round(shortestMetrics.meanMI * 100) / 100,
				nodeCoverage: Math.round(shortestMetrics.nodeCoverage * 100) / 100,
				pathDiversity: Math.round(shortestMetrics.pathDiversity * 1000) / 1000,
			});

			// Record Random results
			metrics.record("ranking-benchmarks", {
				dataset: dataset.name,
				method: "Random",
				meanMI: Math.round(randomMetrics.meanMI * 100) / 100,
				nodeCoverage: Math.round(randomMetrics.nodeCoverage * 100) / 100,
				pathDiversity: Math.round(randomMetrics.pathDiversity * 1000) / 1000,
			});
		}
	}
};

/**
 * Run all path ranking experiments.
 */
export const runPathRankingExperiments = async (): Promise<void> => {
	console.log("Running Path Ranking experiments...");

	await runMIRankingQualityExperiments();
	console.log("  ✓ MI ranking quality experiments complete");

	await runStatisticalSignificanceExperiments();
	console.log("  ✓ Statistical significance experiments complete");

	await runRankingBenchmarkExperiments();
	console.log("  ✓ Ranking benchmark experiments complete");

	console.log("Path Ranking experiments complete!");
};
