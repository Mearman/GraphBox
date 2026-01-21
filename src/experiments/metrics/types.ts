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
	| MultiHubEfficiencyMetric;

/**
 * Metric category - groups related metrics for table generation
 */
export type MetricCategory =
	| "statistical-significance"
	| "hub-traversal"
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
	| "multi-hub-efficiency";

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
