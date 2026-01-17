/**
 * Evaluation Fixtures
 *
 * Provides benchmark datasets and test fixtures for evaluation experiments.
 */

export {
	BENCHMARK_DATASETS,
	// Types
	type BenchmarkDatasetMeta,
	CITESEER,
	// Dataset metadata
	CORA,
	// Factory
	createBenchmarkMeta,
	DATASETS_BY_ID,
	DBLP,
	FACEBOOK,
	// Utilities
	getBenchmarkSummary,
	KARATE,
	LESMIS,
	loadAllBenchmarks,
	// Loaders (Node.js - file-based)
	loadBenchmark,
	loadBenchmarkById,
	// Loaders (Universal - URL/content-based)
	loadBenchmarkByIdFromUrl,
	loadBenchmarkFromContent,
	loadBenchmarkFromUrl,
	type LoadedBenchmark,
	resolveBenchmarkPath,
	validateBenchmark,
} from "./benchmark-datasets";
