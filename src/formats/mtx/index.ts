/**
 * Matrix Market (.mtx) format support.
 *
 * Provides parsing for Matrix Market coordinate format, commonly used
 * by the SuiteSparse Matrix Collection (sparse.tamu.edu).
 *
 * @example
 * ```typescript
 * import { parseMtx, mtxToJson, fetchMtxDataset } from 'graphbox';
 *
 * // Parse .mtx content to JSON
 * const doc = parseMtx(mtxContent);
 * const json = mtxToJson(doc, { meta: { ... } });
 *
 * // Fetch and convert from SuiteSparse
 * const result = await fetchMtxDataset(url, { meta: { ... } });
 * ```
 */

// Types
export type { MtxDocument, MtxEntry, MtxSymmetry, MtxValueType } from "./types";

// Parser
export type { MtxToJsonOptions } from "./parse";
export { mtxToJson, parseMtx } from "./parse";

// Fetcher
export type { FetchMtxOptions, FetchMtxResult } from "./fetch";
export { fetchMtxDataset } from "./fetch";
