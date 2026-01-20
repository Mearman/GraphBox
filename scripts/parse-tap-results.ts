#!/usr/bin/env node
/**
 * TAP Results Parser
 *
 * Extracts test results and numeric metrics from TAP (Test Anything Protocol) output.
 *
 * Usage:
 *   tsx scripts/parse-tap-results.ts test-results.tap
 *   tsx scripts/parse-tap-results.ts test-results.tap --output results.json
 *   tsx scripts/parse-tap-results.ts test-results.tap --format csv
 *   tsx scripts/parse-tap-results.ts test-results.tap --metrics-only
 *
 * Output formats:
 *   - json: Structured JSON with tests and metrics
 *   - csv: Flattened metrics as CSV
 *   - summary: Human-readable summary
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

interface TapTest {
	index: number;
	status: "ok" | "not ok";
	name: string;
	directive?: "SKIP" | "TODO";
	diagnostic?: {
		duration_ms?: number;
		errors?: Array<{ message: string; stack?: string }>;
		[key: string]: string | number | object | undefined;
	};
}

interface TapResults {
	version: string;
	count: number;
	passed: number;
	failed: number;
	skipped: number;
	todos: number;
	duration?: number;
	tests: TapTest[];
	metrics: MetricSummary[];
	suites: SuiteSummary[];
}

interface MetricSummary {
	name: string;
	values: number[];
	min: number;
	max: number;
	mean: number;
	median: number;
	tests: number;
}

interface SuiteSummary {
	name: string;
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	metrics: Record<string, number | string>;
}

interface YamlBlock {
	content: string;
	lineNumber: number;
}

/**
 * Parses TAP output into structured results.
 */
async function parseTap(tapContent: string): Promise<TapResults> {
	const lines = tapContent.split("\n");
	let version = "13";
	let plannedCount = 0;
	const tests: TapTest[] = [];
	const suiteComments: Map<number, string> = new Map();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Parse version
		const versionMatch = line.match(/^TAP version (\d+)/);
		if (versionMatch) {
			version = versionMatch[1];
			continue;
		}

		// Parse plan
		const planMatch = line.match(/^1\.\.(\d+)/);
		if (planMatch) {
			plannedCount = Number.parseInt(planMatch[1], 10);
			continue;
		}

		// Parse suite comment
		const suiteMatch = line.match(/^#\s+(.+)$/);
		if (suiteMatch && !line.includes("Summary") && !line.includes("Duration")) {
			suiteComments.set(tests.length, suiteMatch[1]);
			continue;
		}

		// Parse test line
		const testMatch = line.match(/^(ok|not ok)\s+(\d+)\s+-?\s*(.+?)(?:\s+#\s*(SKIP|TODO))?$/);
		if (testMatch) {
			const [, status, indexStr, name, directive] = testMatch;
			const index = Number.parseInt(indexStr, 10);

			// Look ahead for YAML diagnostic block
			let diagnostic: TapTest["diagnostic"];
			if (i + 1 < lines.length && lines[i + 1].trim() === "---") {
				const yamlEnd = findYamlEnd(lines, i + 2);
				const yamlLines = lines.slice(i + 2, yamlEnd);
				diagnostic = parseYamlBlock(yamlLines);
				// Skip past YAML in main loop
				i = yamlEnd;
			}

			tests.push({
				index,
				status: status as "ok" | "not ok",
				name: name.trim(),
				directive: directive as "SKIP" | "TODO" | undefined,
				diagnostic,
			});
		}
	}

	// Calculate summaries
	const passed = tests.filter((t) => t.status === "ok" && !t.directive).length;
	const failed = tests.filter((t) => t.status === "not ok").length;
	const skipped = tests.filter((t) => t.directive === "SKIP").length;
	const todos = tests.filter((t) => t.directive === "TODO").length;

	// Extract metrics
	const metrics = extractMetrics(tests);

	// Group by suites
	const suites = groupBySuites(tests, suiteComments);

	return {
		version,
		count: tests.length,
		passed,
		failed,
		skipped,
		todos,
		tests,
		metrics,
		suites,
	};
}

/**
 * Finds the end of a YAML block (marked by '...').
 */
function findYamlEnd(lines: string[], start: number): number {
	for (let i = start; i < lines.length; i++) {
		if (lines[i].trim() === "...") return i;
	}
	return lines.length;
}

/**
 * Parses a YAML diagnostic block into an object.
 */
function parseYamlBlock(lines: string[]): Record<string, string | number | object> {
	const result: Record<string, string | number | object> = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed === "..." || trimmed === "---") continue;

		// Parse "key: value" format
		const match = trimmed.match(/^(\S[^:]*?)\s*:\s*(.+)$/);
		if (match) {
			const [, key, value] = match;
			result[key] = parseYamlValue(value);
		}
	}

	return result;
}

/**
 * Parses a YAML value, attempting to convert to number or parse JSON.
 */
function parseYamlValue(value: string): string | number | object {
	value = value.trim();

	// Try number
	const num = Number.parseFloat(value);
	if (!Number.isNaN(num) && String(num) === value) {
		return num;
	}

	// Try JSON object/array
	if (value.startsWith("{") || value.startsWith("[")) {
		try {
			return JSON.parse(value);
		} catch {
			// Not valid JSON, return as string
		}
	}

	// Remove quotes if present
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}

	return value;
}

/**
 * Extracts all numeric metrics from tests and calculates summary statistics.
 */
function extractMetrics(tests: TapTest[]): MetricSummary[] {
	const metricMap = new Map<string, number[]>();

	for (const test of tests) {
		if (!test.diagnostic) continue;

		for (const [key, value] of Object.entries(test.diagnostic)) {
			if (key === "errors" || key === "duration_ms") continue;

			if (typeof value === "number") {
				if (!metricMap.has(key)) {
					metricMap.set(key, []);
				}
				metricMap.get(key)!.push(value);
			}
		}
	}

	const summaries: MetricSummary[] = [];

	for (const [name, values] of metricMap.entries()) {
		if (values.length === 0) continue;

		const sorted = [...values].sort((a, b) => a - b);
		const sum = values.reduce((a, b) => a + b, 0);

		summaries.push({
			name,
			values,
			min: sorted[0]!,
			max: sorted[sorted.length - 1]!,
			mean: sum / values.length,
			median: sorted[Math.floor(sorted.length / 2)]!,
			tests: values.length,
		});
	}

	return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Groups tests by suite and calculates suite summaries.
 */
function groupBySuites(
	tests: TapTest[],
	suiteComments: Map<number, string>,
): SuiteSummary[] {
	const suites = new Map<string, { passed: number; failed: number; skipped: number; metrics: Record<string, string | number>[] }>();

	let currentSuite = "";
	let testIndex = 0;

	for (const test of tests) {
		// Check if we have a suite comment for this test
		if (suiteComments.has(testIndex)) {
			currentSuite = suiteComments.get(testIndex)!;
		}

		if (!suites.has(currentSuite)) {
			suites.set(currentSuite, {
				passed: 0,
				failed: 0,
				skipped: 0,
				metrics: [],
			});
		}

		const suite = suites.get(currentSuite)!;

		if (test.status === "ok" && !test.directive) {
			suite.passed++;
		} else if (test.status === "not ok") {
			suite.failed++;
		} else if (test.directive === "SKIP") {
			suite.skipped++;
		}

		if (test.diagnostic) {
			suite.metrics.push(test.diagnostic);
		}

		testIndex++;
	}

	const result: SuiteSummary[] = [];

	for (const [name, data] of suites.entries()) {
		// Aggregate metrics (take the last value for each metric)
		const aggregatedMetrics: Record<string, string | number> = {};
		for (const metrics of data.metrics) {
			for (const [key, value] of Object.entries(metrics)) {
				if (typeof value === "number" || typeof value === "string") {
					aggregatedMetrics[key] = value;
				}
			}
		}

		result.push({
			name: name || "(root)",
			passed: data.passed,
			failed: data.failed,
			skipped: data.skipped,
			total: data.passed + data.failed + data.skipped,
			metrics: aggregatedMetrics,
		});
	}

	return result.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Formats results as JSON.
 */
function formatAsJson(results: TapResults): string {
	return JSON.stringify(results, null, 2);
}

/**
 * Formats metrics as CSV.
 */
function formatAsCsv(results: TapResults): string {
	const headers = ["metric", "min", "max", "mean", "median", "tests"];
	const rows: string[][] = [headers];

	for (const metric of results.metrics) {
		rows.push([
			metric.name,
			metric.min.toFixed(4),
			metric.max.toFixed(4),
			metric.mean.toFixed(4),
			metric.median.toFixed(4),
			String(metric.tests),
		]);
	}

	return rows.map((row) => row.join(",")).join("\n");
}

/**
 * Formats results as a human-readable summary.
 */
function formatAsSummary(results: TapResults): string {
	const lines: string[] = [];

	lines.push("TAP Test Results Summary");
	lines.push("=" .repeat(40));
	lines.push("");
	lines.push(`Tests: ${results.count} (${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped)`);

	if (results.metrics.length > 0) {
		lines.push("");
		lines.push("Metrics:");
		lines.push("-".repeat(40));

		for (const metric of results.metrics) {
			lines.push(
				`  ${metric.name}: mean=${metric.mean.toFixed(4)} min=${metric.min.toFixed(4)} max=${metric.max.toFixed(4)} (n=${metric.tests})`,
			);
		}
	}

	if (results.suites.length > 1) {
		lines.push("");
		lines.push("Suites:");
		lines.push("-".repeat(40));

		for (const suite of results.suites) {
			lines.push(
				`  ${suite.name}: ${suite.passed}/${suite.total} passed`,
			);
		}
	}

	if (results.failed > 0) {
		lines.push("");
		lines.push("Failed Tests:");
		lines.push("-".repeat(40));

		for (const test of results.tests) {
			if (test.status === "not ok") {
				lines.push(`  ${test.index}. ${test.name}`);
				if (test.diagnostic?.errors) {
					for (const error of test.diagnostic.errors) {
						lines.push(`    Error: ${error.message}`);
					}
				}
			}
		}
	}

	return lines.join("\n");
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			output: { type: "string" },
			format: { type: "string", default: "summary" },
			"metrics-only": { type: "boolean" },
		},
		allowPositionals: true,
	});

	const tapFile = positionals[0];
	if (!tapFile) {
		console.error("Usage: parse-tap-results.ts <tap-file> [options]");
		console.error("Options:");
		console.error("  --output <file>    Write output to file");
		console.error("  --format <fmt>    Output format: json, csv, summary (default: summary)");
		console.error("  --metrics-only    Only output metrics, not test results");
		process.exit(1);
	}

	if (!existsSync(tapFile)) {
		console.error(`Error: TAP file not found: ${tapFile}`);
		process.exit(1);
	}

	const tapContent = await readFile(tapFile, "utf-8");
	const results = await parseTap(tapContent);

	// Filter to metrics only if requested
	let output: string;
	const format = values.format as string;

	if (values["metrics-only"]) {
		const metricsJson = JSON.stringify(results.metrics, null, 2);
		output = format === "json" ? metricsJson : JSON.stringify(results.metrics, null, 2);
	} else {
		switch (format) {
			case "json":
				output = formatAsJson(results);
				break;
			case "csv":
				output = formatAsCsv(results);
				break;
			case "summary":
			default:
				output = formatAsSummary(results);
				break;
		}
	}

	if (values.output) {
		await writeFile(values.output as string, output);
		console.log(`Results written to: ${values.output}`);
	} else {
		console.log(output);
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
