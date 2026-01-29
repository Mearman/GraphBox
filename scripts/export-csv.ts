#!/usr/bin/env tsx
/**
 * CSV Export for Thesis Tables
 *
 * Reads test-metrics.json and writes per-category CSV files
 * to Thesis/gen/data/ for consumption by LaTeX pgfplotstable.
 *
 * Usage:
 *   npx tsx scripts/export-csv.ts
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readMetrics } from "../src/experiments/metrics/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const metricsPath = path.join(projectRoot, "src/test-metrics.json");
const outputDir = path.resolve(projectRoot, "../Thesis/gen/data");

/**
 * LaTeX-escape a string value for pgfplotstable consumption.
 * Handles special characters that appear in dataset/method names.
 */
/**
 * Exact-match display name mappings for kebab-case identifiers.
 * Applied after LaTeX character escaping.
 */
const displayNames: Record<string, string> = {
	"Les Misérables": String.raw`Les Mis\'erables`,
	"Erdős-Rényi": String.raw`Erd\H{o}s-R\'enyi`,
	"erdos-renyi": String.raw`Erd\H{o}s-R\'enyi`,
	"Barabási-Albert": String.raw`Barab\'asi-Albert`,
	"barabasi-albert": String.raw`Barab\'asi-Albert`,
	"watts-strogatz": "Watts-Strogatz",
	"real-world": "Real-world (OpenAlex)",
	"karate": "Karate Club",
	"lesmis": String.raw`Les Mis\'erables`,
	"cora": "Cora",
	"facebook": "Facebook",
	"path-salience": "MI Ranking (Primary)",
	"degree-sum": "Degree-sum",
	"jaccard-arithmetic": "Jaccard-arithmetic",
	"pagerank-sum": "PageRank-sum",
	"random": "Random",
	"shortest-path": "Shortest-path",
	"Ensemble (BFS∪DFS∪DP)": String.raw`Ensemble (BFS$\cup$DFS$\cup$DP)`,
};

const latexEscape = (value: string): string =>
	displayNames[value] ?? value;

/**
 * Format a single cell value for CSV output.
 * - null/undefined → empty string
 * - strings → LaTeX-escaped, quoted if containing commas
 * - numbers → as-is
 * @param value
 */
const formatCell = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") {
		const escaped = latexEscape(value);
		// Quote if contains comma, quote, or newline
		if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
			return `"${escaped.replaceAll('"', '""')}"`;
		}
		return escaped;
	}
	return String(value);
};

/**
 * Convert an array of records to RFC 4180 CSV.
 * Field order is taken from the union of all keys,
 * preserving the order of the first record.
 * @param records
 */
const toCSV = (records: Array<Record<string, unknown>>): string => {
	if (records.length === 0) return "";

	// Collect all field names preserving first-record order
	const fieldSet = new Set<string>();
	for (const record of records) {
		for (const key of Object.keys(record)) {
			fieldSet.add(key);
		}
	}
	const fields = [...fieldSet];

	const header = fields.join(",");
	const rows = records.map((record) =>
		fields.map((field) => formatCell(record[field])).join(","),
	);

	return [header, ...rows].join("\n") + "\n";
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const metrics = readMetrics(metricsPath);
if (!metrics) {
	console.error(`Error: Metrics file not found: ${metricsPath}`);
	console.error("Run experiments first: pnpm test:metrics");
	process.exit(1);
}

// Ensure output directory exists
if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

let fileCount = 0;

for (const [category, entries] of Object.entries(metrics.metrics)) {
	if (!entries || entries.length === 0) continue;

	// Special case: salience-coverage-comparison splits by dataset
	// Pre-multiply salienceCoverage by 100 so LaTeX can display it directly
	// (avoids pgfplotstable `multiply with` which conflicts with global `string type`)
	if (category === "salience-coverage-comparison") {
		const byDataset: Record<string, Array<Record<string, unknown>>> = {};
		for (const entry of entries) {
			const record = { ...(entry as unknown as Record<string, unknown>) };
			if (typeof record.salienceCoverage === "number") {
				record.salienceCoverage = Math.round(record.salienceCoverage * 100);
			}
			const dataset = String(record.dataset ?? "unknown");
			byDataset[dataset] ??= [];
			byDataset[dataset].push(record);
		}

		for (const [dataset, datasetEntries] of Object.entries(byDataset)) {
			const filename = `salience-coverage-${dataset}.csv`;
			const csv = toCSV(datasetEntries);
			writeFileSync(path.join(outputDir, filename), csv, "utf-8");
			fileCount++;
			console.log(`  ${filename} (${datasetEntries.length} rows)`);
		}
		continue;
	}

	const filename = `${category}.csv`;
	const csv = toCSV(entries as unknown as Array<Record<string, unknown>>);
	writeFileSync(path.join(outputDir, filename), csv, "utf-8");
	fileCount++;
	console.log(`  ${filename} (${entries.length} rows)`);
}

console.log(`\nExported ${fileCount} CSV files to ${outputDir}`);
