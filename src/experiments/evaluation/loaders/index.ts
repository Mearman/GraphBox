/**
 * Graph loading utilities
 *
 * Support for loading benchmark datasets in various formats.
 */

export {
	clearCache,
	decompressGzip,
	decompressTar,
	decompressTgz,
	decompressZip,
	fetchAndDecompressGzip,
	fetchAndDecompressTar,
	fetchAndDecompressTgz,
	fetchAndDecompressZip,
	fetchAndExtract,
	fetchWithAutoDecompress,
	getCacheStats,
	isGzipUrl,
	isTarUrl,
	isTgzUrl,
	isZipUrl,
} from "./decompress";
export {
	type EdgeListConfig,
	isGmlContent,
	type LoadedEdge,
	loadEdgeList,
	type LoadedNode,
	loadFromGraphJson,
	loadGml,
	loadGraph,
	loadGraphFromUrl,
	type LoadResult,
	loadTriples,
	type TripleConfig,
} from "./edge-list-loader";
