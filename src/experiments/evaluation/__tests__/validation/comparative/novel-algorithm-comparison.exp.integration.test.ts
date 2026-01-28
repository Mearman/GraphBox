/**
 * Novel Algorithm Statistical Comparison Tests
 *
 * Compares novel expansion algorithms (EGE, PPME, RSGE) against the
 * DegreePrioritised baseline using statistical significance tests
 * (Mann-Whitney U) and effect sizes (Cohen's d).
 *
 * Tests use multiple benchmark datasets (karate, lesmis, cora) with
 * multiple trials per configuration for statistical power.
 */

import { describe, expect, it } from "vitest";

import { DegreePrioritisedExpansion } from "../../../../../algorithms/traversal/degree-prioritised-expansion";
import { EntropyGuidedExpansion } from "../../../../../algorithms/traversal/entropy-guided-expansion";
import { PathPreservingExpansion } from "../../../../../algorithms/traversal/path-preserving-expansion";
import { RetrospectiveSalienceExpansion } from "../../../../../algorithms/traversal/retrospective-salience-expansion";
import { loadBenchmarkByIdFromUrl } from "../../../fixtures/benchmark-datasets";
import { BenchmarkGraphExpander } from "../common/benchmark-graph-expander";
import { cohensD, confidenceInterval, mannWhitneyUTest, pathDiversity } from "../common/statistical-functions";

/**
 * Helper to compute node coverage ratio.
 * @param sampledNodes
 * @param totalNodes
 */
const nodeCoverage = (sampledNodes: Set<string>, totalNodes: number): number => {
	return totalNodes > 0 ? sampledNodes.size / totalNodes : 0;
};

/**
 * Helper to compute frontier divergence (1 - Jaccard similarity of visited sets).
 * Higher divergence = frontiers explored different regions.
 * @param visitedPerFrontier
 */
const frontierDivergence = (visitedPerFrontier: Array<Set<string>>): number => {
	if (visitedPerFrontier.length < 2) return 0;

	// Compute pairwise Jaccard similarity, return 1 - average
	let totalJaccard = 0;
	let pairCount = 0;

	for (let index = 0; index < visitedPerFrontier.length; index++) {
		for (let index_ = index + 1; index_ < visitedPerFrontier.length; index_++) {
			const setA = visitedPerFrontier[index];
			const setB = visitedPerFrontier[index_];

			const intersection = new Set([...setA].filter((x) => setB.has(x)));
			const union = new Set([...setA, ...setB]);

			const jaccard = union.size > 0 ? intersection.size / union.size : 0;
			totalJaccard += jaccard;
			pairCount++;
		}
	}

	const avgJaccard = pairCount > 0 ? totalJaccard / pairCount : 0;
	return 1 - avgJaccard; // Higher = more divergent
};

/**
 * Helper to compute path overlap ratio.
 * Lower overlap = more diverse paths.
 * @param paths
 */
const pathOverlap = (paths: Array<{ nodes: string[] }>): number => {
	if (paths.length < 2) return 0;

	// Count shared nodes across paths
	const nodeFrequency = new Map<string, number>();
	let totalNodes = 0;

	for (const path of paths) {
		for (const node of path.nodes) {
			nodeFrequency.set(node, (nodeFrequency.get(node) ?? 0) + 1);
			totalNodes++;
		}
	}

	// Overlap = proportion of node occurrences that are duplicates
	let duplicateOccurrences = 0;
	for (const count of nodeFrequency.values()) {
		if (count > 1) {
			duplicateOccurrences += count - 1;
		}
	}

	return totalNodes > 0 ? duplicateOccurrences / totalNodes : 0;
};

/**
 * Helper to compute salience coverage (fraction of high-degree nodes in paths).
 * @param paths
 * @param expander
 * @param threshold
 */
const salienceCoverage = (
	paths: Array<{ nodes: string[] }>,
	expander: BenchmarkGraphExpander,
	threshold = 5
): number => {
	const pathNodes = new Set<string>();
	for (const path of paths) {
		for (const node of path.nodes) {
			pathNodes.add(node);
		}
	}

	let highDegreeInPaths = 0;
	let totalHighDegree = 0;

	for (const nodeId of expander.getAllNodeIds()) {
		const degree = expander.getDegree(nodeId);
		if (degree >= threshold) {
			totalHighDegree++;
			if (pathNodes.has(nodeId)) {
				highDegreeInPaths++;
			}
		}
	}

	return totalHighDegree > 0 ? highDegreeInPaths / totalHighDegree : 0;
};

/**
 * Helper to compute mean path MI approximation.
 * Uses path length entropy as a proxy for mutual information.
 * @param paths
 * @param expander
 */
const meanPathMI = (paths: Array<{ nodes: string[] }>, expander: BenchmarkGraphExpander): number => {
	if (paths.length === 0) return 0;

	// Approximate MI using degree distribution along paths
	let totalMI = 0;

	for (const path of paths) {
		if (path.nodes.length < 2) continue;

		// MI approximation: log of product of degree ratios
		let pathMI = 0;
		const totalDegree = expander.getAllNodeIds().reduce((sum, id) => sum + expander.getDegree(id), 0);
		const avgDegree = totalDegree / expander.getNodeCount();

		for (const node of path.nodes) {
			const degree = expander.getDegree(node);
			// PMI approximation: log(deg / avgDeg)
			const pmi = degree > 0 && avgDegree > 0 ? Math.log2(degree / avgDegree) : 0;
			pathMI += Math.abs(pmi);
		}

		totalMI += pathMI / path.nodes.length;
	}

	return totalMI / paths.length;
};

/**
 * Effect size interpretation helper.
 * @param d
 */
const interpretEffect = (d: number): string => {
	if (d < 0.2) return "negligible";
	if (d < 0.5) return "small";
	if (d < 0.8) return "medium";
	return "large";
};

describe("Thesis Validation: Novel Algorithm Statistical Comparison", () => {
	const trials = 10;
	const benchmarkIds = ["karate", "lesmis", "cora"] as const;

	describe("EGE vs DegreePrioritised", () => {
		it("should test statistically significant difference in path diversity", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				// Get test seeds
				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpDiversity: number[] = [];
				const egeDiversity: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ege = new EntropyGuidedExpansion(expander, seeds);

					const [dpRes, egeRes] = await Promise.all([dp.run(), ege.run()]);

					dpDiversity.push(pathDiversity(dpRes.paths));
					egeDiversity.push(pathDiversity(egeRes.paths));
				}

				const mwTest = mannWhitneyUTest(dpDiversity, egeDiversity);
				const effect = cohensD(dpDiversity, egeDiversity);
				const dpCI = confidenceInterval(dpDiversity);
				const egeCI = confidenceInterval(egeDiversity);

				const dpMean = dpDiversity.reduce((a, b) => a + b, 0) / dpDiversity.length;
				const egeMean = egeDiversity.reduce((a, b) => a + b, 0) / egeDiversity.length;

				console.log(`\n=== EGE vs DP: Path Diversity on ${benchmarkId} ===`);
				console.log(`  DP mean:  ${dpMean.toFixed(4)} [${dpCI.lower.toFixed(4)}, ${dpCI.upper.toFixed(4)}]`);
				console.log(`  EGE mean: ${egeMean.toFixed(4)} [${egeCI.lower.toFixed(4)}, ${egeCI.upper.toFixed(4)}]`);
				console.log(`  Mann-Whitney U: ${mwTest.u.toFixed(2)}, p = ${mwTest.pValue.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);
				console.log(`  Significant: ${mwTest.significant ? "YES" : "NO"} (alpha=0.05)`);

				// Both methods should produce valid results
				expect(dpDiversity.every((d) => d >= 0)).toBe(true);
				expect(egeDiversity.every((d) => d >= 0)).toBe(true);
			}
		});

		it("should compute Cohen's d effect size for node coverage", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);
				const totalNodes = expander.getNodeCount();

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpCoverage: number[] = [];
				const egeCoverage: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ege = new EntropyGuidedExpansion(expander, seeds);

					const [dpRes, egeRes] = await Promise.all([dp.run(), ege.run()]);

					dpCoverage.push(nodeCoverage(dpRes.sampledNodes, totalNodes));
					egeCoverage.push(nodeCoverage(egeRes.sampledNodes, totalNodes));
				}

				const effect = cohensD(dpCoverage, egeCoverage);
				const dpMean = dpCoverage.reduce((a, b) => a + b, 0) / dpCoverage.length;
				const egeMean = egeCoverage.reduce((a, b) => a + b, 0) / egeCoverage.length;

				console.log(`\n=== EGE vs DP: Node Coverage on ${benchmarkId} ===`);
				console.log(`  DP mean:  ${(dpMean * 100).toFixed(2)}%`);
				console.log(`  EGE mean: ${(egeMean * 100).toFixed(2)}%`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);

				// Coverage should be positive
				expect(dpCoverage.every((c) => c > 0)).toBe(true);
				expect(egeCoverage.every((c) => c > 0)).toBe(true);
			}
		});
	});

	describe("PPME vs DegreePrioritised", () => {
		it("should test statistically significant difference in frontier divergence", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpDivergence: number[] = [];
				const ppmeDivergence: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ppme = new PathPreservingExpansion(expander, seeds);

					const [dpRes, ppmeRes] = await Promise.all([dp.run(), ppme.run()]);

					dpDivergence.push(frontierDivergence(dpRes.visitedPerFrontier));
					ppmeDivergence.push(frontierDivergence(ppmeRes.visitedPerFrontier));
				}

				const mwTest = mannWhitneyUTest(dpDivergence, ppmeDivergence);
				const effect = cohensD(dpDivergence, ppmeDivergence);
				const dpCI = confidenceInterval(dpDivergence);
				const ppmeCI = confidenceInterval(ppmeDivergence);

				const dpMean = dpDivergence.reduce((a, b) => a + b, 0) / dpDivergence.length;
				const ppmeMean = ppmeDivergence.reduce((a, b) => a + b, 0) / ppmeDivergence.length;

				console.log(`\n=== PPME vs DP: Frontier Divergence on ${benchmarkId} ===`);
				console.log(`  DP mean:   ${dpMean.toFixed(4)} [${dpCI.lower.toFixed(4)}, ${dpCI.upper.toFixed(4)}]`);
				console.log(`  PPME mean: ${ppmeMean.toFixed(4)} [${ppmeCI.lower.toFixed(4)}, ${ppmeCI.upper.toFixed(4)}]`);
				console.log(`  Mann-Whitney U: ${mwTest.u.toFixed(2)}, p = ${mwTest.pValue.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);
				console.log(`  Significant: ${mwTest.significant ? "YES" : "NO"} (alpha=0.05)`);

				// Both methods should produce valid divergence values
				expect(dpDivergence.every((d) => d >= 0 && d <= 1)).toBe(true);
				expect(ppmeDivergence.every((d) => d >= 0 && d <= 1)).toBe(true);
			}
		});

		it("should compute Cohen's d effect size for path overlap", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpOverlap: number[] = [];
				const ppmeOverlap: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ppme = new PathPreservingExpansion(expander, seeds);

					const [dpRes, ppmeRes] = await Promise.all([dp.run(), ppme.run()]);

					dpOverlap.push(pathOverlap(dpRes.paths));
					ppmeOverlap.push(pathOverlap(ppmeRes.paths));
				}

				const effect = cohensD(dpOverlap, ppmeOverlap);
				const dpMean = dpOverlap.reduce((a, b) => a + b, 0) / dpOverlap.length;
				const ppmeMean = ppmeOverlap.reduce((a, b) => a + b, 0) / ppmeOverlap.length;

				console.log(`\n=== PPME vs DP: Path Overlap on ${benchmarkId} ===`);
				console.log(`  DP mean:   ${(dpMean * 100).toFixed(2)}%`);
				console.log(`  PPME mean: ${(ppmeMean * 100).toFixed(2)}%`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);
				console.log(`  PPME ${ppmeMean < dpMean ? "reduces" : "increases"} path overlap`);

				// Overlap should be in valid range
				expect(dpOverlap.every((o) => o >= 0 && o <= 1)).toBe(true);
				expect(ppmeOverlap.every((o) => o >= 0 && o <= 1)).toBe(true);
			}
		});
	});

	describe("RSGE vs DegreePrioritised", () => {
		it("should test statistically significant difference in salience coverage", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpSalience: number[] = [];
				const rsgeSalience: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const rsge = new RetrospectiveSalienceExpansion(expander, seeds);

					const [dpRes, rsgeRes] = await Promise.all([dp.run(), rsge.run()]);

					dpSalience.push(salienceCoverage(dpRes.paths, expander));
					rsgeSalience.push(salienceCoverage(rsgeRes.paths, expander));
				}

				const mwTest = mannWhitneyUTest(dpSalience, rsgeSalience);
				const effect = cohensD(dpSalience, rsgeSalience);
				const dpCI = confidenceInterval(dpSalience);
				const rsgeCI = confidenceInterval(rsgeSalience);

				const dpMean = dpSalience.reduce((a, b) => a + b, 0) / dpSalience.length;
				const rsgeMean = rsgeSalience.reduce((a, b) => a + b, 0) / rsgeSalience.length;

				console.log(`\n=== RSGE vs DP: Salience Coverage on ${benchmarkId} ===`);
				console.log(`  DP mean:   ${(dpMean * 100).toFixed(2)}% [${(dpCI.lower * 100).toFixed(2)}%, ${(dpCI.upper * 100).toFixed(2)}%]`);
				console.log(`  RSGE mean: ${(rsgeMean * 100).toFixed(2)}% [${(rsgeCI.lower * 100).toFixed(2)}%, ${(rsgeCI.upper * 100).toFixed(2)}%]`);
				console.log(`  Mann-Whitney U: ${mwTest.u.toFixed(2)}, p = ${mwTest.pValue.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);
				console.log(`  Significant: ${mwTest.significant ? "YES" : "NO"} (alpha=0.05)`);

				// Both methods should produce valid results
				expect(dpSalience.every((s) => s >= 0)).toBe(true);
				expect(rsgeSalience.every((s) => s >= 0)).toBe(true);
			}
		});

		it("should compute Cohen's d effect size for mean path MI", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const dpMI: number[] = [];
				const rsgeMI: number[] = [];

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const rsge = new RetrospectiveSalienceExpansion(expander, seeds);

					const [dpRes, rsgeRes] = await Promise.all([dp.run(), rsge.run()]);

					dpMI.push(meanPathMI(dpRes.paths, expander));
					rsgeMI.push(meanPathMI(rsgeRes.paths, expander));
				}

				const effect = cohensD(dpMI, rsgeMI);
				const dpMean = dpMI.reduce((a, b) => a + b, 0) / dpMI.length;
				const rsgeMean = rsgeMI.reduce((a, b) => a + b, 0) / rsgeMI.length;

				console.log(`\n=== RSGE vs DP: Mean Path MI on ${benchmarkId} ===`);
				console.log(`  DP mean:   ${dpMean.toFixed(4)}`);
				console.log(`  RSGE mean: ${rsgeMean.toFixed(4)}`);
				console.log(`  Cohen's d: ${effect.toFixed(3)} (${interpretEffect(effect)})`);

				// MI values should be non-negative
				expect(dpMI.every((m) => m >= 0)).toBe(true);
				expect(rsgeMI.every((m) => m >= 0)).toBe(true);
			}
		});
	});

	describe("Multi-Method Ranking", () => {
		it("should rank all 4 methods by path diversity with 95% CI", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const results = {
					DegreePrioritised: [] as number[],
					EGE: [] as number[],
					PPME: [] as number[],
					RSGE: [] as number[],
				};

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ege = new EntropyGuidedExpansion(expander, seeds);
					const ppme = new PathPreservingExpansion(expander, seeds);
					const rsge = new RetrospectiveSalienceExpansion(expander, seeds);

					const [dpRes, egeRes, ppmeRes, rsgeRes] = await Promise.all([
						dp.run(),
						ege.run(),
						ppme.run(),
						rsge.run(),
					]);

					results.DegreePrioritised.push(pathDiversity(dpRes.paths));
					results.EGE.push(pathDiversity(egeRes.paths));
					results.PPME.push(pathDiversity(ppmeRes.paths));
					results.RSGE.push(pathDiversity(rsgeRes.paths));
				}

				// Compute stats and rank
				const rankings = Object.entries(results).map(([method, values]) => {
					const mean = values.reduce((a, b) => a + b, 0) / values.length;
					const ci = confidenceInterval(values);
					return { method, mean, ci };
				});

				// Sort by mean (descending - higher diversity is better)
				rankings.sort((a, b) => b.mean - a.mean);

				console.log(`\n=== Path Diversity Ranking on ${benchmarkId} ===`);
				for (const [rank, { method, mean, ci }] of rankings.entries()) {
					console.log(
						`  ${rank + 1}. ${method}: ${mean.toFixed(4)} [${ci.lower.toFixed(4)}, ${ci.upper.toFixed(4)}]`
					);
				}

				// All methods should produce valid results
				expect(Object.values(results).flat().every((d) => d >= 0)).toBe(true);
			}
		});

		it("should rank all 4 methods by salience coverage with 95% CI", async () => {
			for (const benchmarkId of benchmarkIds) {
				const benchmark = await loadBenchmarkByIdFromUrl(benchmarkId);
				const expander = new BenchmarkGraphExpander(benchmark.graph, benchmark.meta.directed);

				const nodeIds = expander.getAllNodeIds();
				const seeds: [string, string] = [nodeIds[0], nodeIds[Math.floor(nodeIds.length / 2)]];

				const results = {
					DegreePrioritised: [] as number[],
					EGE: [] as number[],
					PPME: [] as number[],
					RSGE: [] as number[],
				};

				for (let trial = 0; trial < trials; trial++) {
					const dp = new DegreePrioritisedExpansion(expander, seeds);
					const ege = new EntropyGuidedExpansion(expander, seeds);
					const ppme = new PathPreservingExpansion(expander, seeds);
					const rsge = new RetrospectiveSalienceExpansion(expander, seeds);

					const [dpRes, egeRes, ppmeRes, rsgeRes] = await Promise.all([
						dp.run(),
						ege.run(),
						ppme.run(),
						rsge.run(),
					]);

					results.DegreePrioritised.push(salienceCoverage(dpRes.paths, expander));
					results.EGE.push(salienceCoverage(egeRes.paths, expander));
					results.PPME.push(salienceCoverage(ppmeRes.paths, expander));
					results.RSGE.push(salienceCoverage(rsgeRes.paths, expander));
				}

				// Compute stats and rank
				const rankings = Object.entries(results).map(([method, values]) => {
					const mean = values.reduce((a, b) => a + b, 0) / values.length;
					const ci = confidenceInterval(values);
					return { method, mean, ci };
				});

				// Sort by mean (descending - higher coverage is better)
				rankings.sort((a, b) => b.mean - a.mean);

				console.log(`\n=== Salience Coverage Ranking on ${benchmarkId} ===`);
				for (const [rank, { method, mean, ci }] of rankings.entries()) {
					console.log(
						`  ${rank + 1}. ${method}: ${(mean * 100).toFixed(2)}% [${(ci.lower * 100).toFixed(2)}%, ${(ci.upper * 100).toFixed(2)}%]`
					);
				}

				// All methods should produce valid results
				expect(Object.values(results).flat().every((s) => s >= 0 && s <= 1)).toBe(true);
			}
		});
	});
});
