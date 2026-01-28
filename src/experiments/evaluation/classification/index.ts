/**
 * Graph Classification Module
 *
 * Nearest-centroid classifier over structural features for graph type
 * classification. Supports four graph classes: Erdos-Renyi, Barabasi-Albert,
 * Watts-Strogatz, and real-world benchmark datasets.
 */

export {
	type ClassificationEvaluationConfig,
	type ClassificationEvaluationResult,
	runClassificationEvaluation,
} from "./classification-evaluator.js";
export {
	extractFeatures,
	FEATURE_NAMES,
	featuresToVector,
	type GraphFeatures,
} from "./feature-extractor.js";
export {
	ALL_GRAPH_CLASSES,
	type ClassificationMetrics,
	type ClassificationResult,
	classify,
	evaluateClassifier,
	type GraphClass,
	type PerClassMetrics,
	trainClassifier,
	type TrainedClassifier,
} from "./graph-classifier.js";
