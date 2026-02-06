#!/usr/bin/env tsx
/**
 * CSV Export for Thesis Tables
 *
 * Reads test-metrics.json and writes per-category CSV files
 * to Thesis/src/data/ for consumption by LaTeX pgfplotstable.
 *
 * Outputs clean UTF-8 CSV — no LaTeX escaping. LuaLaTeX/XeTeX
 * with Tectonic handles UTF-8 natively.
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
const outputDir = path.resolve(projectRoot, "../Thesis/src/data");

/**
 * Format a single cell value for CSV output.
 * - null/undefined -> empty string
 * - strings -> quoted if containing commas/quotes/newlines
 * - numbers -> as-is
 * @param value
 */
const formatCell = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") {
		if (value.includes(",") || value.includes('"') || value.includes("\n")) {
			return `"${value.replaceAll('"', '""')}"`;
		}
		return value;
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

/**
 * Split records by a field value and write per-group CSV files.
 * @param entries
 * @param splitField
 * @param filenamePrefix
 */
const splitAndWrite = (
	entries: Array<Record<string, unknown>>,
	splitField: string,
	filenamePrefix: string,
): void => {
	const groups: Record<string, Array<Record<string, unknown>>> = {};
	for (const entry of entries) {
		const key = String((entry)[splitField] ?? "unknown");
		groups[key] ??= [];
		groups[key].push(entry);
	}

	for (const [groupKey, groupEntries] of Object.entries(groups)) {
		const filename = `${filenamePrefix}-${groupKey}.csv`;
		const csv = toCSV(groupEntries);
		writeFileSync(path.join(outputDir, filename), csv, "utf-8");
		fileCount++;
		console.log(`  ${filename} (${groupEntries.length} rows)`);
	}
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

if (!existsSync(outputDir)) {
	mkdirSync(outputDir, { recursive: true });
}

let fileCount = 0;

for (const [category, entries] of Object.entries(metrics.metrics)) {
	if (!entries || entries.length === 0) continue;

	const records = entries as unknown as Array<Record<string, unknown>>;

	// Salience coverage: split by dataset, multiply coverage by 100
	if (category === "salience-coverage-comparison" || category === "salience-coverage-budget") {
		const adjusted = records.map((entry) => {
			const record = { ...entry };
			if (typeof record.salienceCoverage === "number") {
				record.salienceCoverage = Math.round(record.salienceCoverage * 100);
			}
			return record;
		});
		const prefix = category === "salience-coverage-budget"
			? "salience-coverage-budget"
			: "salience-coverage";
		splitAndWrite(adjusted, "dataset", prefix);
		continue;
	}

	// Ranking method comparison: split by graphCategory
	if (category === "ranking-method-comparison") {
		// Write consolidated file
		const filename = `${category}.csv`;
		const csv = toCSV(records);
		writeFileSync(path.join(outputDir, filename), csv, "utf-8");
		fileCount++;
		console.log(`  ${filename} (${records.length} rows)`);

		// Write per-category files
		splitAndWrite(records, "graphCategory", "ranking-method-comparison");
		continue;
	}

	// Ranking order comparison: split by graphCategory
	if (category === "ranking-order-comparison") {
		// Write consolidated file
		const filename = `${category}.csv`;
		const csv = toCSV(records);
		writeFileSync(path.join(outputDir, filename), csv, "utf-8");
		fileCount++;
		console.log(`  ${filename} (${records.length} rows)`);

		// Write per-category files
		splitAndWrite(records, "graphCategory", "ranking-order-comparison");
		continue;
	}

	// Default: single file per category
	const filename = `${category}.csv`;
	const csv = toCSV(records);
	writeFileSync(path.join(outputDir, filename), csv, "utf-8");
	fileCount++;
	console.log(`  ${filename} (${entries.length} rows)`);
}

console.log(`\nExported ${fileCount} CSV files to ${outputDir}`);
