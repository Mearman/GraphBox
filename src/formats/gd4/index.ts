/**
 * GD4 file format support.
 *
 * Provides parsing for the Graph Drawing 2004 contest format,
 * a simple ASCII format for undirected graphs with node coordinates.
 *
 * @example
 * ```typescript
 * import { parseGd4, gd4ToJson, fetchGd4Dataset } from 'graphbox';
 *
 * // Parse .gd4 file to JSON
 * const doc = parseGd4(gd4Content);
 * const json = gd4ToJson(doc, { meta: { ... } });
 *
 * // Fetch and convert in one step
 * const result = await fetchGd4Dataset(url, { meta: { ... } });
 * ```
 */

// Types
export type { Gd4Document, Gd4Edge, Gd4Node } from "./types";

// Parser
export type { Gd4ToJsonOptions } from "./parse";
export { gd4ToJson, parseGd4 } from "./parse";

// Fetcher
export type { FetchGd4Options, FetchGd4Result } from "./fetch";
export { fetchGd4Dataset } from "./fetch";
