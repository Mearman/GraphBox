/**
 * Utilities for working with GraphSpec objects.
 *
 * Handles parsing specs from JSON files and CLI arguments.
 */

import { readFileSync } from "node:fs";

import type { GraphSpec } from "../generation/spec";
import { makeGraphSpec } from "../generation/spec";

/**
 * Load a GraphSpec from a JSON file.
 * @param filepath
 */
export const loadSpecFromFile = (filepath: string): GraphSpec => {
	const content = readFileSync(filepath, "utf8");
	return loadSpecFromString(content);
};

/**
 * Parse a GraphSpec from a JSON string.
 * @param content
 */
export const loadSpecFromString = (content: string): GraphSpec => {
	const json = JSON.parse(content) as unknown;

	if (typeof json !== "object" || json === null) {
		throw new Error("GraphSpec must be an object");
	}

	// Validate that it matches GraphSpec structure
	// For now, we trust the JSON structure and let makeGraphSpec handle defaults
	return json as GraphSpec;
};

/**
 * Create a GraphSpec from CLI flags.
 * Supports common property overrides like --directed, --connected, etc.
 * @param flags
 */
export const specFromFlags = (flags: Record<string, unknown>): GraphSpec => {
	const overrides: Record<string, unknown> = {};

	// Directionality
	if (flags.directed === true) {
		overrides.directionality = { kind: "directed" };
	} else if (flags.undirected === true) {
		overrides.directionality = { kind: "undirected" };
	}

	// Connectivity
	if (flags.connected === true) {
		overrides.connectivity = { kind: "connected" };
	} else if (flags.disconnected === true && typeof flags.components === "number") {
		overrides.connectivity = { kind: "disconnected", components: flags.components };
	}

	// Cycles
	if (flags.acyclic === true) {
		overrides.cycles = { kind: "acyclic" };
	}

	// Weighting
	if (flags.weighted === true) {
		overrides.weighting = { kind: "weighted", range: { min: 0.1, max: 1 } };
	} else if (flags.unweighted === true) {
		overrides.weighting = { kind: "unweighted" };
	}

	// Density
	if (flags.sparse === true) {
		overrides.density = { kind: "sparse" };
	} else if (flags.dense === true) {
		overrides.density = { kind: "dense" };
	}

	// Self loops
	if (flags.selfLoops === true) {
		overrides.selfLoops = { kind: "allowed" };
	} else if (flags.noSelfLoops === true) {
		overrides.selfLoops = { kind: "disallowed" };
	}

	// Partiteness (bipartite)
	if (flags.bipartite === true) {
		overrides.partiteness = { kind: "bipartite" };
	}

	// Planar
	if (flags.planar === true) {
		overrides.planar = { kind: "planar" };
	}

	return makeGraphSpec(overrides);
};

/**
 * Serialize a GraphSpec to JSON string.
 * @param spec
 * @param pretty
 */
export const specToJson = (spec: GraphSpec, pretty = true): string => {
	return JSON.stringify(spec, null, pretty ? 2 : 0);
};

/**
 * Merge two GraphSpec objects, with overrides taking precedence.
 * @param base
 * @param overrides
 */
export const mergeSpecs = (base: GraphSpec, overrides: Partial<GraphSpec>): GraphSpec => {
	return {
		...base,
		...overrides,
	};
};
