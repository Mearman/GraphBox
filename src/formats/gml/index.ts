/**
 * GML (Graph Modelling Language) format support.
 *
 * Provides parsing and serialization for the GML graph format,
 * commonly used for network analysis datasets.
 *
 * @example
 * ```typescript
 * import { parseGml, gmlToJson, serializeGml } from 'graphbox';
 *
 * // Parse GML to JSON
 * const doc = parseGml(gmlContent);
 * const json = gmlToJson(doc, { meta: { ... } });
 *
 * // Serialize JSON to GML
 * const gml = serializeGml(json);
 * ```
 */

// Types
export type {
	Citation,
	GmlDocument,
	GmlEdge,
	GmlNode,
	GraphEdge,
	GraphJson,
	GraphMeta,
	GraphNode,
} from "./types";

// Parser
export type { GmlToJsonOptions } from "./parse";
export { gmlToJson,parseGml } from "./parse";

// Serializer
export type { SerializeGmlOptions } from "./serialize";
export { serializeGml } from "./serialize";

// Fetcher
export type { FetchDatasetOptions, FetchDatasetResult } from "./fetch";
export { fetchDataset, fetchDatasets } from "./fetch";
