/**
 * MI Experiment Evaluation Framework
 *
 * Provides metrics, baselines, and infrastructure for evaluating
 * mutual information path ranking methodology.
 */

// Export types
export type {
	EvaluationResult,
	ExperimentReport,
	MethodComparison,
	PropertyValidationResult,
	StatisticalTestResult} from "./types";

// Export rank correlation metrics
export {
	kendallTau,
	spearmanCorrelation} from "./rank-correlation";

// Export IR metrics
export {
	meanAveragePrecision,
	meanReciprocalRank,
	ndcg,
	precisionAtK,
	recallAtK
} from "./ir-metrics";

// Export baseline rankers
export {
	degreeBasedRanker,
	pageRankRanker,
	randomRanker,
	shortestPathRanker,
	weightBasedRanker
} from "./baselines";

// Export path planting infrastructure
export {
	addNoisePaths,
	type CitationPathConfig,
	type CitationPathType,
	type HeterogeneousPathConfig,
	pathFollowsTemplate,
	plantCitationPaths,
	type PlantedPathConfig,
	type PlantedPathResult,
	plantGroundTruthPaths,
	plantHeterogeneousPaths} from "./path-planting";

// Export statistical significance testing
export {
	benjaminiHochberg,
	bonferroniCorrection,
	bootstrapCI,
	bootstrapDifferenceTest,
	cliffsDelta,
	cohensD,
	glassDelta,
	holmBonferroni,
	pairedTTest,
	rankBiserialCorrelation,
	storeyQValues,
	wilcoxonSignedRank,
} from "./statistics";

// Export experiment runner
export type {
	ExperimentConfig,
	FullExperimentConfig,
	GraphSpec,
	MethodConfig,
	MetricType,
	PathRanker,
	StatisticalTestType,
} from "./runner";
export {
	generateHTMLReport,
	generateJSONSummary,
	generateLatexTable,
	generateMarkdownReport,
	runCrossValidation,
	runExperiment,
} from "./runner";

// Export graph loaders
export {
	// Decompression utilities
	decompressGzip,
	type EdgeListConfig,
	fetchAndDecompressGzip,
	fetchWithAutoDecompress,
	isGzipUrl,
	type LoadedEdge,
	loadEdgeList,
	type LoadedNode,
	loadGraph,
	loadGraphFromUrl,
	type LoadResult,
	loadTriples,
	type TripleConfig,
} from "./loaders";

// Export ground truth computation
export {
	type BetweenGraphOptions,
	type BetweenGraphResult,
	computeAllGroundTruths,
	computeEgoNetwork,
	computeGroundTruth,
	createAttributeImportance,
	enumerateBetweenGraph,
	enumerateMultiSeedBetweenGraph,
	type GroundTruthConfig,
	type GroundTruthPath,
	type GroundTruthType,
	type PrecomputedImportance,
	precomputeImportance,
} from "./ground-truth";

// Export expansion comparison metrics
export {
	aggregateRepresentativenessResults,
	compareDegreeDistributions,
	computeCommunityCoverage,
	// Degree distribution
	computeDegreeDistribution,
	computeDegreeHistogram,
	computeHubCoverage,
	computePathDiversityMetrics,
	// Structural representativeness
	computeSetOverlap,
	computeStructuralRepresentativeness,
	degreeDistributionFromMap,
	type DegreeDistributionMetrics,
	degreeToRanking,
	earthMoversDistance,
	identifyHubNodes,
	// Path diversity
	jaccardDistance,
	jsDivergence,
	klDivergence,
	meanPairwiseEdgeJaccardDistance,
	meanPairwiseJaccardDistance,
	type PathDiversityMetrics,
	pathToNodeSet,
	spearmanRankCorrelation,
	type StructuralRepresentativenessResult,
} from "./metrics";

// Export benchmark dataset fixtures
export {
	BENCHMARK_DATASETS,
	// Types
	type BenchmarkDatasetMeta,
	CITESEER,
	// Dataset metadata constants
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
} from "./fixtures";
