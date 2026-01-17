/**
 * Graph loading utilities
 *
 * Support for loading benchmark datasets in various formats.
 */

export {
	decompressGzip,
	fetchAndDecompressGzip,
	fetchWithAutoDecompress,
	isGzipUrl,
} from "./decompress";
export {
	type EdgeListConfig,
	type LoadedEdge,
	loadEdgeList,
	type LoadedNode,
	loadGraph,
	loadGraphFromUrl,
	type LoadResult,
	loadTriples,
	type TripleConfig,
} from "./edge-list-loader";
