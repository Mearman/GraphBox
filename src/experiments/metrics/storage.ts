/**
 * Metrics Storage
 *
 * Handles reading and writing metrics to/from JSON files.
 */

import { existsSync,mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Metric, MetricCategory,MetricsOutput } from "./types.js";

export interface StorageOptions {
	outputPath: string;
	pretty?: boolean;
}

/**
 * Write metrics to a JSON file.
 * @param metrics
 * @param options
 */
export const writeMetrics = (metrics: MetricsOutput, options: StorageOptions): void => {
	const { outputPath, pretty = true } = options;

	// Ensure directory exists
	const dir = path.dirname(outputPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const content = pretty
		? JSON.stringify(metrics, null, 2)
		: JSON.stringify(metrics);

	writeFileSync(outputPath, content, "utf8");
};

/**
 * Read metrics from a JSON file.
 * @param inputPath
 */
export const readMetrics = (inputPath: string): MetricsOutput | null => {
	if (!existsSync(inputPath)) {
		return null;
	}

	try {
		const content = readFileSync(inputPath, "utf8");
		return JSON.parse(content) as MetricsOutput;
	} catch {
		return null;
	}
};

/**
 * Resolve output path relative to project root.
 * @param fromPath
 * @param outputPath
 */
export const resolveOutputPath = (fromPath: string, outputPath: string = "test-metrics.json"): string => path.resolve(fromPath, "..", outputPath);

/**
 * Merge multiple metrics outputs into one.
 * Later metrics take precedence for conflicts.
 * @param metricsList
 */
export const mergeMetrics = (...metricsList: MetricsOutput[]): MetricsOutput => {
	const mergedMetrics: Partial<Record<MetricCategory, Metric[]>> = {};

	for (const metrics of metricsList) {
		for (const [category, entries] of Object.entries(metrics.metrics)) {
			const cat = category as MetricCategory;
			if (!mergedMetrics[cat]) {
				mergedMetrics[cat] = [];
			}
			mergedMetrics[cat].push(...entries);
		}
	}

	return {
		version: metricsList[0]?.version || "1.0.0",
		timestamp: new Date().toISOString(),
		metrics: mergedMetrics,
	};
};
