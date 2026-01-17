/**
 * Pajek .net format support.
 *
 * Provides parsing for Pajek network format, commonly used
 * for large network analysis with the Pajek software.
 *
 * @example
 * ```typescript
 * import { parsePajek, pajekToJson, fetchPajekDataset } from 'graphbox';
 *
 * // Parse .net file to JSON
 * const doc = parsePajek(netContent);
 * const json = pajekToJson(doc, { meta: { ... } });
 *
 * // Fetch and convert in one step
 * const result = await fetchPajekDataset(url, { meta: { ... } });
 * ```
 */

// Types
export type { PajekDocument, PajekEdge, PajekVertex } from "./types";

// Parser
export type { PajekToJsonOptions } from "./parse";
export { pajekToJson, parsePajek } from "./parse";

// Fetcher
export type { FetchPajekOptions, FetchPajekResult } from "./fetch";
export { fetchPajekDataset } from "./fetch";
