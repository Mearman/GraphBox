/**
 * SNAP (Stanford Network Analysis Project) format support.
 *
 * Provides parsing for SNAP edge list format, commonly used
 * for large network datasets from snap.stanford.edu.
 *
 * @example
 * ```typescript
 * import { parseSnap, snapToJson, fetchSnapDataset } from 'graphbox';
 *
 * // Parse edge list to JSON
 * const doc = parseSnap(edgeListContent);
 * const json = snapToJson(doc, { meta: { ... } });
 *
 * // Fetch and convert in one step
 * const result = await fetchSnapDataset(url, { meta: { ... } });
 * ```
 */

// Types
export type { SnapDocument } from "./types";

// Parser
export type { SnapToJsonOptions } from "./parse";
export { parseSnap, snapToJson } from "./parse";

// Fetcher
export type { FetchSnapOptions, FetchSnapResult } from "./fetch";
export { fetchSnapDataset } from "./fetch";
