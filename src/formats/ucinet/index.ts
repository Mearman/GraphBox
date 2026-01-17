/**
 * UCINet DL format support.
 *
 * Provides parsing for UCINet DL format, commonly used
 * for social network analysis with the UCINet software.
 *
 * @example
 * ```typescript
 * import { parseDl, dlToJson, fetchDlDataset } from 'graphbox';
 *
 * // Parse .dl file to JSON
 * const doc = parseDl(dlContent);
 * const json = dlToJson(doc, { meta: { ... } });
 *
 * // Fetch and convert in one step
 * const result = await fetchDlDataset(url, { meta: { ... } });
 * ```
 */

// Types
export type { DlDocument, DlEdge, DlFormat } from "./types";

// Parser
export type { DlToJsonOptions } from "./parse";
export { dlToJson, parseDl } from "./parse";

// Fetcher
export type { FetchDlOptions, FetchDlResult } from "./fetch";
export { fetchDlDataset } from "./fetch";
