/**
 * Metric Type Definitions
 *
 * All metrics collected by experiments must conform to these types.
 * Each metric type corresponds to a LaTeX table in the thesis.
 */

/**
 * Statistical test result (Mann-Whitney U, Cohen's d, etc.)
 */
export interface StatisticalTestMetric {
	comparison: string;
	method1Mean: number;
	method2Mean: number;
	statistic: string;
	u: number;
	pValue: number;
	cohensD: number;
}

/**
 * Hub traversal efficiency metric
 */
export interface HubTraversalMetric {
	dataset: string;
	nodes: number;
	method: string;
	hubTraversal: number;
	paths?: number;
}

/**
 * Path length distribution metric
 */
export interface PathLengthMetric {
	dataset: string;
	method: string;
	min: number;
	max: number;
	mean: number;
	median: number;
}

/**
 * Runtime performance metric
 */
export interface RuntimePerformanceMetric {
	dataset: string;
	nodes: number;
	dpTime: number;
	bfsTime: number;
	dpNodesPerSec?: number;
	bfsNodesPerSec?: number;
}

/**
 * Scalability metric across graph sizes
 */
export interface ScalabilityMetric {
	dataset: string;
	nodes: number;
	dpTime: number;
	bfsTime: number;
	ratio: number;
}

/**
 * Cross-dataset path diversity comparison
 */
export interface CrossDatasetMetric {
	dataset: string;
	nodes: number;
	dpDiversity: number;
	bfsDiversity: number;
	improvement: number;
}

/**
 * Method ranking by path diversity
 */
export interface MethodRankingMetric {
	method: string;
	diversity: number;
	paths: number;
}

/**
 * Perturbation consistency metric
 */
export interface PerturbationMetric {
	perturbation: string;
	dpDiversity: number;
	bfsDiversity: number;
	winner: string;
}

/**
 * Structural representativeness metric (ego network)
 */
export interface StructuralRepresentativenessMetric {
	coverage: number;
	precision: number;
	f1Score: number;
	intersectionSize: number;
	totalNodes: number;
}

/**
 * Structural representativeness metrics (hub coverage)
 */
export interface StructuralRepresentativenessMetricsMetric {
	totalSampled: number;
	hubCoverage: number;
	bucketsCovered: number;
	totalBuckets: number;
}

/**
 * N-seed generalization metric
 */
export interface NSeedGeneralizationMetric {
	n: number;
	variant: string;
	nodes: number;
	paths: number;
}

/**
 * N-seed comparison across methods
 */
export interface NSeedComparisonMetric {
	method: string;
	n: number;
	nodes: number;
	paths: number;
	iterations: number;
	coverage: number;
}

/**
 * N-seed hub traversal comparison
 */
export interface NSeedHubTraversalMetric {
	graph: string;
	method: string;
	paths: number;
	hubTraversal: number;
}

/**
 * N-seed path diversity comparison
 */
export interface NSeedPathDiversityMetric {
	graph: string;
	method: string;
	paths: number;
	uniqueNodes: number;
	diversity: number;
}

/**
 * Algorithm comparison metric
 */
export interface AlgorithmComparisonMetric {
	graph: string;
	n: number;
	method: string;
	nodes: number;
	paths: number;
	diversity: number;
}

/**
 * Hub traversal comparison metric
 */
export interface HubTraversalComparisonMetric {
	graph: string;
	method: string;
	hubTraversal: number;
}

/**
 * MI ranking quality metric (Path Salience Ranking)
 */
export interface MIRankingQualityMetric {
	dataset: string;
	meanMI: number;
	nodeCoverage: number;
	pathDiversity: number;
	paths: number;
}

/**
 * Ranking benchmarks metric
 */
export interface RankingBenchmarksMetric {
	dataset: string;
	method: string;
	meanMI: number;
	nodeCoverage: number;
	pathDiversity: number;
}

/**
 * Hub mitigation analysis metric
 */
export interface HubMitigationMetric {
	method: string;
	nodes: number;
	paths: number;
	iterations: number;
}

/**
 * Multi-hub expansion efficiency metric
 */
export interface MultiHubEfficiencyMetric {
	method: string;
	nodesExpanded: number;
	hubsExpanded: number;
	hubRatio: number;
	pathsFound: number;
}

/**
 * Hub-avoidance metrics for evaluating degree-prioritised expansion.
 *
 * Measures how effectively an algorithm avoids expanding through high-degree
 * hub nodes during traversal. Complements path diversity by directly measuring
 * the design goal of hub avoidance.
 */
export interface HubAvoidanceMetric {
	/** Dataset identifier */
	dataset: string;

	/** Algorithm method name */
	method: string;

	/** Number of seeds (N) */
	n: number;

	/** Proportion of expanded nodes that are hubs (0-1, lower is better) */
	hubTraversalRate: number;

	/** Ratio of peripheral nodes expanded to hub nodes expanded (higher is better) */
	peripheralCoverageRatio: number;

	/** Total nodes expanded */
	totalExpanded: number;

	/** Number of hub nodes expanded (degree >= threshold) */
	hubCount: number;

	/** Number of peripheral nodes expanded (degree <= threshold) */
	peripheralCount: number;

	/** Optional: degree distribution as JSON string */
	degreeDistribution?: string;
}

/**
 * Salience coverage comparison metric
 *
 * Measures how well expansion algorithms discover high-salience paths
 * (as ranked by Path Salience algorithm using mutual information).
 */
export interface SalienceCoverageComparisonMetric {
	/** Dataset identifier */
	dataset: string;

	/** Algorithm method name */
	method: string;

	/** Number of seeds (N) */
	n: number;

	/** Salience coverage: fraction of top-K paths found (0-1) */
	salienceCoverage: number;

	/** Salience precision: of discovered paths, fraction that are in top-K (0-1) */
	saliencePrecision: number;

	/** Number of top-K salient paths found */
	topKFound: number;

	/** Total number of top-K salient paths (ground truth) */
	topKTotal: number;

	/** Total paths discovered by the algorithm */
	pathsDiscovered: number;

	/** Total nodes expanded during traversal */
	nodesExpanded: number;

	/** Number of expansion iterations */
	iterations: number;

	/** Runtime in milliseconds */
	runtimeMs: number;
}

/**
 * Budget-constrained salience coverage metric.
 * Records coverage achieved under a node expansion budget.
 */
export interface SalienceCoverageBudgetMetric {
	dataset: string;
	method: string;
	budgetFraction: number;
	budgetNodes: number;
	salienceCoverage: number;
	topKFound: number;
	topKTotal: number;
	pathsDiscovered: number;
	nodesUsed: number;
	degreeDistributionJSD: number;
}

// ---------------------------------------------------------------------------
// OCS (Operational Correctness / Significance) scenario metrics
// ---------------------------------------------------------------------------

/**
 * Classification correctness metric (per-class precision/recall/F1)
 */
export interface ClassificationCorrectnessMetric {
	graphClass: string;
	precision: number;
	recall: number;
	f1: number;
	support: number;
}

/**
 * Classification significance metric (overall accuracy vs baseline)
 */
export interface ClassificationSignificanceMetric {
	application: string;
	baselineAccuracy: number;
	classifierAccuracy: number;
}

/**
 * Generation correctness metric (per-class acceptance rate)
 */
export interface GenerationCorrectnessMetric {
	graphClass: string;
	accepted: number;
	total: number;
	acceptanceRate: number;
	meanConfidence: number;
}

/**
 * Generation significance metric (overall rate vs baseline)
 */
export interface GenerationSignificanceMetric {
	metric: string;
	achieved: number;
	randomBaseline: number | null;
}

/**
 * Ranking correctness metric (per-method MI quality)
 */
export interface RankingCorrectnessMetric {
	method: string;
	meanMI: number;
	nodeCoverage: number;
	pathDiversity: number;
	spearmanRho: number;
}

/**
 * Ranking significance metric (pairwise baseline comparisons)
 */
export interface RankingSignificanceMetric {
	baseline: string;
	miImprovement: number;
	wins: string;
	meanMI: number;
}

/**
 * Community detection metric (Louvain, Leiden, Label Propagation)
 */
export interface CommunityDetectionMetric {
	dataset: string;
	method: string;
	communities: number;
	modularity: number;
	iterations: number;
	nodes: number;
}

/**
 * K-core decomposition metric
 */
export interface KCoreDecompositionMetric {
	dataset: string;
	degeneracy: number;
	coreCount: number;
	maxCoreSize: number;
	nodes: number;
	edges: number;
}

/**
 * MI variant comparison metric.
 *
 * Compares different MI formulations (Jaccard, Adamic-Adar, Density-Normalized,
 * IDF-Weighted, Clustering-Penalized) across benchmark datasets.
 */
export interface MIVariantComparisonMetric {
	/** Dataset identifier */
	dataset: string;

	/** MI variant name (e.g., "Jaccard", "Adamic-Adar") */
	variant: string;

	/** Mean MI score across paths */
	meanMI: number;

	/** Standard deviation of MI scores */
	stdMI: number;

	/** Node coverage (fraction of graph nodes in paths) */
	nodeCoverage: number;

	/** Path diversity (Jaccard distance between paths) */
	pathDiversity: number;

	/** Hub avoidance score (1 - mean hub ratio) */
	hubAvoidance: number;

	/** Number of paths found */
	pathsFound: number;
}

/**
 * Baseline comparison metric.
 *
 * Compares MI ranking variants against established baselines from the literature
 * (Betweenness Centrality, PageRank, Degree Sum, Shortest Path, Random).
 */
export interface BaselineComparisonMetric {
	/** Dataset identifier */
	dataset: string;

	/** Method name (e.g., "Jaccard MI", "Betweenness Centrality") */
	method: string;

	/** Method category: "ours" for MI variants, "baseline" for established methods */
	category: "ours" | "baseline";

	/** Mean MI score across paths */
	meanMI: number;

	/** Node coverage (fraction of graph nodes in paths) */
	nodeCoverage: number;

	/** Path diversity (Jaccard distance between paths) */
	pathDiversity: number;

	/** Hub avoidance score (1 - mean hub ratio) */
	hubAvoidance: number;

	/** Number of paths found */
	pathsFound: number;
}

/**
 * Union of all metric types for internal handling
 */
export type Metric =
	| StatisticalTestMetric
	| HubTraversalMetric
	| PathLengthMetric
	| RuntimePerformanceMetric
	| ScalabilityMetric
	| CrossDatasetMetric
	| MethodRankingMetric
	| PerturbationMetric
	| StructuralRepresentativenessMetric
	| StructuralRepresentativenessMetricsMetric
	| NSeedGeneralizationMetric
	| NSeedComparisonMetric
	| NSeedHubTraversalMetric
	| NSeedPathDiversityMetric
	| AlgorithmComparisonMetric
	| HubTraversalComparisonMetric
	| MIRankingQualityMetric
	| RankingBenchmarksMetric
	| HubMitigationMetric
	| MultiHubEfficiencyMetric
	| HubAvoidanceMetric
	| SalienceCoverageComparisonMetric
	| SalienceCoverageBudgetMetric
	| ClassificationCorrectnessMetric
	| ClassificationSignificanceMetric
	| GenerationCorrectnessMetric
	| GenerationSignificanceMetric
	| RankingCorrectnessMetric
	| RankingSignificanceMetric
	| CommunityDetectionMetric
	| KCoreDecompositionMetric
	| MIVariantComparisonMetric
	| BaselineComparisonMetric;

/**
 * Metric category - groups related metrics for table generation
 */
export type MetricCategory =
	| "statistical-significance"
	| "hub-traversal"
	| "hub-avoidance"
	| "path-lengths"
	| "runtime-performance"
	| "scalability"
	| "cross-dataset"
	| "method-ranking"
	| "perturbation"
	| "structural-representativeness"
	| "structural-representativeness-metrics"
	| "n-seed-generalization"
	| "n-seed-comparison"
	| "n-seed-hub-traversal"
	| "n-seed-path-diversity"
	| "algorithm-comparison"
	| "hub-traversal-comparison"
	| "mi-ranking-quality"
	| "ranking-benchmarks"
	| "hub-mitigation"
	| "multi-hub-efficiency"
	| "salience-coverage-comparison"
	| "salience-coverage-budget"
	| "classification-correctness"
	| "classification-significance"
	| "generation-correctness"
	| "generation-significance"
	| "ranking-correctness"
	| "ranking-significance"
	| "community-detection"
	| "k-core-decomposition"
	| "mi-variant-comparison"
	| "ranking-method-comparison";

/**
 * Typed metric record with category
 */
export interface MetricRecord<T = Metric> {
	category: MetricCategory;
	data: T;
	timestamp?: string;
}

/**
 * Complete metrics output structure
 */
export interface MetricsOutput {
	version: string;
	timestamp: string;
	metrics: Partial<Record<MetricCategory, Metric[]>>;
}
