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
	DATASETS_BY_ID,
	DBLP,
	FACEBOOK,
	// Utilities
	getBenchmarkSummary,
	KARATE,
	LESMIS,
	loadAllBenchmarks,
	// Loaders
	loadBenchmark,
	loadBenchmarkById,
	type LoadedBenchmark,
	resolveBenchmarkPath,
	validateBenchmark,
} from "./benchmark-datasets";
