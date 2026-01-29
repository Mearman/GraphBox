#!/usr/bin/env tsx
/**
 * TAP Test Runner for Vitest
 *
 * Runs experimental tests and outputs TAP format.
 *
 * Usage:
 *   pnpm run:tap
 *   npx tsx scripts/run-tap.ts
 *   npx tsx scripts/run-tap.ts --metrics
 *   npx tsx scripts/run-tap.ts --metrics-output=test-metrics.json
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readMetrics, writeMetrics } from "../src/experiments/metrics/storage.js";
import type { MetricCategory, MetricsOutput } from "../src/experiments/metrics/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const vitestBin = join(projectRoot, "node_modules", ".bin", "vitest");

interface MetricSection {
	title: string;
	rows: Array<Record<string, string | number>>;
}

interface TestMetrics {
	runtimePerformance?: MetricSection;
	pathLengths?: MetricSection;
	scalability?: MetricSection;
	hubTraversal?: MetricSection;
	statisticalSignificance?: MetricSection;
	perturbation?: MetricSection;
	crossDataset?: MetricSection;
	methodRanking?: MetricSection;
	structuralRepresentativeness?: MetricSection;
	nSeedGeneralisation?: MetricSection;
	hubMitigation?: MetricSection;
	multiHubEfficiency?: MetricSection;
	structuralRepresentativenessMetrics?: MetricSection;
	nSeedComparison?: MetricSection;
	nSeedHubTraversal?: MetricSection;
	nSeedPathDiversity?: MetricSection;
	algorithmComparison?: MetricSection;
	hubTraversalComparison?: MetricSection;
	miRankingQuality?: MetricSection;
	// Classification, Generation, Ranking OCS metrics
	classificationCorrectness?: MetricSection;
	classificationSignificance?: MetricSection;
	generationCorrectness?: MetricSection;
	generationSignificance?: MetricSection;
	rankingCorrectness?: MetricSection;
	rankingSignificance?: MetricSection;
	communityDetection?: MetricSection;
	kCoreDecomposition?: MetricSection;
}

interface VitestTestResult {
	title: string;
	status: string;
	duration: number;
	ancestorTitles: string[];
}

interface VitestTestSuite {
	testResults: VitestTestSuite[];
	assertionResults: VitestTestResult[];
	name: string;
}

interface VitestJsonOutput {
	testResults?: VitestTestSuite[];
}

interface CollectedTest {
	name: string;
	status: string;
	duration: number;
	suite: string;
	ancestorTitles: string[];
}

// Helper to collect all tests from test results
const collectTests = (results: VitestJsonOutput): CollectedTest[] => {
	const tests: CollectedTest[] = [];

	for (const suite of results.testResults ?? []) {
		for (const test of suite.assertionResults ?? []) {
			tests.push({
				name: test.title,
				status: test.status,
				duration: test.duration,
				suite: suite.name,
				ancestorTitles: test.ancestorTitles,
			});
		}
	}

	return tests;
};

/**
 * Parse console output to extract metrics sections
 * @param stdout
 */
const parseConsoleMetrics = (stdout: string): TestMetrics => {
	const metrics: TestMetrics = {};
	const lines = stdout.split("\n");

	interface Parser {
		header: RegExp;
		parse: (lines: string[], startIndex: number) => MetricSection | null;
	}

	const parsers: Parser[] = [
		// Runtime Performance (Karate Club)
		{
			header: /=== Runtime Performance \(Karate Club\) ===/,
			parse: (lines, startIndex) => {
				let currentMethod: string | null = null;
				const methodData: Record<string, Record<string, string | number>> = {};

				for (let index = startIndex; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];

					// Detect method name followed by colon
					if (/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority):$/.test(line) && !line.includes("\t")) {
						currentMethod = line.replace(":", "");
						methodData[currentMethod] = {};
						continue;
					}

					// Parse metric lines like "  Time: 0.08ms"
					if (line.trim().startsWith("Time:") && currentMethod) {
						const match = line.match(/Time:\s+([\d.]+)ms/);
						if (match) methodData[currentMethod].time = Number.parseFloat(match[1]);
					}
					if (line.trim().startsWith("Nodes/sec:") && currentMethod) {
						const match = line.match(/Nodes\/sec:\s+([\d,]+)/);
						if (match) methodData[currentMethod].nodesPerSec = Number.parseInt(match[1].replace(",", ""));
					}
					if (line.trim().startsWith("Iterations:") && currentMethod) {
						const match = line.match(/Iterations:\s+(\d+)/);
						if (match) methodData[currentMethod].iterations = Number.parseInt(match[1]);
					}

					// Empty line or next section ends this block
					if (line.trim() === "" && index > startIndex + 2) break;
				}

				return Object.keys(methodData).length > 0 ? { title: "Runtime Performance (Karate Club)", rows: [] } : null;
			},
		},
		// Runtime Performance (Facebook) - for scalability table
		{
			header: /=== Runtime Performance \(Facebook\) ===/,
			parse: (lines, startIndex) => {
				const data: Record<string, string | number> = {};
				for (let index = startIndex; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					const dpMatch = line.match(/Degree-Prioritised:\s+([\d.]+)ms/);
					if (dpMatch) data.dpTime = Number.parseFloat(dpMatch[1]);
					const bfsMatch = line.match(/Standard BFS:\s+([\d.]+)ms/);
					if (bfsMatch) data.bfsTime = Number.parseFloat(bfsMatch[1]);
					const dpNsMatch = line.match(/DP nodes\/sec:\s+([\d,]+)/);
					if (dpNsMatch) data.dpNodesPerSec = Number.parseInt(dpNsMatch[1].replace(",", ""));
					const bfsNsMatch = line.match(/BFS nodes\/sec:\s+([\d,]+)/);
					if (bfsNsMatch) data.bfsNodesPerSec = Number.parseInt(bfsNsMatch[1].replace(",", ""));
					if (line.trim() === "") break;
				}
				return Object.keys(data).length > 0 ? { title: "Runtime Performance (Facebook)", rows: [data] } : null;
			},
		},
		// Scalability Analysis
		{
			header: /=== Scalability Analysis ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				// Skip header line
				for (let index = startIndex + 2; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t");
					if (parts.length >= 5) {
						rows.push({
							dataset: parts[0],
							nodes: Number.parseInt(parts[1]),
							dpTime: Number.parseFloat(parts[2]),
							bfsTime: Number.parseFloat(parts[3]),
							ratio: Number.parseFloat(parts[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Scalability Analysis", rows } : null;
			},
		},
		// Hub Traversal
		{
			header: /=== Hub Traversal Efficiency ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				let currentMethod: string | null = null;
				const currentData: Record<string, string | number> = {};

				for (let index = startIndex + 1; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;

					// Match "Method: X/Y hubs (Z%)" or "Method: value paths, Z% hub"
					const methodMatch = line.match(/^([^:]+):\s*(.+)/);
					if (methodMatch) {
						if (currentMethod && Object.keys(currentData).length > 0) {
							rows.push({ method: currentMethod, ...currentData });
						}
						currentMethod = methodMatch[1].trim();
						currentData.path = 0;
						currentData.hubTraversal = 0;

						// Parse "X/Y hubs (Z%)"
						const hubMatch = methodMatch[2].match(/(\d+)\/\d+\s+hubs\s*\(([\d.]+)%\)/);
						if (hubMatch) {
							currentData.hubTraversal = Number.parseFloat(hubMatch[2]);
						} else {
							// Try "X paths, Y% hub" format
							const pathsHubMatch = methodMatch[2].match(/(\d+)\s+paths?,\s*([\d.]+)%/);
							if (pathsHubMatch) {
								currentData.path = Number.parseInt(pathsHubMatch[1]);
								currentData.hubTraversal = Number.parseFloat(pathsHubMatch[2]);
							}
						}
					}
				}

				if (currentMethod && Object.keys(currentData).length > 0) {
					rows.push({ method: currentMethod, ...currentData });
				}

				return rows.length > 0 ? { title: "Hub Traversal Efficiency", rows } : null;
			},
		},
		// Path Lengths
		{
			header: /=== Path Length Distribution ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				let currentMethod: string | null = null;
				const currentData: Record<string, number> = {};

				for (let index = startIndex + 1; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;

					// Method name line: "Method:" or just "Method"
					const methodMatch = line.match(/^([^:]+):\s*$/);
					if (methodMatch) {
						if (currentMethod && Object.keys(currentData).length > 0) {
							rows.push({ method: currentMethod, ...currentData });
						}
						currentMethod = methodMatch[1].trim();
						currentData.min = 0;
						currentData.max = 0;
						currentData.mean = 0;
						currentData.median = 0;
					} else if (currentMethod) {
						// Parse "  Min: 4, Max: 15, Mean: 9.65, Median: 10"
						const minMatch = line.match(/Min:\s*(\d+)/);
						const maxMatch = line.match(/Max:\s*(\d+)/);
						const meanMatch = line.match(/Mean:\s*([\d.]+)/);
						const medianMatch = line.match(/Median:\s*(\d+)/);

						if (minMatch) currentData.min = Number.parseInt(minMatch[1]);
						if (maxMatch) currentData.max = Number.parseInt(maxMatch[1]);
						if (meanMatch) currentData.mean = Number.parseFloat(meanMatch[1]);
						if (medianMatch) currentData.median = Number.parseInt(medianMatch[1]);
					}
				}

				if (currentMethod && Object.keys(currentData).length > 0) {
					rows.push({ method: currentMethod, ...currentData });
				}

				return rows.length > 0 ? { title: "Path Length Distribution", rows } : null;
			},
		},
		// Statistical Significance (Path Salience vs Random)
		{
			header: /=== Statistical Test: Path Salience vs Random ===/,
			parse: (lines, startIndex) => {
				const data: Record<string, string | number> = {};
				for (let index = startIndex; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					const salienceMean = line.match(/Path Salience mean MI:\s+([\d.]+)/);
					if (salienceMean) data.salienceMean = Number.parseFloat(salienceMean[1]);
					const randomMean = line.match(/Random mean MI:\s+([\d.]+)/);
					if (randomMean) data.randomMean = Number.parseFloat(randomMean[1]);
					const uMatch = line.match(/Mann-Whitney U:\s+([\d.]+)/);
					if (uMatch) data.u = Number.parseFloat(uMatch[1]);
					const pMatch = line.match(/p-value:\s+([\d.]+)/);
					if (pMatch) data.pValue = Number.parseFloat(pMatch[1]);
					const dMatch = line.match(/Cohen's d:\s+([\d.-]+)/);
					if (dMatch) data.cohensD = Number.parseFloat(dMatch[1]);
					if (line.trim() === "" && index > startIndex + 3) break;
				}
				return Object.keys(data).length >= 3 ? { title: "Statistical Test: Path Diversity", rows: [data] } : null;
			},
		},
		// Perturbation Consistency
		{
			header: /=== Consistent Method Ranking ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(.+?):\s+DP=([\d.]+),\s+BFS=([\d.]+)\s+\((\w+)\)/);
					if (match) {
						rows.push({
							perturbation: match[1].trim(),
							dpDiversity: Number.parseFloat(match[2]),
							bfsDiversity: Number.parseFloat(match[3]),
							winner: match[4],
						});
					}
				}
				return rows.length > 0 ? { title: "Consistent Method Ranking", rows } : null;
			},
		},
		// Cross-Dataset
		{
			header: /=== Cross-Dataset Path Diversity ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				let jsonString = "";
				let lineIndex = startIndex + 1;
				let braceCount = 0;
				let hasStartedJson = false;

				// Find and collect JSON
				while (lineIndex < lines.length) {
					const line = lines[lineIndex];
					const trimmed = line.trim();

					// Detect JSON start
					if (trimmed === "{") {
						hasStartedJson = true;
					}

					// Track braces when in JSON
					if (hasStartedJson) {
						braceCount += (trimmed.match(/\{/g) || []).length;
						braceCount -= (trimmed.match(/\}/g) || []).length;
					}

					jsonString += line;

					// Stop when JSON is complete
					if (hasStartedJson && braceCount === 0 && trimmed.includes("}")) {
						break;
					}

					// Stop at next section (test output or new header)
					if (trimmed.startsWith("===") && lineIndex > startIndex + 1) {
						break;
					}
					if ((trimmed.includes("✓") || trimmed.includes("×")) && lineIndex > startIndex + 10) {
						break;
					}

					lineIndex++;
					if (lineIndex > startIndex + 50) break;
				}

				try {
					// Extract just the JSON part
					const jsonStart = jsonString.indexOf("{");
					const jsonEnd = jsonString.lastIndexOf("}") + 1;
					if (jsonStart !== -1 && jsonEnd > jsonStart) {
						jsonString = jsonString.slice(jsonStart, jsonEnd);
						const jsonData = JSON.parse(jsonString);
						for (const [dataset, data] of Object.entries(jsonData)) {
							const d = data as { nodes?: number; dpDiversity?: number; bfsDiversity?: number; dpPaths?: number; bfsPaths?: number };
							if (typeof d.dpDiversity === "number" && typeof d.bfsDiversity === "number") {
								const improvement = ((d.dpDiversity - d.bfsDiversity) / d.bfsDiversity) * 100;
								rows.push({
									dataset: dataset.charAt(0).toUpperCase() + dataset.slice(1),
									nodes: d.nodes || 0,
									dpDiversity: Math.round(d.dpDiversity * 1000) / 1000,
									improvement: Math.round(improvement * 10) / 10,
								});
							}
						}
					}
				} catch {
					// JSON parse failed
					console.error("Failed to parse cross-dataset JSON");
				}

				return rows.length > 0 ? { title: "Cross-Dataset Path Diversity", rows } : null;
			},
		},
		// Method Ranking
		{
			header: /=== Method Ranking by Path Diversity ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 15, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^\d+\.\s+(\S[^:]*):\s+([\d.]+)\s+\((\d+)\s+paths\)/);
					if (match) {
						rows.push({
							method: match[1],
							diversity: Number.parseFloat(match[2]),
							paths: Number.parseInt(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "Method Ranking by Path Diversity", rows } : null;
			},
		},
		// Structural Representativeness (Ego Network)
		{
			header: /=== Structural Representativeness \(Ego Network\) ===/,
			parse: (lines, startIndex) => {
				const data: Record<string, string | number> = {};
				for (let index = startIndex; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					const coverageMatch = line.match(/Coverage:\s+([\d.]+)/);
					if (coverageMatch) data.coverage = Number.parseFloat(coverageMatch[1]);
					const precisionMatch = line.match(/Precision:\s+([\d.]+)/);
					if (precisionMatch) data.precision = Number.parseFloat(precisionMatch[1]);
					const f1Match = line.match(/F1 Score:\s+([\d.]+)/);
					if (f1Match) data.f1Score = Number.parseFloat(f1Match[1]);
					const intersectionMatch = line.match(/Intersection:\s+(\d+)\/(\d+)/);
					if (intersectionMatch) {
						data.intersectionSize = Number.parseInt(intersectionMatch[1]);
						data.totalNodes = Number.parseInt(intersectionMatch[2]);
					}
					if (line.trim() === "" && index > startIndex + 3) break;
				}
				return Object.keys(data).length >= 2 ? { title: "Structural Representativeness (Ego Network)", rows: [data] } : null;
			},
		},
		// N-Seed Generalisation
		{
			header: /=== N-Seed Generalisation ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/N=(\d+) \(([^)]+)\): (\d+) nodes,\s+(\d+) paths/);
					if (match) {
						rows.push({
							n: Number.parseInt(match[1]),
							variant: match[2],
							nodes: Number.parseInt(match[3]),
							paths: Number.parseInt(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "N-Seed Generalisation", rows } : null;
			},
		},
		// Hub Mitigation Analysis
		{
			header: /=== Hub Mitigation Analysis ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 2; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS)\s*&\s+(\d+)\s*&\s+--\s*&\s+(\d+)\s*&\s+(\d+)/);
					if (match) {
						rows.push({
							method: match[1],
							nodes: Number.parseInt(match[2]),
							paths: Number.parseInt(match[3]),
							iterations: Number.parseInt(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Hub Mitigation Analysis", rows } : null;
			},
		},
		// Multi-Hub Expansion Efficiency
		{
			header: /=== Multi-Hub Expansion Efficiency ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 2; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced)\s*&\s+(\d+)\s*&\s+(\d+)\s+\(([\d.]+)%\)\s*&\s+(\d+)/);
					if (match) {
						rows.push({
							method: match[1],
							nodesExpanded: Number.parseInt(match[2]),
							hubsExpanded: Number.parseInt(match[3]),
							hubRatio: Number.parseFloat(match[4]),
							pathsFound: Number.parseInt(match[5]),
						});
					}
				}
				return rows.length > 0 ? { title: "Multi-Hub Expansion Efficiency", rows } : null;
			},
		},
		// Structural Representativeness Metrics
		{
			header: /=== Structural Representativeness Metrics ===/,
			parse: (lines, startIndex) => {
				const data: Record<string, string | number> = {};
				for (let index = startIndex; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					const totalMatch = line.match(/Total Sampled:\s+(\d+)\s+nodes/);
					if (totalMatch) data.totalSampled = Number.parseInt(totalMatch[1]);
					const hubMatch = line.match(/Hub Coverage:\s+([\d.]+)%/);
					if (hubMatch) data.hubCoverage = Number.parseFloat(hubMatch[1]);
					const bucketMatch = line.match(/Buckets Covered:\s+(\d+)\/(\d+)/);
					if (bucketMatch) {
						data.bucketsCovered = Number.parseInt(bucketMatch[1]);
						data.totalBuckets = Number.parseInt(bucketMatch[2]);
					}
					if (line.trim() === "" && index > startIndex + 3) break;
				}
				return Object.keys(data).length >= 2 ? { title: "Structural Representativeness Metrics", rows: [data] } : null;
			},
		},
		// N-Seed Comparison Across Methods
		{
			header: /=== N-Seed Comparison Across Methods ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 2; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+([\d.]+)%/);
					if (match) {
						rows.push({
							method: match[1],
							n: Number.parseInt(match[2]),
							nodes: Number.parseInt(match[3]),
							paths: Number.parseInt(match[4]),
							iterations: Number.parseInt(match[5]),
							coverage: Number.parseFloat(match[6]),
						});
					}
				}
				return rows.length > 0 ? { title: "N-Seed Comparison Across Methods", rows } : null;
			},
		},
		// N=2 Hub Traversal Comparison
		{
			header: /=== N=2 Hub Traversal Comparison ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 2; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)%/);
					if (match) {
						rows.push({
							method: match[1],
							paths: Number.parseInt(match[2]),
							hubTraversal: Number.parseInt(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "N=2 Hub Traversal Comparison", rows } : null;
			},
		},
		// N=2 Path Diversity Comparison
		{
			header: /=== N=2 Path Diversity Comparison ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 2; index < Math.min(startIndex + 10, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+([\d.]+)/);
					if (match) {
						rows.push({
							method: match[1],
							paths: Number.parseInt(match[2]),
							uniqueNodes: Number.parseInt(match[3]),
							diversity: Number.parseFloat(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "N=2 Path Diversity Comparison", rows } : null;
			},
		},
		// Algorithm Comparison (from evaluation harness)
		{
			header: /=== Algorithm Comparison ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				// Skip the table header and separator
				for (let index = startIndex + 3; index < Math.min(startIndex + 100, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;

					// Parse table row format by splitting on |
					const parts = line.split("|").map((p) => p.trim());
					if (parts.length >= 6) {
						const graph = parts[0];
						const seeds = parts[1];
						const method = parts[2];
						const nodes = parts[3];
						const paths = parts[4];
						const diversity = parts[5];

						// Extract N value from seeds (e.g., "N2" -> 2)
						const nMatch = seeds.match(/N(\d+)/);
						if (!nMatch) continue;
						const n = Number.parseInt(nMatch[1]);

						// Only include N=2 results for n-seed tables
						if (n === 2) {
							const nodeValue = nodes === "N/A" ? 0 : Number.parseInt(nodes);
							const pathValue = paths === "N/A" ? 0 : Number.parseInt(paths);
							const divValue = diversity === "N/A" ? 0 : Number.parseFloat(diversity);
							rows.push({
								graph,
								n,
								method,
								nodes: nodeValue,
								paths: pathValue,
								diversity: divValue,
							});
						}
					}
				}
				return rows.length > 0 ? { title: "Algorithm Comparison", rows } : null;
			},
		},
		// Hub Traversal Comparison (from evaluation harness)
		{
			header: /=== Hub Traversal Comparison ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				// Skip the table header and separator
				for (let index = startIndex + 3; index < Math.min(startIndex + 100, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===") || line.includes("Average hub")) break;

					// Parse table row format: "scale-free-100 | Degree-Prioritised | 18.5%"
					const match = line.match(/^([\w-]+)\s*\|\s*(\w[\w -]*\w)\s*\|\s*([\d.]+)%/);
					if (match) {
						rows.push({
							graph: match[1],
							method: match[2].trim(),
							hubTraversal: Number.parseFloat(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "Hub Traversal Comparison", rows } : null;
			},
		},
		// MI Ranking Quality (from benchmark tests)
		{
			header: /=== (Karate Club|Les Misérables|Facebook) (Path Ranking|Character Path) Analysis ===/,
			parse: (lines, startIndex) => {
				const data: Record<string, string | number> = {};
				let datasetName = "";

				// Extract dataset name from header
				const headerMatch = lines[startIndex].match(/=== (Karate Club|Les Misérables|Facebook) /);
				if (headerMatch) {
					datasetName = headerMatch[1];
				}

				for (let index = startIndex; index < Math.min(startIndex + 15, lines.length); index++) {
					const line = lines[index];

					// Parse "Path Salience: X paths"
					const pathsMatch = line.match(/Path Salience:\s+(\d+)\s+paths/);
					if (pathsMatch) data.paths = Number.parseInt(pathsMatch[1]);

					// Parse "  Mean MI: X.XXX"
					const meanMIMatch = line.match(/Mean MI:\s+([\d.]+)/);
					if (meanMIMatch) data.meanMI = Number.parseFloat(meanMIMatch[1]);

					// Parse "  Node Coverage: X.XX"
					const coverageMatch = line.match(/Node Coverage:\s+([\d.]+)/);
					if (coverageMatch) data.nodeCoverage = Number.parseFloat(coverageMatch[1]);

					// Parse "  Path Diversity: X.XXX"
					const diversityMatch = line.match(/Path Diversity:\s+([\d.]+)/);
					if (diversityMatch) data.pathDiversity = Number.parseFloat(diversityMatch[1]);

					if (line.trim() === "" && index > startIndex + 3) break;
				}

				if (Object.keys(data).length >= 3) {
					return { title: "MI Ranking Quality", rows: [{ dataset: datasetName, ...data }] };
				}
				return null;
			},
		},
		// Classification Correctness
		// Experiment outputs: class\tprecision\trecall\tf1\tsupport (tab-separated with header row)
		{
			header: /=== Classification Correctness ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 5) {
						const precision = Number.parseFloat(parts[1]);
						// Skip header row where numeric columns parse to NaN
						if (Number.isNaN(precision)) continue;
						rows.push({
							graphClass: parts[0],
							precision,
							recall: Number.parseFloat(parts[2]),
							f1: Number.parseFloat(parts[3]),
							support: Number.parseInt(parts[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Classification Correctness", rows } : null;
			},
		},
		// Classification Significance
		// Experiment outputs tab-separated key-value pairs: random_baseline\t0.250, accuracy\t1.000, etc.
		// Constructs application rows for the thesis table.
		{
			header: /=== Classification Significance ===/,
			parse: (lines, startIndex) => {
				const kv: Record<string, string> = {};
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 2) {
						kv[parts[0]] = parts[1];
					}
				}
				const baseline = Number.parseFloat(kv["random_baseline"] ?? "");
				const accuracy = Number.parseFloat(kv["accuracy"] ?? "");
				if (Number.isNaN(baseline) || Number.isNaN(accuracy)) return null;
				// Construct application rows matching thesis table structure
				const rows: Record<string, string | number>[] = [
					{ application: "Generator validation", baselineAccuracy: baseline, classifierAccuracy: accuracy },
					{ application: "Sampling quality assessment", baselineAccuracy: baseline, classifierAccuracy: accuracy },
					{ application: "Real-world graph identification", baselineAccuracy: baseline, classifierAccuracy: accuracy },
				];
				return { title: "Classification Significance", rows };
			},
		},
		// Generation Correctness
		// Experiment outputs: class\ttotal\taccepted\tacceptance_rate\tmean_confidence\tmean_attempts
		{
			header: /=== Generation Correctness ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 5) {
						const total = Number.parseInt(parts[1]);
						// Skip header row where numeric columns parse to NaN
						if (Number.isNaN(total)) continue;
						const accepted = Number.parseInt(parts[2]);
						rows.push({
							graphClass: parts[0],
							acceptedTotal: `${accepted}/${total}`,
							acceptanceRate: Number.parseFloat(parts[3]),
							meanConfidence: Number.parseFloat(parts[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Generation Correctness", rows } : null;
			},
		},
		// Generation Significance
		// Experiment outputs tab-separated key-value pairs: random_baseline\t0.333, overall_acceptance_rate\t1.000, etc.
		// Constructs metric rows matching thesis table structure.
		{
			header: /=== Generation Significance ===/,
			parse: (lines, startIndex) => {
				const kv: Record<string, string> = {};
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 2) {
						kv[parts[0]] = parts[1];
					}
				}
				const baseline = Number.parseFloat(kv["random_baseline"] ?? "");
				const rate = Number.parseFloat(kv["overall_acceptance_rate"] ?? "");
				const confidence = Number.parseFloat(kv["overall_mean_confidence"] ?? "");
				if (Number.isNaN(baseline) || Number.isNaN(rate)) return null;
				const rows: Record<string, string | number>[] = [
					{ metric: "Acceptance rate", achieved: rate, randomBaseline: baseline },
					{ metric: "Mean confidence", achieved: confidence, randomBaseline: null },
				];
				return { title: "Generation Significance", rows };
			},
		},
		// Ranking Correctness (first test: per-method comparison)
		// Experiment outputs: method\tmean_mi\tnode_coverage\tpath_diversity\tpath_count\tspearman_rho (6 columns)
		// Ignores second test (5-column seed-pair format) via column count check.
		{
			header: /=== Ranking Correctness ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					// Require 6+ columns to match first test format (not second test's 5 columns)
					if (parts.length >= 6) {
						const meanMI = Number.parseFloat(parts[1]);
						// Skip header row where numeric columns parse to NaN
						if (Number.isNaN(meanMI)) continue;
						rows.push({
							method: parts[0],
							meanMI,
							nodeCoverage: Number.parseFloat(parts[2]),
							pathDiversity: Number.parseFloat(parts[3]),
							spearmanRho: Number.parseFloat(parts[5]),
						});
					}
				}
				return rows.length > 0 ? { title: "Ranking Correctness", rows } : null;
			},
		},
		// Ranking Significance
		// Experiment outputs: baseline\tsalience_mi\tbaseline_mi\timprovement\trelative (5 columns)
		// Also handles key-value format from second test (mean_salience_mi, wins, etc.)
		{
			header: /=== Ranking Significance ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				const kv: Record<string, string> = {};
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 5) {
						const salienceMI = Number.parseFloat(parts[1]);
						// Skip header row
						if (Number.isNaN(salienceMI)) continue;
						rows.push({
							baseline: parts[0],
							salienceMI,
							baselineMI: Number.parseFloat(parts[2]),
							improvement: parts[3],
							relative: parts[4],
						});
					} else if (parts.length === 2) {
						kv[parts[0]] = parts[1];
					}
				}
				// If key-value format (second test), construct summary row
				if (rows.length === 0 && Object.keys(kv).length > 0) {
					const wins = kv["wins"] ?? "";
					const meanImprovement = kv["mean_improvement"] ?? "";
					const meanSalience = kv["mean_salience_mi"] ?? "";
					rows.push({
						baseline: "vs. Random (multi-seed)",
						salienceMI: Number.parseFloat(meanSalience) || 0,
						baselineMI: Number.parseFloat(kv["mean_random_mi"] ?? "") || 0,
						improvement: meanImprovement,
						relative: wins,
					});
				}
				return rows.length > 0 ? { title: "Ranking Significance", rows } : null;
			},
		},
		// Community Detection
		{
			header: /=== Community Detection ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 6) {
						const communities = Number.parseInt(parts[2]);
						if (Number.isNaN(communities)) continue; // Skip header row
						rows.push({
							dataset: parts[0],
							method: parts[1],
							communities,
							modularity: Number.parseFloat(parts[3]),
							iterations: Number.parseInt(parts[4]),
							nodes: Number.parseInt(parts[5]),
						});
					}
				}
				return rows.length > 0 ? { title: "Community Detection", rows } : null;
			},
		},
		// K-Core Decomposition
		{
			header: /=== K-Core Decomposition ===/,
			parse: (lines, startIndex) => {
				const rows: Record<string, string | number>[] = [];
				for (let index = startIndex + 1; index < Math.min(startIndex + 20, lines.length); index++) {
					const line = lines[index];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t").map((p) => p.trim());
					if (parts.length >= 6) {
						const degeneracy = Number.parseInt(parts[1]);
						if (Number.isNaN(degeneracy)) continue; // Skip header row
						rows.push({
							dataset: parts[0],
							degeneracy,
							coreCount: Number.parseInt(parts[2]),
							maxCoreSize: Number.parseInt(parts[3]),
							nodes: Number.parseInt(parts[4]),
							edges: Number.parseInt(parts[5]),
						});
					}
				}
				return rows.length > 0 ? { title: "K-Core Decomposition", rows } : null;
			},
		},
	];

	// Find and parse all metric sections
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];

		for (const parser of parsers) {
			if (parser.header.test(line)) {
				const section = parser.parse(lines, index);
				if (section) {
					// Map section titles to metric keys
					const keyMap: Record<string, keyof TestMetrics> = {
						"Runtime Performance (Karate Club)": "runtimePerformance",
						"Runtime Performance (Facebook)": "runtimePerformance",
						"Scalability Analysis": "scalability",
						"Hub Traversal Efficiency": "hubTraversal",
						"Path Length Distribution": "pathLengths",
						"Statistical Test: Path Diversity": "statisticalSignificance",
						"Consistent Method Ranking": "perturbation",
						"Cross-Dataset Path Diversity": "crossDataset",
						"Method Ranking by Path Diversity": "methodRanking",
						"Structural Representativeness (Ego Network)": "structuralRepresentativeness",
						"N-Seed Generalisation": "nSeedGeneralisation",
						"Hub Mitigation Analysis": "hubMitigation",
						"Multi-Hub Expansion Efficiency": "multiHubEfficiency",
						"Structural Representativeness Metrics": "structuralRepresentativenessMetrics",
						"N-Seed Comparison Across Methods": "nSeedComparison",
						"N=2 Hub Traversal Comparison": "nSeedHubTraversal",
						"N=2 Path Diversity Comparison": "nSeedPathDiversity",
						"Algorithm Comparison": "algorithmComparison",
						"Hub Traversal Comparison": "hubTraversalComparison",
						"MI Ranking Quality": "miRankingQuality",
						"Classification Correctness": "classificationCorrectness",
						"Classification Significance": "classificationSignificance",
						"Generation Correctness": "generationCorrectness",
						"Generation Significance": "generationSignificance",
						"Ranking Correctness": "rankingCorrectness",
						"Ranking Significance": "rankingSignificance",
						"Community Detection": "communityDetection",
						"K-Core Decomposition": "kCoreDecomposition",
					};
					const key = keyMap[section.title];
					if (key) {
						// For sections that can have multiple valid entries, deduplicate by key
						// Otherwise, replace with latest data to avoid accumulation
						const deduplicateSections: (keyof TestMetrics)[] = [
							"runtimePerformance", "scalability", "crossDataset",
							"hubTraversalComparison", "algorithmComparison", "miRankingQuality",
							"rankingCorrectness", "rankingSignificance",
							"communityDetection", "kCoreDecomposition",
						];
						if (deduplicateSections.includes(key)) {
							// These sections can have multiple rows - merge with deduplication
							if (metrics[key]) {
								// Deduplicate existing rows by creating a unique key
								const existingRows = metrics[key].rows;
								const newRows = section.rows;
								const seen = new Set<string>();

								// Create combined array with deduplication
								const combinedRows: Array<Record<string, string | number>> = [];
								for (const row of [...existingRows, ...newRows]) {
									const dedupeKey = JSON.stringify(row);
									if (!seen.has(dedupeKey)) {
										seen.add(dedupeKey);
										combinedRows.push(row);
									}
								}
								metrics[key].rows = combinedRows;
							} else {
								metrics[key] = section;
							}
						} else {
							// For single-value sections, replace with latest
							metrics[key] = section;
						}
					}
				}
				break;
			}
		}
	}

	return metrics;
};

// Helper to parse verbose output for TAP generation
interface ParsedTest {
	name: string;
	status: "passed" | "failed" | "skipped" | "pending";
}

const parseVerboseOutput = (output: string): { tests: ParsedTest[]; summary: string } => {
	const tests: ParsedTest[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		// Look for test result lines like "✓ test name" or "✗ test name"
		// Vitest verbose format: [32m✓[39m ... test name
		const passMatch = line.match(/\[32m✓\[39m\S*\s+(\S.*)$/);
		if (passMatch) {
			tests.push({ name: passMatch[1].trim(), status: "passed" });
			continue;
		}

		const failMatch = line.match(/\[31m✗\[39m\S*\s+(\S.*)$/);
		if (failMatch) {
			tests.push({ name: failMatch[1].trim(), status: "failed" });
		}
	}

	// Extract summary
	const summaryMatch = output.match(/\[2m\s+Tests\s\[22m.*?\[1\[32m(\d+)\s+passed/);
	const summary = summaryMatch ? `${summaryMatch[1]} passed` : "tests completed";

	return { tests, summary };
};

// Main
const main = async () => {
	const arguments_ = process.argv.slice(2);
	const outputFile = arguments_.find((a) => a.startsWith("--output="))?.split("=")[1];
	const metricsMode = arguments_.includes("--metrics");
	const metricsOutput = arguments_.find((a) => a.startsWith("--metrics-output="))?.split("=")[1] || join(projectRoot, "test-metrics.json");

	let tests: ParsedTest[] = [];
	let metrics: TestMetrics = {};
	let exitCode = 0;

	if (metricsMode) {
		// In metrics mode, run vitest once with verbose reporter for both TAP and metrics
		const vitest = spawn(vitestBin, ["run", "--project=exp", "--reporter=verbose"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "inherit"],
		});

		let verboseOutput = "";

		for await (const chunk of vitest.stdout as AsyncIterable<Buffer>) {
			const text = chunk.toString();
			verboseOutput += text;
		}

		exitCode = await new Promise<number>((resolve) => {
			vitest.on("close", resolve);
		});

		// Parse verbose output for both TAP and metrics
		const parsed = parseVerboseOutput(verboseOutput);
		tests = parsed.tests;
		metrics = parseConsoleMetrics(verboseOutput);
	} else {
		// Normal mode: run with JSON reporter for TAP
		const vitest = spawn(vitestBin, ["run", "--project=exp", "--reporter=json"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "inherit"],
		});

		let jsonOutput = "";

		for await (const chunk of vitest.stdout as AsyncIterable<Buffer>) {
			const text = chunk.toString();
			jsonOutput += text;
		}

		exitCode = await new Promise<number>((resolve) => {
			vitest.on("close", resolve);
		});

		// Parse JSON output
		const jsonLines = jsonOutput.split("\n").filter((line) => line.trim().startsWith("{"));
		const results = JSON.parse(jsonLines.at(-1) ?? "{}") as VitestJsonOutput;
		tests = collectTests(results).map((t) => ({
			name: t.name,
			status: t.status as ParsedTest["status"],
		}));
	}

	// Generate TAP output
	const tapLines: string[] = [ "TAP version 13", `1..${tests.length}`];

	for (const [index, test] of tests.entries()) {
		const isOk = test.status === "passed" || test.status === "skipped";
		tapLines.push(`${isOk ? "ok" : "not ok"} ${index + 1} - ${test.name}`);
	}

	const passed = tests.filter((t) => t.status === "passed").length;
	const failed = tests.filter((t) => t.status === "failed").length;
	const skipped = tests.filter((t) => t.status === "skipped" || t.status === "pending").length;

	tapLines.push("");
	tapLines.push(`# Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);

	// Output TAP
	const tapOutput = tapLines.join("\n");
	console.log(tapOutput);

	// Write TAP to file if requested
	if (outputFile) {
		const directory = dirname(outputFile);
		if (!existsSync(directory)) {
			mkdirSync(directory, { recursive: true });
		}
		writeFileSync(outputFile, tapOutput);
		console.error(`\nTAP output written to: ${outputFile}`);
	}

	// Write metrics if requested
	if (metricsMode) {
		const metricsJson = JSON.stringify(metrics, null, 2);
		writeFileSync(metricsOutput, metricsJson);
		console.error(`\nMetrics written to: ${metricsOutput}`);

		// Merge OCS metrics into src/test-metrics.json (MetricsOutput format)
		// so export-csv.ts can produce CSVs for OCS scenario tables.
		const ocsKeyMap: Record<string, MetricCategory> = {
			classificationCorrectness: "classification-correctness",
			classificationSignificance: "classification-significance",
			generationCorrectness: "generation-correctness",
			generationSignificance: "generation-significance",
			rankingCorrectness: "ranking-correctness",
			rankingSignificance: "ranking-significance",
			communityDetection: "community-detection",
			kCoreDecomposition: "k-core-decomposition",
		};

		const sourceMetricsPath = join(projectRoot, "src/test-metrics.json");
		const existing = readMetrics(sourceMetricsPath);
		if (existing) {
			let merged = false;
			for (const [camelKey, kebabCategory] of Object.entries(ocsKeyMap)) {
				const section = metrics[camelKey as keyof TestMetrics];
				if (section && section.rows.length > 0) {
					existing.metrics[kebabCategory] = section.rows as unknown as MetricsOutput["metrics"][MetricCategory];
					merged = true;
				}
			}
			if (merged) {
				existing.timestamp = new Date().toISOString();
				writeMetrics(existing, { outputPath: sourceMetricsPath });
				console.error(`OCS metrics merged into: ${sourceMetricsPath}`);
			}
		}
	}

	process.exit(exitCode);
};

void main();
