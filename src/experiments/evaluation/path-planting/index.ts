/**
 * Path planting infrastructure for evaluation
 *
 * Creates ground truth paths and noise paths for controlled MI experiments.
 */

export {
	type CitationPathConfig,
	type CitationPathType,
	plantCitationPaths,
} from "./citation-planting";
export {
	filterNodesByType as heterogeneousFilterNodesByType,
	type HeterogeneousPathConfig,
	pathFollowsTemplate,
	plantHeterogeneousPaths,
} from "./heterogeneous-planting";
export {
	addNoisePaths,
} from "./noise-generator";
export {
	type PlantedPathConfig,
	type PlantedPathResult,
	plantGroundTruthPaths,
} from "./path-generator";
