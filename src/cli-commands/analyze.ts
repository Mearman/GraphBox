/**
 * Analyze command implementation.
 *
 * Analyzes graphs and infers their specifications.
 *
 * Usage:
 *   graphbox analyze --input graph.gml
 *   graphbox analyze --input graph.json --output analysis.json --verbose
 */

import { writeFileSync } from "node:fs";

import { computeGraphSpecFromGraph } from "../analyzer/main";
import type { ParsedArgs as ParsedArguments } from "../cli-utils/arg-parser";
import { getBoolean, getOptional, getRequired } from "../cli-utils/arg-parser";
import { formatError } from "../cli-utils/error-formatter";
import type { GraphFormat } from "../cli-utils/format-detection";
import { graphJsonToAnalyzer } from "../cli-utils/graph-converter";
import { loadGraphFromFile } from "../cli-utils/graph-loader";

export interface AnalyzeOptions {
	/** Input file path */
	input: string;

	/** Output file path (optional, defaults to stdout) */
	output?: string;

	/** Explicitly specify input format */
	format?: GraphFormat;

	/** Verbose output */
	verbose: boolean;
}

/**
 * Parse analyze command arguments.
 * @param args
 * @param arguments_
 */
export const parseAnalyzeArgs = (arguments_: ParsedArguments): AnalyzeOptions => {
	const input = getRequired(arguments_, "input");
	const output = getOptional<string | undefined>(arguments_, "output");
	const format = getOptional<GraphFormat | undefined>(arguments_, "format");
	const verbose = getBoolean(arguments_, "verbose", false);

	return {
		input,
		output,
		format,
		verbose,
	};
};

/**
 * Format spec as human-readable text.
 * @param spec
 * @param verbose
 */
const formatSpecAsText = (spec: Record<string, unknown>, verbose: boolean): string => {
	const lines: string[] = [ "Graph Analysis Results"];
	lines.push("=".repeat(50));
	lines.push("");

	// Core properties (always show)
	const coreProperties = [
		"directionality",
		"weighting",
		"cycles",
		"connectivity",
		"density",
		"selfLoops",
		"edgeMultiplicity",
		"completeness",
	];

	lines.push("Core Properties:");
	for (const property of coreProperties) {
		if (spec[property] !== undefined) {
			const value = spec[property] as Record<string, unknown>;
			lines.push(`  ${property}: ${value.kind}`);
		}
	}

	// Advanced properties (only in verbose mode or if constrained)
	if (verbose) {
		lines.push("");
		lines.push("All Properties:");
		for (const [key, value] of Object.entries(spec)) {
			if (!coreProperties.includes(key) && value !== undefined) {
				const propertyValue = value as Record<string, unknown>;
				if (propertyValue.kind !== "unconstrained") {
					lines.push(`  ${key}: ${propertyValue.kind}`);
				}
			}
		}
	}

	return lines.join("\n");
};

/**
 * Execute the analyze command.
 * @param options
 */
export const executeAnalyze = (options: AnalyzeOptions): void => {
	try {
		// Load graph
		const { graph, format } = loadGraphFromFile(options.input, {
			format: options.format,
		});

		if (options.verbose) {
			console.error(`Loaded graph from ${options.input} (format: ${format})`);
			console.error(`  Nodes: ${graph.nodes.length}`);
			console.error(`  Edges: ${graph.edges.length}`);
			console.error("");
		}

		// Convert to analyzer format
		const analyzerGraph = graphJsonToAnalyzer(graph);

		// Analyze graph
		const spec = computeGraphSpecFromGraph(analyzerGraph);

		// Format output
		let output: string;

		if (options.output?.endsWith(".json") ?? false) {
			// JSON output
			output = JSON.stringify(spec, null, 2);
		} else {
			// Human-readable text output
			output = formatSpecAsText(spec as Record<string, unknown>, options.verbose);
		}

		// Write output
		if (options.output === undefined) {
			// Print to stdout
			console.log(output);
		} else {
			writeFileSync(options.output, output, "utf-8");
			if (options.verbose) {
				console.error(`Analysis saved to ${options.output}`);
			}
		}
	} catch (error) {
		const formatted = formatError(error);
		console.error(`Error: ${formatted.message}`);
		if (formatted.suggestion !== undefined) {
			console.error(`Suggestion: ${formatted.suggestion}`);
		}
		process.exit(formatted.exitCode);
	}
};

/**
 * Run the analyze command from parsed arguments.
 * @param args
 * @param arguments_
 */
export const runAnalyze = (arguments_: ParsedArguments): void => {
	const options = parseAnalyzeArgs(arguments_);
	executeAnalyze(options);
};
