/**
 * Graphbox - Complete Graph Theory Library
 *
 * Comprehensive graph algorithms, data structures, and analysis tools for
 * academic research and production use.
 *
 * ## Core Features
 *
 * **Data Structures**:
 * - Graph class with generic Node/Edge types
 * - ReadableGraph interface for custom implementations
 * - Option/Result monads for error handling
 *
 * **Traversal**: BFS, DFS, bidirectional BFS
 * **Pathfinding**: Dijkstra, mutual information, path ranking
 * **Analysis**: Connected components, SCC, topological sort, cycle detection
 * **Clustering**: Louvain, Leiden, Infomap, label propagation
 * **Decomposition**: Biconnected components, k-core, core-periphery
 * **Extraction**: Ego networks, motifs, trusses, subgraphs
 * **Metrics**: Modularity, conductance, cluster quality
 * **Generation**: Type-safe graph specifications with validation
 *
 * ## Usage
 *
 * ```typescript
 * import { Graph, bfs, dfs, dijkstra, type Node, type ReadableGraph } from 'graphbox';
 *
 * // Create a graph
 * const graph = new Graph();
 * const node1 = graph.addNode({ id: '1' });
 * const node2 = graph.addNode({ id: '2' });
 * graph.addEdge(node1, node2, { type: 'connected' });
 *
 * // Or implement ReadableGraph interface for custom graphs
 * class MyGraph implements ReadableGraph {
 *   // ... implementation
 * }
 *
 * // BFS traversal
 * const bfsResult = bfs(graph, '1');
 *
 * // Dijkstra shortest path
 * const shortestPath = dijkstra(graph, '1', '2');
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

export type { Edge, LayoutEdge,LayoutNode, Node } from "./algorithms/types/graph";
export type { EdgeBase, NodeBase, ReadableGraph } from "./interfaces/readable-graph";

// ============================================================================
// Graph Generation and Specification
// ============================================================================

export * from "./analyzer";
export * from "./generation/constraints";
export * from "./generation/generator";
export * from "./generation/spec";
export * from "./validation/index";

// ============================================================================
// Graph Expansion and Traversal
// ============================================================================

// Traversal algorithms
export type { TraversalResult } from "./algorithms/traversal/bfs";
export { bfs } from "./algorithms/traversal/bfs";
export type {
	BidirectionalBFSOptions,
	BidirectionalBFSResult,
} from "./algorithms/traversal/bidirectional-bfs";
export { BidirectionalBFS } from "./algorithms/traversal/bidirectional-bfs";
export type {
	DegreePrioritisedExpansionResult,
	ExpansionStats,
} from "./algorithms/traversal/degree-prioritised-expansion";
export { DegreePrioritisedExpansion } from "./algorithms/traversal/degree-prioritised-expansion";
export type { DFSTraversalResult } from "./algorithms/traversal/dfs";
export { dfs } from "./algorithms/traversal/dfs";
export type { IntelligentDelayedTerminationConfig } from "./algorithms/traversal/intelligent-delayed-termination";
export { IntelligentDelayedTermination } from "./algorithms/traversal/intelligent-delayed-termination";
export { PriorityQueue } from "./algorithms/traversal/priority-queue";

// Extraction algorithms
export type {
	EgoNetworkOptions,
	ExtractionError,
	InducedSubgraph,
} from "./algorithms/extraction/ego-network";
export {
	extractEgoNetwork,
	extractMultiSourceEgoNetwork,
} from "./algorithms/extraction/ego-network";

// Baselines for expansion comparison experiments
export type {
	BfsExpansionStats,
	FrontierBalancedResult,
	FrontierBalancedStats,
	RandomPriorityResult,
	RandomPriorityStats,
	StandardBfsResult,
} from "./experiments/baselines/index";
export {
	FrontierBalancedExpansion,
	RandomPriorityExpansion,
	StandardBfsExpansion,
} from "./experiments/baselines/index";

// ============================================================================
// Graph Algorithms (from @bibgraph/algorithms)
// ============================================================================

// Core analysis algorithms
export * from "./algorithms/analysis/connected-components";
export * from "./algorithms/analysis/cycle-detection";
export * from "./algorithms/analysis/scc";
export * from "./algorithms/analysis/topological-sort";

// Clustering algorithms
export * from "./algorithms/clustering/infomap";
export * from "./algorithms/clustering/label-propagation";
export * from "./algorithms/clustering/leiden";
export * from "./algorithms/clustering/louvain";

// Decomposition algorithms
export * from "./algorithms/decomposition/biconnected";
export * from "./algorithms/decomposition/core-periphery";
export * from "./algorithms/decomposition/k-core";

// Extraction algorithms
export * from "./algorithms/extraction/filter";
export * from "./algorithms/extraction/motif";
export * from "./algorithms/extraction/subgraph";
export * from "./algorithms/extraction/truss";

// Graph data structure
export * from "./algorithms/graph/graph";
export { GraphAdapter } from "./algorithms/graph/graph-adapter";

// Hierarchical algorithms
export * from "./algorithms/hierarchical/clustering";

// Layout algorithms
export * from "./algorithms/layout/hierarchical-layout";

// Partitioning algorithms
export * from "./algorithms/partitioning/spectral";

// Pathfinding algorithms
export * from "./algorithms/pathfinding/dijkstra";
export * from "./algorithms/pathfinding/mutual-information";
export * from "./algorithms/pathfinding/path-ranking";
export * from "./algorithms/pathfinding/priority-queue";

// Metrics
export * from "./algorithms/metrics/cluster-quality";
export * from "./algorithms/metrics/conductance";
export * from "./algorithms/metrics/modularity";

// Types
export * from "./algorithms/types/algorithm-results";
export * from "./algorithms/types/errors";
export * from "./algorithms/types/graph";
export * from "./algorithms/types/option";
export * from "./algorithms/types/result";
export * from "./algorithms/types/weight-function";
// Export clustering types (excluding Density which conflicts with spec/core.ts)
export type {
	AlteredCommunitiesState,
	BiconnectedComponent,
	BiconnectedResult,
	ClusterId,
	ClusteringError,
	ClusterMetrics,
	Community,
	CommunityHashTable,
	CommunityId,
	ComponentId,
	CompressionRatio,
	Conductance,
	Core,
	CorenessScore,
	CorePeripheryResult,
	CorePeripheryStructure,
	DecompositionError,
	Dendrogram,
	DescriptionLength,
	HierarchicalError,
	HierarchicalResult,
	InfomapModule,
	InfomapResult,
	KCoreResult,
	LabelCluster,
	LabelPropagationResult,
	LeidenCommunity,
	LeidenResult,
	LouvainConfiguration,
	MergeStep,
	Modularity,
	ModuleId,
	Partition,
	PartitionId,
	PartitioningError,
	SpectralPartitionResult,
} from "./algorithms/types/clustering-types";

// ============================================================================
// Evaluation Framework (MI Experiments and Benchmarking)
// ============================================================================

// Export types
export type {
	EvaluationResult,
	ExperimentReport,
	MethodComparison,
	MetricResults,
	PropertyValidationResult,
	StatisticalTestResult,
} from "./experiments/evaluation/types";

// Rank correlation metrics
export {
	kendallTau,
	spearmanCorrelation,
} from "./experiments/evaluation/rank-correlation";

// IR metrics
export {
	meanAveragePrecision,
	meanReciprocalRank,
	ndcg,
	precisionAtK,
	recallAtK,
} from "./experiments/evaluation/ir-metrics";

// Baseline rankers
export {
	degreeBasedRanker,
	pageRankRanker,
	randomRanker,
	shortestPathRanker,
	weightBasedRanker,
} from "./experiments/evaluation/baselines";

// Path planting infrastructure
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
	plantHeterogeneousPaths,
} from "./experiments/evaluation/path-planting";

// Statistical significance testing
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
} from "./experiments/evaluation/statistics";

// Experiment runner
export type {
	ExperimentConfig,
	FullExperimentConfig,
	GraphSpec,
	MethodConfig,
	MetricType,
	PathRanker,
	StatisticalTestType,
} from "./experiments/evaluation/runner";
export {
	generateHTMLReport,
	generateJSONSummary,
	generateLatexTable,
	generateMarkdownReport,
	runCrossValidation,
	runExperiment,
} from "./experiments/evaluation/runner";

// Graph loaders
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
} from "./experiments/evaluation/loaders";

// Ground truth computation
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
} from "./experiments/evaluation/ground-truth";

// Expansion comparison metrics
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
} from "./experiments/evaluation/metrics";

// Benchmark dataset fixtures
export {
	BENCHMARK_DATASETS,
	// Types
	type BenchmarkDatasetMeta,
	CITESEER,
	// Dataset metadata constants
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
} from "./experiments/evaluation/fixtures";

// ============================================================================
// Format Conversion (GML, etc.)
// ============================================================================

export * from "./formats/index";

// ============================================================================
// Utilities
// ============================================================================

export * from "./utils/wayback";
