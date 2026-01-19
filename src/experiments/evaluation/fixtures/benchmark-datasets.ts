/**
 * Benchmark Dataset Fixtures
 *
 * Provides standardised access to benchmark graph datasets for evaluation experiments.
 * Each dataset has known properties (node count, edge count, directed/undirected) and
 * can be loaded consistently across experiments.
 *
 * Datasets are stored in data/benchmarks/ relative to the repository root.
 */

import { readFile } from "node:fs/promises";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Graph } from "../../../algorithms/graph/graph";
import {
	isGmlContent,
	loadEdgeList,
	loadFromGraphJson,
	loadGml,
	type LoadedEdge,
	type LoadedNode,
	fetchAndExtract,
} from "../loaders/index";

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata for a benchmark dataset.
 */
export interface BenchmarkDatasetMeta {
	/** Human-readable name */
	name: string;

	/** Short identifier for tables/logs */
	id: string;

	/** Brief description */
	description: string;

	/** Whether edges are directed */
	directed: boolean;

	/** Expected node count (for validation) */
	expectedNodes: number;

	/** Expected edge count (for validation) */
	expectedEdges: number;

	/** Expected content size in bytes (for validation, helps detect remote changes) */
	expectedContentSize: number;

	/** File path relative to data/benchmarks/ */
	relativePath: string;

	/** Delimiter for parsing (regex or string) */
	delimiter: string | RegExp;

	/** Source/citation for the dataset */
	source: string;

	/**
	 * Remote URL for downloading the dataset.
	 * Used for browser environments or when local files aren't available.
	 * Should point to a raw text file in edge list format.
	 */
	remoteUrl?: string;
}

/**
 * A loaded benchmark dataset with graph and metadata.
 */
export interface LoadedBenchmark {
	/** The loaded graph */
	graph: Graph<LoadedNode, LoadedEdge>;

	/** Dataset metadata */
	meta: BenchmarkDatasetMeta;

	/** Actual node count after loading */
	nodeCount: number;

	/** Actual edge count after loading */
	edgeCount: number;

	/** Actual content size in bytes */
	contentSize: number;
}

// ============================================================================
// Dataset Definitions
// ============================================================================

/**
 * Cora citation network.
 *
 * A citation network of machine learning papers.
 * Nodes are papers, edges are citations.
 */
export const CORA: BenchmarkDatasetMeta = {
	name: "Cora",
	id: "cora",
	description: "Citation network of machine learning papers",
	directed: true,
	expectedNodes: 2708,
	expectedEdges: 5429,
	expectedContentSize: 69928,
	relativePath: "cora/cora.edges",
	delimiter: /\s+/,  // Local .edges file and remote .cites both use whitespace
	source: "McCallum et al., Automating the Construction of Internet Portals with Machine Learning, 2000",
	remoteUrl: "https://linqs-data.soe.ucsc.edu/public/lbc/cora.tgz",
};

/**
 * CiteSeer citation network.
 *
 * A citation network of computer science papers.
 * Nodes are papers, edges are citations.
 */
export const CITESEER: BenchmarkDatasetMeta = {
	name: "CiteSeer",
	id: "citeseer",
	description: "Citation network of computer science papers",
	directed: true,
	expectedNodes: 3327,  // LINQS remote dataset has 3327 nodes
	expectedEdges: 4732,  // LINQS remote dataset has 4732 edges
	expectedContentSize: 137062,
	relativePath: "citeseer/citeseer.edges",
	delimiter: /\s+/,  // Local .edges file and remote .cites both use whitespace
	source: "Giles et al., CiteSeer: An Automatic Citation Indexing System, 1998",
	remoteUrl: "https://linqs-data.soe.ucsc.edu/public/lbc/citeseer.tgz",
};

/**
 * Facebook ego network.
 *
 * Combined ego networks from Facebook, representing friendships.
 * Nodes are users, edges are friendships (undirected).
 */
export const FACEBOOK: BenchmarkDatasetMeta = {
	name: "Facebook",
	id: "facebook",
	description: "Combined Facebook ego networks (friendships)",
	directed: false,
	expectedNodes: 4039,
	expectedEdges: 88_234,
	expectedContentSize: 854362,
	relativePath: "facebook/facebook_combined.txt",
	delimiter: /\s+/,
	source: "Leskovec & McAuley, Learning to Discover Social Circles in Ego Networks, NIPS 2012",
	remoteUrl: "https://snap.stanford.edu/data/facebook_combined.txt.gz",
};

/**
 * Zachary's Karate Club network.
 *
 * Classic social network of a university karate club.
 * Nodes are members, edges represent friendships outside the club.
 */
export const KARATE: BenchmarkDatasetMeta = {
	name: "Karate Club",
	id: "karate",
	description: "Zachary's Karate Club social network",
	directed: false,
	expectedNodes: 34,
	expectedEdges: 78,
	expectedContentSize: 4194,
	relativePath: "karate/karate.edges",
	delimiter: /\s+/,
	source: "Zachary, An Information Flow Model for Conflict and Fission in Small Groups, 1977",
	remoteUrl: "https://websites.umich.edu/~mejn/netdata/karate.zip",
};

/**
 * Les Misérables character co-appearance network.
 *
 * Characters from Victor Hugo's novel connected by co-appearance.
 * Nodes are characters, edges weighted by number of co-appearances.
 */
export const LESMIS: BenchmarkDatasetMeta = {
	name: "Les Misérables",
	id: "lesmis",
	description: "Character co-appearance network from Les Misérables",
	directed: false,
	expectedNodes: 77,  // UMich remote GML has 77 nodes
	expectedEdges: 254,  // UMich remote GML has 254 edges
	expectedContentSize: 17610,
	relativePath: "lesmis/lesmis.edges",
	delimiter: /\s+/,
	source: "Knuth, The Stanford GraphBase: A Platform for Combinatorial Computing, 1993",
	remoteUrl: "https://websites.umich.edu/~mejn/netdata/lesmis.zip",
};

/**
 * DBLP co-authorship network.
 *
 * Large-scale collaboration network from computer science bibliography.
 * Nodes are authors, edges represent co-authorship on publications.
 * Note: This is a large dataset (300K+ nodes) and may take time to load.
 */
export const DBLP: BenchmarkDatasetMeta = {
	name: "DBLP",
	id: "dblp",
	description: "DBLP computer science co-authorship network",
	directed: false,
	expectedNodes: 317_080,
	expectedEdges: 1_049_866,
	expectedContentSize: 13931442,  // ~14MB uncompressed
	relativePath: "dblp/com-dblp.ungraph.txt",
	delimiter: /\t/,
	source: "Yang & Leskovec, Defining and Evaluating Network Communities based on Ground-truth, ICDM 2012",
	remoteUrl: "https://snap.stanford.edu/data/bigdata/communities/com-dblp.ungraph.txt.gz",
};

/**
 * All available benchmark datasets.
 */
export const BENCHMARK_DATASETS: BenchmarkDatasetMeta[] = [CORA, CITESEER, FACEBOOK, KARATE, LESMIS, DBLP];

/**
 * Map of dataset IDs to metadata.
 */
export const DATASETS_BY_ID: Map<string, BenchmarkDatasetMeta> = new Map(
	BENCHMARK_DATASETS.map((d) => [d.id, d])
);

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Resolve the path to a benchmark dataset file.
 *
 * @param meta - Dataset metadata
 * @param benchmarksRoot - Optional root directory for benchmarks (defaults to repo data/benchmarks/)
 * @returns Absolute path to the dataset file
 */
export const resolveBenchmarkPath = (meta: BenchmarkDatasetMeta, benchmarksRoot?: string): string => {
	if (benchmarksRoot) {
		return resolve(benchmarksRoot, meta.relativePath);
	}

	// Default: assume we're in packages/evaluation, go up to repo root
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const repoRoot = resolve(__dirname, "..", "..", "..", "..");
	return resolve(repoRoot, "data", "benchmarks", meta.relativePath);
};

/**
 * Load a benchmark dataset.
 *
 * Uses remote URL with caching if configured, otherwise loads from local file.
 *
 * @param meta - Dataset metadata
 * @param benchmarksRoot - Optional root directory for benchmarks (only used if no remoteUrl)
 * @returns Loaded benchmark with graph and metadata
 * @throws Error if file not found or parsing fails
 */
export const loadBenchmark = async (meta: BenchmarkDatasetMeta, benchmarksRoot?: string): Promise<LoadedBenchmark> => {
	// Use remote URL with caching if available
	if (meta.remoteUrl) {
		return loadBenchmarkFromUrl(meta.remoteUrl, meta);
	}

	// Fall back to local file
	const filePath = resolveBenchmarkPath(meta, benchmarksRoot);
	const content = await readFile(filePath, "utf-8");

	const result = loadEdgeList(content, {
		directed: meta.directed,
		delimiter: meta.delimiter,
	});

	const nodeCount = result.graph.getAllNodes().length;
	const edgeCount = result.graph.getAllEdges().length;
	const contentSize = content.length;

	return {
		graph: result.graph,
		meta,
		nodeCount,
		edgeCount,
		contentSize,
	};
};

/**
 * Load a benchmark dataset by ID.
 *
 * @param id - Dataset identifier (e.g., 'cora', 'citeseer', 'facebook')
 * @param benchmarksRoot - Optional root directory for benchmarks
 * @returns Loaded benchmark with graph and metadata
 * @throws Error if dataset ID not found
 */
export const loadBenchmarkById = async (id: string, benchmarksRoot?: string): Promise<LoadedBenchmark> => {
	const meta = DATASETS_BY_ID.get(id.toLowerCase());
	if (!meta) {
		const available = BENCHMARK_DATASETS.map((d) => d.id).join(", ");
		throw new Error(`Unknown benchmark dataset: '${id}'. Available: ${available}`);
	}
	return loadBenchmark(meta, benchmarksRoot);
};

/**
 * Load all benchmark datasets.
 *
 * @param benchmarksRoot - Optional root directory for benchmarks
 * @returns Map of dataset ID to loaded benchmark
 */
export const loadAllBenchmarks = async (benchmarksRoot?: string): Promise<Map<string, LoadedBenchmark>> => {
	const results = new Map<string, LoadedBenchmark>();

	for (const meta of BENCHMARK_DATASETS) {
		try {
			const benchmark = await loadBenchmark(meta, benchmarksRoot);
			results.set(meta.id, benchmark);
		} catch (error) {
			console.warn(`Failed to load benchmark '${meta.id}': ${error}`);
		}
	}

	return results;
};

// ============================================================================
// Browser-Compatible URL Loaders
// ============================================================================

/**
 * Load a benchmark dataset from a URL.
 *
 * This function works in both browser and Node.js environments.
 * Automatically handles gzip-compressed files (.gz extension).
 *
 * @param url - URL to the edge list file (can be .txt or .txt.gz)
 * @param meta - Dataset metadata (for parsing configuration)
 * @returns Loaded benchmark with graph and metadata
 * @throws Error if fetch fails or parsing fails
 *
 * @example
 * ```typescript
 * // Plain text file
 * const benchmark = await loadBenchmarkFromUrl(
 *   'https://raw.githubusercontent.com/user/repo/main/data/karate.edges',
 *   KARATE
 * );
 *
 * // Gzip-compressed file (automatically decompressed)
 * const compressed = await loadBenchmarkFromUrl(
 *   'https://snap.stanford.edu/data/facebook_combined.txt.gz',
 *   FACEBOOK
 * );
 * ```
 */
export const loadBenchmarkFromUrl = async (url: string, meta: BenchmarkDatasetMeta): Promise<LoadedBenchmark> => {
	// Auto-detect format and extract content (handles .zip, .tar.gz, .gz, .txt, .gml)
	// Note: .gml must come before .txt because UMich datasets have both, and .txt is just a description
	const content = await fetchAndExtract(url, [".edges", ".gml", ".txt", ".cites"]);

	// Detect format and use appropriate loader
	let result: Awaited<ReturnType<typeof loadEdgeList>>;

	if (isGmlContent(content)) {
		// Use GML parser for GML format
		result = await loadGml(content, meta.directed);
	} else {
		// Use edge list parser for text-based formats
		result = loadEdgeList(content, {
			directed: meta.directed,
			delimiter: meta.delimiter,
		});
	}

	const nodeCount = result.graph.getAllNodes().length;
	const edgeCount = result.graph.getAllEdges().length;
	const contentSize = content.length;

	return {
		graph: result.graph,
		meta,
		nodeCount,
		edgeCount,
		contentSize,
	};
};

/**
 * Load a benchmark dataset by ID from a URL.
 *
 * If the dataset has a remoteUrl configured, uses that. Otherwise, you must provide a URL.
 * Works in both browser and Node.js environments.
 *
 * @param id - Dataset identifier (e.g., 'cora', 'karate')
 * @param url - Optional URL override (required if dataset has no remoteUrl)
 * @returns Loaded benchmark with graph and metadata
 * @throws Error if dataset ID not found or no URL available
 *
 * @example
 * ```typescript
 * // Using custom URL
 * const karate = await loadBenchmarkByIdFromUrl('karate',
 *   'https://example.com/datasets/karate.edges'
 * );
 * ```
 */
export const loadBenchmarkByIdFromUrl = async (id: string, url?: string): Promise<LoadedBenchmark> => {
	const meta = DATASETS_BY_ID.get(id.toLowerCase());
	if (!meta) {
		const available = BENCHMARK_DATASETS.map((d) => d.id).join(", ");
		throw new Error(`Unknown benchmark dataset: '${id}'. Available: ${available}`);
	}

	const targetUrl = url ?? meta.remoteUrl;
	if (!targetUrl) {
		throw new Error(
			`No URL provided for dataset '${id}'. Either provide a URL or configure remoteUrl in the dataset metadata.`
		);
	}

	return loadBenchmarkFromUrl(targetUrl, meta);
};

/**
 * Load a benchmark from edge list content string.
 *
 * This is the most flexible loader - works with any string content.
 * Useful when you've already fetched the data or have it embedded.
 *
 * @param content - Edge list content as string
 * @param meta - Dataset metadata (for parsing configuration)
 * @returns Loaded benchmark with graph and metadata
 *
 * @example
 * ```typescript
 * const content = "1 2\n2 3\n3 1";
 * const benchmark = loadBenchmarkFromContent(content, {
 *   ...KARATE,
 *   expectedNodes: 3,
 *   expectedEdges: 3
 * });
 * ```
 */
export const loadBenchmarkFromContent = (content: string, meta: BenchmarkDatasetMeta): LoadedBenchmark => {
	const result = loadEdgeList(content, {
		directed: meta.directed,
		delimiter: meta.delimiter,
	});

	const nodeCount = result.graph.getAllNodes().length;
	const edgeCount = result.graph.getAllEdges().length;
	const contentSize = content.length;

	return {
		graph: result.graph,
		meta,
		nodeCount,
		edgeCount,
		contentSize,
	};
};

/**
 * Create a custom benchmark metadata for ad-hoc datasets.
 *
 * Helper function to create metadata for datasets not in the standard list.
 *
 * @param options - Partial metadata (id and name are required)
 * @returns Complete benchmark metadata
 *
 * @example
 * ```typescript
 * const myDataset = createBenchmarkMeta({
 *   id: 'my-graph',
 *   name: 'My Custom Graph',
 *   expectedNodes: 100,
 *   expectedEdges: 500,
 *   directed: false
 * });
 *
 * const benchmark = await loadBenchmarkFromUrl(
 *   'https://example.com/my-graph.edges',
 *   myDataset
 * );
 * ```
 */
export const createBenchmarkMeta = (
	options: Pick<BenchmarkDatasetMeta, "id" | "name"> &
		Partial<Omit<BenchmarkDatasetMeta, "id" | "name">>
): BenchmarkDatasetMeta => ({
	description: options.description ?? `Custom dataset: ${options.name}`,
	directed: options.directed ?? false,
	expectedNodes: options.expectedNodes ?? 0,
	expectedEdges: options.expectedEdges ?? 0,
	expectedContentSize: options.expectedContentSize ?? 0,
	relativePath: options.relativePath ?? "",
	delimiter: options.delimiter ?? /\s+/,
	source: options.source ?? "Custom dataset",
	remoteUrl: options.remoteUrl,
	...options,
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get summary statistics for a loaded benchmark.
 *
 * @param benchmark - Loaded benchmark
 * @returns Summary string
 */
export const getBenchmarkSummary = (benchmark: LoadedBenchmark): string => {
	const { meta, nodeCount, edgeCount } = benchmark;
	const direction = meta.directed ? "directed" : "undirected";
	return `${meta.name}: ${nodeCount} nodes, ${edgeCount} edges (${direction})`;
};

/**
 * Validate that a loaded benchmark matches expected properties.
 *
 * @param benchmark - Loaded benchmark
 * @param tolerance - Allowed percentage difference (default 5%)
 * @returns Validation result with any warnings
 */
export const validateBenchmark = (benchmark: LoadedBenchmark, tolerance = 0.05): { valid: boolean; warnings: string[] } => {
	const warnings: string[] = [];
	const { meta, nodeCount, edgeCount, contentSize } = benchmark;

	const nodeDiff = Math.abs(nodeCount - meta.expectedNodes) / meta.expectedNodes;
	const edgeDiff = Math.abs(edgeCount - meta.expectedEdges) / meta.expectedEdges;

	if (nodeDiff > tolerance) {
		warnings.push(
			`Node count ${nodeCount} differs from expected ${meta.expectedNodes} by ${(nodeDiff * 100).toFixed(1)}%`
		);
	}

	if (edgeDiff > tolerance) {
		warnings.push(
			`Edge count ${edgeCount} differs from expected ${meta.expectedEdges} by ${(edgeDiff * 100).toFixed(1)}%`
		);
	}

	// Content size validation (skip if expected size is 0)
	if (meta.expectedContentSize > 0) {
		const sizeDiff = Math.abs(contentSize - meta.expectedContentSize) / meta.expectedContentSize;
		if (sizeDiff > tolerance) {
			warnings.push(
				`Content size ${contentSize} differs from expected ${meta.expectedContentSize} by ${(sizeDiff * 100).toFixed(1)}%`
			);
		}
	}

	return {
		valid: warnings.length === 0,
		warnings,
	};
};
