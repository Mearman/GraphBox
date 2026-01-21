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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

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
}

// Helper to collect all tests from test results
function collectTests(results: any): any[] {
	const tests: any[] = [];

	for (const suite of results.testResults || []) {
		for (const test of suite.assertionResults || []) {
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
}

/**
 * Parse console output to extract metrics sections
 */
function parseConsoleMetrics(stdout: string): TestMetrics {
	const metrics: TestMetrics = {};
	const lines = stdout.split("\n");

	interface Parser {
		header: RegExp;
		parse: (lines: string[], startIdx: number) => MetricSection | null;
	}

	const parsers: Parser[] = [
		// Runtime Performance (Karate Club)
		{
			header: /=== Runtime Performance \(Karate Club\) ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				let currentMethod: string | null = null;
				const methodData: Record<string, Record<string, string | number>> = {};

				for (let i = startIdx; i < Math.min(startIdx + 20, lines.length); i++) {
					const line = lines[i];

					// Detect method name followed by colon
					if (line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority):$/) && !line.includes("\t")) {
						currentMethod = line.replace(":", "");
						methodData[currentMethod] = {};
						continue;
					}

					// Parse metric lines like "  Time: 0.08ms"
					if (line.trim().startsWith("Time:") && currentMethod) {
						const match = line.match(/Time:\s+([\d.]+)ms/);
						if (match) methodData[currentMethod].time = parseFloat(match[1]);
					}
					if (line.trim().startsWith("Nodes/sec:") && currentMethod) {
						const match = line.match(/Nodes\/sec:\s+([\d,]+)/);
						if (match) methodData[currentMethod].nodesPerSec = parseInt(match[1].replace(",", ""));
					}
					if (line.trim().startsWith("Iterations:") && currentMethod) {
						const match = line.match(/Iterations:\s+(\d+)/);
						if (match) methodData[currentMethod].iterations = parseInt(match[1]);
					}

					// Empty line or next section ends this block
					if (line.trim() === "" && i > startIdx + 2) break;
				}

				return Object.keys(methodData).length > 0 ? { title: "Runtime Performance (Karate Club)", rows: [] } : null;
			},
		},
		// Runtime Performance (Facebook) - for scalability table
		{
			header: /=== Runtime Performance \(Facebook\) ===/,
			parse: (lines, startIdx) => {
				const data: Record<string, string | number> = {};
				for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					const dpMatch = line.match(/Degree-Prioritised:\s+([\d.]+)ms/);
					if (dpMatch) data.dpTime = parseFloat(dpMatch[1]);
					const bfsMatch = line.match(/Standard BFS:\s+([\d.]+)ms/);
					if (bfsMatch) data.bfsTime = parseFloat(bfsMatch[1]);
					const dpNsMatch = line.match(/DP nodes\/sec:\s+([\d,]+)/);
					if (dpNsMatch) data.dpNodesPerSec = parseInt(dpNsMatch[1].replace(",", ""));
					const bfsNsMatch = line.match(/BFS nodes\/sec:\s+([\d,]+)/);
					if (bfsNsMatch) data.bfsNodesPerSec = parseInt(bfsNsMatch[1].replace(",", ""));
					if (line.trim() === "") break;
				}
				return Object.keys(data).length > 0 ? { title: "Runtime Performance (Facebook)", rows: [data] } : null;
			},
		},
		// Scalability Analysis
		{
			header: /=== Scalability Analysis ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				// Skip header line
				for (let i = startIdx + 2; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const parts = line.split("\t");
					if (parts.length >= 5) {
						rows.push({
							dataset: parts[0],
							nodes: parseInt(parts[1]),
							dpTime: parseFloat(parts[2]),
							bfsTime: parseFloat(parts[3]),
							ratio: parseFloat(parts[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Scalability Analysis", rows } : null;
			},
		},
		// Hub Traversal
		{
			header: /=== Hub Traversal Efficiency ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				let currentMethod: string | null = null;
				const currentData: Record<string, string | number> = {};

				for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
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
							currentData.hubTraversal = parseFloat(hubMatch[2]);
						} else {
							// Try "X paths, Y% hub" format
							const pathsHubMatch = methodMatch[2].match(/(\d+)\s+paths?,\s*([\d.]+)%/);
							if (pathsHubMatch) {
								currentData.path = parseInt(pathsHubMatch[1]);
								currentData.hubTraversal = parseFloat(pathsHubMatch[2]);
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
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				let currentMethod: string | null = null;
				const currentData: Record<string, number> = {};

				for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
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

						if (minMatch) currentData.min = parseInt(minMatch[1]);
						if (maxMatch) currentData.max = parseInt(maxMatch[1]);
						if (meanMatch) currentData.mean = parseFloat(meanMatch[1]);
						if (medianMatch) currentData.median = parseInt(medianMatch[1]);
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
			parse: (lines, startIdx) => {
				const data: Record<string, string | number> = {};
				for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					const salienceMean = line.match(/Path Salience mean MI:\s+([\d.]+)/);
					if (salienceMean) data.salienceMean = parseFloat(salienceMean[1]);
					const randomMean = line.match(/Random mean MI:\s+([\d.]+)/);
					if (randomMean) data.randomMean = parseFloat(randomMean[1]);
					const uMatch = line.match(/Mann-Whitney U:\s+([\d.]+)/);
					if (uMatch) data.u = parseFloat(uMatch[1]);
					const pMatch = line.match(/p-value:\s+([\d.]+)/);
					if (pMatch) data.pValue = parseFloat(pMatch[1]);
					const dMatch = line.match(/Cohen's d:\s+([\d.-]+)/);
					if (dMatch) data.cohensD = parseFloat(dMatch[1]);
					if (line.trim() === "" && i > startIdx + 3) break;
				}
				return Object.keys(data).length >= 3 ? { title: "Statistical Test: Path Diversity", rows: [data] } : null;
			},
		},
		// Perturbation Consistency
		{
			header: /=== Consistent Method Ranking ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(.+?):\s+DP=([\d.]+),\s+BFS=([\d.]+)\s+\((\w+)\)/);
					if (match) {
						rows.push({
							perturbation: match[1].trim(),
							dpDiversity: parseFloat(match[2]),
							bfsDiversity: parseFloat(match[3]),
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
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				let jsonStr = "";
				let lineIdx = startIdx + 1;
				let braceCount = 0;
				let hasStartedJson = false;
				let inJson = false;

				// Find and collect JSON
				while (lineIdx < lines.length) {
					const line = lines[lineIdx];
					const trimmed = line.trim();

					// Detect JSON start
					if (trimmed === "{") {
						hasStartedJson = true;
					}

					// Track braces when in JSON
					if (hasStartedJson) {
						inJson = true;
						braceCount += (trimmed.match(/{/g) || []).length;
						braceCount -= (trimmed.match(/}/g) || []).length;
					}

					jsonStr += line;

					// Stop when JSON is complete
					if (hasStartedJson && braceCount === 0 && trimmed.includes("}")) {
						break;
					}

					// Stop at next section (test output or new header)
					if (trimmed.startsWith("===") && lineIdx > startIdx + 1) {
						break;
					}
					if ((trimmed.includes("✓") || trimmed.includes("×")) && lineIdx > startIdx + 10) {
						break;
					}

					lineIdx++;
					if (lineIdx > startIdx + 50) break;
				}

				try {
					// Extract just the JSON part
					const jsonStart = jsonStr.indexOf("{");
					const jsonEnd = jsonStr.lastIndexOf("}") + 1;
					if (jsonStart >= 0 && jsonEnd > jsonStart) {
						jsonStr = jsonStr.substring(jsonStart, jsonEnd);
						const jsonData = JSON.parse(jsonStr);
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
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 1; i < Math.min(startIdx + 15, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^\d+\.\s+(.+?):\s+([\d.]+)\s+\((\d+)\s+paths\)/);
					if (match) {
						rows.push({
							method: match[1],
							diversity: parseFloat(match[2]),
							paths: parseInt(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "Method Ranking by Path Diversity", rows } : null;
			},
		},
		// Structural Representativeness (Ego Network)
		{
			header: /=== Structural Representativeness \(Ego Network\) ===/,
			parse: (lines, startIdx) => {
				const data: Record<string, string | number> = {};
				for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					const coverageMatch = line.match(/Coverage:\s+([\d.]+)/);
					if (coverageMatch) data.coverage = parseFloat(coverageMatch[1]);
					const precisionMatch = line.match(/Precision:\s+([\d.]+)/);
					if (precisionMatch) data.precision = parseFloat(precisionMatch[1]);
					const f1Match = line.match(/F1 Score:\s+([\d.]+)/);
					if (f1Match) data.f1Score = parseFloat(f1Match[1]);
					const intersectionMatch = line.match(/Intersection:\s+(\d+)\/(\d+)/);
					if (intersectionMatch) {
						data.intersectionSize = parseInt(intersectionMatch[1]);
						data.totalNodes = parseInt(intersectionMatch[2]);
					}
					if (line.trim() === "" && i > startIdx + 3) break;
				}
				return Object.keys(data).length >= 2 ? { title: "Structural Representativeness (Ego Network)", rows: [data] } : null;
			},
		},
		// N-Seed Generalisation
		{
			header: /=== N-Seed Generalisation ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/N=(\d+) \(([^)]+)\): (\d+) nodes,\s+(\d+) paths/);
					if (match) {
						rows.push({
							n: parseInt(match[1]),
							variant: match[2],
							nodes: parseInt(match[3]),
							paths: parseInt(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "N-Seed Generalisation", rows } : null;
			},
		},
		// Hub Mitigation Analysis
		{
			header: /=== Hub Mitigation Analysis ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 2; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS)\s*&\s+(\d+)\s*&\s+--\s*&\s+(\d+)\s*&\s+(\d+)/);
					if (match) {
						rows.push({
							method: match[1],
							nodes: parseInt(match[2]),
							paths: parseInt(match[3]),
							iterations: parseInt(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "Hub Mitigation Analysis", rows } : null;
			},
		},
		// Multi-Hub Expansion Efficiency
		{
			header: /=== Multi-Hub Expansion Efficiency ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 2; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced)\s*&\s+(\d+)\s*&\s+(\d+)\s+\(([\d.]+)%\)\s*&\s+(\d+)/);
					if (match) {
						rows.push({
							method: match[1],
							nodesExpanded: parseInt(match[2]),
							hubsExpanded: parseInt(match[3]),
							hubRatio: parseFloat(match[4]),
							pathsFound: parseInt(match[5]),
						});
					}
				}
				return rows.length > 0 ? { title: "Multi-Hub Expansion Efficiency", rows } : null;
			},
		},
		// Structural Representativeness Metrics
		{
			header: /=== Structural Representativeness Metrics ===/,
			parse: (lines, startIdx) => {
				const data: Record<string, string | number> = {};
				for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					const totalMatch = line.match(/Total Sampled:\s+(\d+)\s+nodes/);
					if (totalMatch) data.totalSampled = parseInt(totalMatch[1]);
					const hubMatch = line.match(/Hub Coverage:\s+([\d.]+)%/);
					if (hubMatch) data.hubCoverage = parseFloat(hubMatch[1]);
					const bucketMatch = line.match(/Buckets Covered:\s+(\d+)\/(\d+)/);
					if (bucketMatch) {
						data.bucketsCovered = parseInt(bucketMatch[1]);
						data.totalBuckets = parseInt(bucketMatch[2]);
					}
					if (line.trim() === "" && i > startIdx + 3) break;
				}
				return Object.keys(data).length >= 2 ? { title: "Structural Representativeness Metrics", rows: [data] } : null;
			},
		},
		// N-Seed Comparison Across Methods
		{
			header: /=== N-Seed Comparison Across Methods ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 2; i < Math.min(startIdx + 20, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+([\d.]+)%/);
					if (match) {
						rows.push({
							method: match[1],
							n: parseInt(match[2]),
							nodes: parseInt(match[3]),
							paths: parseInt(match[4]),
							iterations: parseInt(match[5]),
							coverage: parseFloat(match[6]),
						});
					}
				}
				return rows.length > 0 ? { title: "N-Seed Comparison Across Methods", rows } : null;
			},
		},
		// N=2 Hub Traversal Comparison
		{
			header: /=== N=2 Hub Traversal Comparison ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 2; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)%/);
					if (match) {
						rows.push({
							method: match[1],
							paths: parseInt(match[2]),
							hubTraversal: parseInt(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "N=2 Hub Traversal Comparison", rows } : null;
			},
		},
		// N=2 Path Diversity Comparison
		{
			header: /=== N=2 Path Diversity Comparison ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				for (let i = startIdx + 2; i < Math.min(startIdx + 10, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===")) break;
					const match = line.match(/^(Degree-Prioritised|Standard BFS|Frontier-Balanced|Random Priority)\s*&\s+(\d+)\s*&\s+(\d+)\s*&\s+([\d.]+)/);
					if (match) {
						rows.push({
							method: match[1],
							paths: parseInt(match[2]),
							uniqueNodes: parseInt(match[3]),
							diversity: parseFloat(match[4]),
						});
					}
				}
				return rows.length > 0 ? { title: "N=2 Path Diversity Comparison", rows } : null;
			},
		},
		// Algorithm Comparison (from evaluation harness)
		{
			header: /=== Algorithm Comparison ===/,
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				// Skip the table header and separator
				for (let i = startIdx + 3; i < Math.min(startIdx + 100, lines.length); i++) {
					const line = lines[i];
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
						const n = parseInt(nMatch[1]);

						// Only include N=2 results for n-seed tables
						if (n === 2) {
							const nodeVal = nodes === "N/A" ? 0 : parseInt(nodes);
							const pathVal = paths === "N/A" ? 0 : parseInt(paths);
							const divVal = diversity === "N/A" || diversity === "N/A" ? 0 : parseFloat(diversity);
							rows.push({
								graph,
								n,
								method,
								nodes: nodeVal,
								paths: pathVal,
								diversity: divVal,
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
			parse: (lines, startIdx) => {
				const rows: Record<string, string | number>[] = [];
				// Skip the table header and separator
				for (let i = startIdx + 3; i < Math.min(startIdx + 100, lines.length); i++) {
					const line = lines[i];
					if (line.trim() === "" || line.startsWith("===") || line.includes("Average hub")) break;

					// Parse table row format: "scale-free-100 | Degree-Prioritised | 18.5%"
					const match = line.match(/^([\w-]+)\s*\|\s*([\w\s-]+?)\s*\|\s*([\d.]+)%/);
					if (match) {
						rows.push({
							graph: match[1],
							method: match[2].trim(),
							hubTraversal: parseFloat(match[3]),
						});
					}
				}
				return rows.length > 0 ? { title: "Hub Traversal Comparison", rows } : null;
			},
		},
		// MI Ranking Quality (from benchmark tests)
		{
			header: /=== (Karate Club|Les Misérables|Facebook) (Path Ranking|Character Path) Analysis ===/,
			parse: (lines, startIdx) => {
				const data: Record<string, string | number> = {};
				let datasetName = "";

				// Extract dataset name from header
				const headerMatch = lines[startIdx].match(/=== (Karate Club|Les Misérables|Facebook) /);
				if (headerMatch) {
					datasetName = headerMatch[1];
				}

				for (let i = startIdx; i < Math.min(startIdx + 15, lines.length); i++) {
					const line = lines[i];

					// Parse "Path Salience: X paths"
					const pathsMatch = line.match(/Path Salience:\s+(\d+)\s+paths/);
					if (pathsMatch) data.paths = parseInt(pathsMatch[1]);

					// Parse "  Mean MI: X.XXX"
					const meanMIMatch = line.match(/Mean MI:\s+([\d.]+)/);
					if (meanMIMatch) data.meanMI = parseFloat(meanMIMatch[1]);

					// Parse "  Node Coverage: X.XX"
					const coverageMatch = line.match(/Node Coverage:\s+([\d.]+)/);
					if (coverageMatch) data.nodeCoverage = parseFloat(coverageMatch[1]);

					// Parse "  Path Diversity: X.XXX"
					const diversityMatch = line.match(/Path Diversity:\s+([\d.]+)/);
					if (diversityMatch) data.pathDiversity = parseFloat(diversityMatch[1]);

					if (line.trim() === "" && i > startIdx + 3) break;
				}

				if (Object.keys(data).length >= 3) {
					return { title: "MI Ranking Quality", rows: [{ dataset: datasetName, ...data }] };
				}
				return null;
			},
		},
	];

	// Find and parse all metric sections
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		for (const parser of parsers) {
			if (parser.header.test(line)) {
				const section = parser.parse(lines, i);
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
					};
					const key = keyMap[section.title];
					if (key) {
						// For sections that can have multiple valid entries, deduplicate by key
						// Otherwise, replace with latest data to avoid accumulation
						const deduplicateSections: (keyof TestMetrics)[] = [
							"runtimePerformance", "scalability", "crossDataset",
							"hubTraversalComparison", "algorithmComparison", "miRankingQuality"
						];
						if (deduplicateSections.includes(key)) {
							// These sections can have multiple rows - merge with deduplication
							if (!metrics[key]) {
								metrics[key] = section;
							} else {
								// Deduplicate existing rows by creating a unique key
								const existingRows = metrics[key]!.rows;
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
								metrics[key]!.rows = combinedRows;
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
}

// Helper to parse verbose output for TAP generation
interface ParsedTest {
	name: string;
	status: "passed" | "failed";
}

function parseVerboseOutput(output: string): { tests: ParsedTest[]; summary: string } {
	const tests: ParsedTest[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		// Look for test result lines like "✓ test name" or "✗ test name"
		// Vitest verbose format: [32m✓[39m ... test name
		const passMatch = line.match(/\[32m✓\[39m.*?\s+(.+)$/);
		if (passMatch) {
			tests.push({ name: passMatch[1].trim(), status: "passed" });
			continue;
		}

		const failMatch = line.match(/\[31m✗\[39m.*?\s+(.+)$/);
		if (failMatch) {
			tests.push({ name: failMatch[1].trim(), status: "failed" });
		}
	}

	// Extract summary
	const summaryMatch = output.match(/\[2m\s+Tests\s\[22m.*?\[1\[32m(\d+)\s+passed/);
	const summary = summaryMatch ? `${summaryMatch[1]} passed` : "tests completed";

	return { tests, summary };
}

// Main
async function main() {
	const args = process.argv.slice(2);
	const outputFile = args.find((a) => a.startsWith("--output="))?.split("=")[1] || null;
	const metricsMode = args.includes("--metrics");
	const metricsOutput = args.find((a) => a.startsWith("--metrics-output="))?.split("=")[1] || join(projectRoot, "test-metrics.json");

	let tests: ParsedTest[] = [];
	let metrics: TestMetrics = {};
	let exitCode = 0;

	if (metricsMode) {
		// In metrics mode, run vitest once with verbose reporter for both TAP and metrics
		const vitest = spawn("npx", ["vitest", "run", "--project=exp", "--reporter=verbose"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "inherit"],
		});

		let verboseOutput = "";

		for await (const chunk of vitest.stdout) {
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
		const vitest = spawn("npx", ["vitest", "run", "--project=exp", "--reporter=json"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "inherit"],
		});

		let jsonOutput = "";

		for await (const chunk of vitest.stdout) {
			const text = chunk.toString();
			jsonOutput += text;
		}

		exitCode = await new Promise<number>((resolve) => {
			vitest.on("close", resolve);
		});

		// Parse JSON output
		const jsonLines = jsonOutput.split("\n").filter((line) => line.trim().startsWith("{"));
		const results = JSON.parse(jsonLines[jsonLines.length - 1] || "{}");
		tests = collectTests(results).map((t) => ({
			name: t.name,
			status: t.status as "passed" | "failed",
		}));
	}

	// Generate TAP output
	const tapLines: string[] = [];
	tapLines.push("TAP version 13");
	tapLines.push(`1..${tests.length}`);

	for (let i = 0; i < tests.length; i++) {
		const test = tests[i];
		const isOk = test.status === "passed" || test.status === "skipped";
		tapLines.push(`${isOk ? "ok" : "not ok"} ${i + 1} - ${test.name}`);
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
		const dir = dirname(outputFile);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(outputFile, tapOutput);
		console.error(`\nTAP output written to: ${outputFile}`);
	}

	// Write metrics if requested
	if (metricsMode) {
		const metricsJson = JSON.stringify(metrics, null, 2);
		writeFileSync(metricsOutput, metricsJson);
		console.error(`\nMetrics written to: ${metricsOutput}`);
	}

	process.exit(exitCode ?? 0);
}

main();
