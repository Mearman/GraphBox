/**
 * Validate command implementation.
 *
 * Validates graphs against specifications.
 *
 * Usage:
 *   graphbox validate --input graph.json --spec constraints.json
 *   graphbox validate --input graph.gml --format gml --strict
 */

import type { ParsedArguments } from "../cli-utils/arg-parser";
import { getBoolean, getOptional, getRequired } from "../cli-utils/arg-parser";
import { formatError, formatValidationErrors } from "../cli-utils/error-formatter";
import type { GraphFormat } from "../cli-utils/format-detection";
import { graphJsonToTest } from "../cli-utils/graph-converter";
import { loadGraphFromFile } from "../cli-utils/graph-loader";
import { loadSpecFromFile } from "../cli-utils/spec-utils";
import {
	validateConnectivity,
	validateCycles,
	validateDensityAndCompleteness,
	validateDirectionality,
	validateEdgeMultiplicity,
	validateSchema,
	validateSelfLoops,
	validateWeighting,
} from "../validation/index";
import type { PropertyValidationResult } from "../validation/types";

export interface ValidateOptions {
	/** Input file path */
	input: string;

	/** Spec file path (optional, will infer from graph if not provided) */
	spec?: string;

	/** Explicitly specify input format */
	format?: GraphFormat;

	/** Strict mode: fail on any validation error */
	strict: boolean;

	/** Verbose output */
	verbose: boolean;
}

/**
 * Parse validate command arguments.
 * @param args
 * @param arguments_
 */
export const parseValidateArgs = (arguments_: ParsedArguments): ValidateOptions => {
	const input = getRequired(arguments_, "input");
	const spec = getOptional<string | undefined>(arguments_, "spec");
	const format = getOptional<GraphFormat | undefined>(arguments_, "format");
	const strict = getBoolean(arguments_, "strict", false);
	const verbose = getBoolean(arguments_, "verbose", false);

	return {
		input,
		spec,
		format,
		strict,
		verbose,
	};
};

/**
 * Execute the validate command.
 * @param options
 */
export const executeValidate = (options: ValidateOptions): void => {
	try {
		// Load graph
		const { graph, format } = loadGraphFromFile(options.input, {
			format: options.format,
		});

		if (options.verbose) {
			console.log(`Loaded graph from ${options.input} (format: ${format})`);
			console.log(`  Nodes: ${graph.nodes.length}`);
			console.log(`  Edges: ${graph.edges.length}`);
		}

		// Load or infer spec
		let spec;
		if (options.spec === undefined) {
			// Infer spec from graph metadata if available
			// For now, we require explicit spec
			throw new Error("Spec file required. Use --spec to provide a specification file.");
		} else {
			spec = loadSpecFromFile(options.spec);
			if (options.verbose) {
				console.log(`Using specification from ${options.spec}`);
			}
		}

		// Convert to test graph format
		const testGraph = graphJsonToTest(graph, spec);

		// Validate core properties
		const results: PropertyValidationResult[] = [
			validateDirectionality(testGraph),
			validateWeighting(testGraph),
			validateCycles(testGraph),
			validateConnectivity(testGraph),
			validateSchema(testGraph),
			validateEdgeMultiplicity(testGraph),
			validateSelfLoops(testGraph),
			validateDensityAndCompleteness(testGraph),
		];

		// Collect errors
		const errors = results.filter((r: PropertyValidationResult) => !r.valid);

		if (errors.length > 0) {
			const formatted = formatValidationErrors(
				errors.map((e: PropertyValidationResult) => ({
					property: e.property,
					message: e.message ?? `Expected ${e.expected}, got ${e.actual}`,
				}))
			);

			console.error(formatted.message);
			process.exit(formatted.exitCode);
		}

		// Success
		console.log("✓ Validation passed");
		console.log(`  Validated ${results.length} properties`);

		if (options.verbose) {
			console.log("\nValidation Results:");
			for (const result of results) {
				console.log(`  ✓ ${result.property}: ${result.actual}`);
			}
		}

		process.exit(0);
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
 * Run the validate command from parsed arguments.
 * @param args
 * @param arguments_
 */
export const runValidate = (arguments_: ParsedArguments): void => {
	const options = parseValidateArgs(arguments_);
	executeValidate(options);
};
