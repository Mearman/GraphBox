/**
 * Generate command implementation.
 *
 * Generates graphs from specifications and outputs them in various formats.
 *
 * Usage:
 *   graphbox generate --spec spec.json --nodes 50 --output graph.json
 *   graphbox generate --directed --connected --nodes 20 --format gml
 */

import { writeFileSync } from "node:fs";

import type { ParsedArguments } from "../cli-utils/arg-parser";
import { getNumber, getOptional } from "../cli-utils/arg-parser";
import { formatError } from "../cli-utils/error-formatter";
import type { GraphFormat } from "../cli-utils/format-detection";
import { testGraphToJson } from "../cli-utils/graph-converter";
import { loadSpecFromFile, mergeSpecs, specFromFlags } from "../cli-utils/spec-utils";
import { serializeGml } from "../formats/gml/index";
import { generateGraph } from "../generation/generator";
import type { GraphSpec } from "../generation/spec";

export interface GenerateOptions {
	/** Path to spec file (optional if using inline flags) */
	specFile?: string;

	/** Number of nodes to generate */
	nodeCount: number;

	/** Random seed for reproducibility */
	seed?: number;

	/** Output file path */
	output?: string;

	/** Output format (default: json) */
	format: GraphFormat;

	/** Inline spec flags (overrides spec file) */
	flags: Record<string, unknown>;
}

/**
 * Parse generate command arguments.
 * @param args
 * @param arguments_
 */
export const parseGenerateArgs = (arguments_: ParsedArguments): GenerateOptions => {
	const specFile = getOptional<string>(arguments_, "spec");
	const nodeCount = getNumber(arguments_, "nodes");
	const seed = getOptional<number>(arguments_, "seed");
	const output = getOptional<string>(arguments_, "output");
	const format = getOptional<GraphFormat>(arguments_, "format", "json");

	// Validate format
	if (!["json", "gml", "pajek", "snap", "ucinet"].includes(format)) {
		throw new Error(`Invalid format: ${format}. Must be one of: json, gml, pajek, snap, ucinet`);
	}

	return {
		specFile,
		nodeCount,
		seed,
		output,
		format,
		flags: arguments_,
	};
};

/**
 * Load or create spec from options.
 * @param options
 */
const loadSpec = (options: GenerateOptions): GraphSpec => {
	let spec: GraphSpec;

	if (options.specFile === undefined) {
		// Create from inline flags only
		spec = specFromFlags(options.flags);
	} else {
		// Load from file
		spec = loadSpecFromFile(options.specFile);

		// Merge with inline flags if present
		const flagSpec = specFromFlags(options.flags);
		spec = mergeSpecs(spec, flagSpec);
	}

	return spec;
};

/**
 * Execute the generate command.
 * @param options
 */
export const executeGenerate = (options: GenerateOptions): void => {
	try {
		// Load or create spec
		const spec = loadSpec(options);

		// Generate graph
		const testGraph = generateGraph(spec, {
			nodeCount: options.nodeCount,
			seed: options.seed,
		});

		// Convert to output format
		let output: string;

		switch (options.format) {
			case "json": {
				const graphJson = testGraphToJson(testGraph);
				output = JSON.stringify(graphJson, null, 2);
				break;
			}

			case "gml": {
				const graphJson = testGraphToJson(testGraph);
				output = serializeGml(graphJson);
				break;
			}

			case "pajek":
			case "snap":
			case "ucinet": {
				throw new Error(`Serialization to ${options.format} format is not yet supported. Use 'json' or 'gml'.`);
			}

			default: {
				const _exhaustive: never = options.format;
				throw new Error(`Unsupported format: ${_exhaustive}`);
			}
		}

		// Write output
		if (options.output === undefined) {
			// Print to stdout
			console.log(output);
		} else {
			writeFileSync(options.output, output, "utf8");
			console.log(`Graph generated and saved to ${options.output}`);
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
 * Run the generate command from parsed arguments.
 * @param args
 * @param arguments_
 */
export const runGenerate = (arguments_: ParsedArguments): void => {
	const options = parseGenerateArgs(arguments_);
	executeGenerate(options);
};
