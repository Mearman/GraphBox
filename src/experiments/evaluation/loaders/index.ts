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
	isGmlContent,
	type EdgeListConfig,
	type LoadedEdge,
	loadEdgeList,
	loadFromGraphJson,
	loadGml,
	type LoadedNode,
	loadGraph,
	loadGraphFromUrl,
	type LoadResult,
	loadTriples,
	type TripleConfig,
} from "./edge-list-loader";
