/**
 * Evaluation Metrics
 *
 * Metrics for comparing expansion strategies and path quality.
 */

// Path diversity metrics
export {
	computeHubCoverage,
	computePathDiversityMetrics,
	identifyHubNodes,
	jaccardDistance,
	meanPairwiseEdgeJaccardDistance,
	meanPairwiseJaccardDistance,
	type PathDiversityMetrics,
	pathToNodeSet,
} from "./path-diversity";

// Degree distribution metrics
export {
	compareDegreeDistributions,
	computeDegreeDistribution,
	computeDegreeHistogram,
	degreeDistributionFromMap,
	type DegreeDistributionMetrics,
	earthMoversDistance,
	jsDivergence,
	klDivergence,
} from "./degree-distribution";

// Structural representativeness metrics
export {
	aggregateRepresentativenessResults,
	computeCommunityCoverage,
	computeSetOverlap,
	computeStructuralRepresentativeness,
	degreeToRanking,
	spearmanRankCorrelation,
	type StructuralRepresentativenessResult,
} from "./structural-representativeness";

// Salience coverage metrics
export {
	computeSalienceCoverage,
	computeSalienceCoverageFromStringPaths,
	computeSalienceGroundTruth,
	pathSignature,
	type SalienceCoverageConfig,
	type SalienceCoverageResult,
} from "./salience-coverage";
