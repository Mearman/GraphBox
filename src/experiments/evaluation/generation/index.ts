/**
 * Feature-Constrained Graph Generation Module
 *
 * Validates that graph generators produce structurally distinguishable graphs
 * by generating candidates, classifying them via the nearest-centroid classifier,
 * and accepting only graphs that match their target class.
 */

export {
	type ConstrainedGeneratorConfig,
	generateConstrainedBatch,
	generateConstrainedGraph,
	type GeneratedGraph,
} from "./constrained-generator.js";
export {
	type GenerationEvaluationConfig,
	type GenerationEvaluationResult,
	type PerClassGenerationMetrics,
	runGenerationEvaluation,
} from "./generation-evaluator.js";
