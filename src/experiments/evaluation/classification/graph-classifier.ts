/**
 * Nearest-Centroid Graph Classifier
 *
 * Implements a nearest-centroid classifier over structural feature vectors
 * for graph type classification. Training computes the mean feature vector
 * (centroid) per class with z-score normalisation. Classification finds the
 * nearest centroid using Euclidean distance on normalised features.
 */

import {
	FEATURE_NAMES,
	featuresToVector,
	type GraphFeatures,
} from "./feature-extractor.js";

/**
 * Graph structural class labels.
 *
 * - erdos-renyi: Random graphs with uniform edge probability
 * - barabasi-albert: Scale-free graphs from preferential attachment
 * - watts-strogatz: Small-world graphs from ring lattice rewiring
 * - real-world: Empirical benchmark datasets
 */
export type GraphClass =
	| "erdos-renyi"
	| "barabasi-albert"
	| "watts-strogatz"
	| "real-world";

/** All graph class labels for iteration. */
export const ALL_GRAPH_CLASSES: readonly GraphClass[] = [
	"erdos-renyi",
	"barabasi-albert",
	"watts-strogatz",
	"real-world",
] as const;

/**
 * Result of classifying a single graph.
 */
export interface ClassificationResult {
	/** Predicted graph class */
	predictedClass: GraphClass;
	/** Confidence score: 1 - (nearest / sum of all distances). Range [0, 1]. */
	confidence: number;
	/** Euclidean distance to each class centroid */
	distances: Record<GraphClass, number>;
}

/**
 * A trained nearest-centroid classifier.
 *
 * Stores per-class centroids and feature scaling parameters
 * for z-score normalisation.
 */
export interface TrainedClassifier {
	/** Mean feature vector per class (in normalised space) */
	centroids: Record<GraphClass, number[]>;
	/** Ordered feature names matching vector indices */
	featureNames: string[];
	/** Z-score normalisation parameters computed from training data */
	featureScaling: { mean: number[]; std: number[] };
}

/**
 * Train a nearest-centroid classifier.
 *
 * 1. Converts all feature objects to numeric vectors.
 * 2. Computes global mean and standard deviation per feature (z-score).
 * 3. Normalises all vectors.
 * 4. Computes the centroid (mean vector) per class.
 *
 * @param trainingData - Labelled training examples
 * @returns A trained classifier ready for classification
 * @throws Error if training data is empty or any class has zero examples
 */
export const trainClassifier = (
	trainingData: Array<{ features: GraphFeatures; label: GraphClass }>,
): TrainedClassifier => {
	if (trainingData.length === 0) {
		throw new Error("Training data must not be empty");
	}

	const featureNames = [...FEATURE_NAMES] as string[];
	const vectors = trainingData.map((d) => featuresToVector(d.features));
	const dim = featureNames.length;

	// Compute global mean and std per feature
	const mean = new Array<number>(dim).fill(0);
	const std = new Array<number>(dim).fill(0);

	for (const vec of vectors) {
		for (let index = 0; index < dim; index++) {
			mean[index] += vec[index];
		}
	}
	for (let index = 0; index < dim; index++) {
		mean[index] /= vectors.length;
	}

	for (const vec of vectors) {
		for (let index = 0; index < dim; index++) {
			std[index] += (vec[index] - mean[index]) ** 2;
		}
	}
	for (let index = 0; index < dim; index++) {
		std[index] = Math.sqrt(std[index] / vectors.length);
		// Avoid division by zero: features with zero variance get std=1
		if (std[index] === 0) std[index] = 1;
	}

	// Normalise vectors
	const normalised = vectors.map((vec) =>
		vec.map((v, index) => (v - mean[index]) / std[index]),
	);

	// Compute centroids per class
	const centroids = {} as Record<GraphClass, number[]>;
	for (const cls of ALL_GRAPH_CLASSES) {
		const classIndices = trainingData
			.map((d, index) => (d.label === cls ? index : -1))
			.filter((index) => index >= 0);

		if (classIndices.length === 0) {
			// Assign origin as centroid for missing classes
			centroids[cls] = new Array<number>(dim).fill(0);
			continue;
		}

		const centroid = new Array<number>(dim).fill(0);
		for (const index of classIndices) {
			for (let index_ = 0; index_ < dim; index_++) {
				centroid[index_] += normalised[index][index_];
			}
		}
		for (let index = 0; index < dim; index++) {
			centroid[index] /= classIndices.length;
		}
		centroids[cls] = centroid;
	}

	return {
		centroids,
		featureNames,
		featureScaling: { mean, std },
	};
};

/**
 * Classify a graph by finding the nearest centroid.
 *
 * Normalises the input features using the training scaling parameters,
 * then computes Euclidean distance to each class centroid.
 *
 * Confidence is computed as 1 - (nearestDistance / sumOfAllDistances).
 * When all distances are zero, confidence is 1.
 *
 * @param features - Structural features of the graph to classify
 * @param classifier - A previously trained classifier
 * @returns Classification result with predicted class, confidence, and distances
 */
export const classify = (
	features: GraphFeatures,
	classifier: TrainedClassifier,
): ClassificationResult => {
	const { centroids, featureScaling } = classifier;
	const vec = featuresToVector(features);
	const dim = vec.length;

	// Normalise using training statistics
	const normalised = vec.map((v, index) =>
		(v - featureScaling.mean[index]) / featureScaling.std[index],
	);

	// Compute Euclidean distance to each centroid
	const distances = {} as Record<GraphClass, number>;
	let nearestClass: GraphClass = ALL_GRAPH_CLASSES[0];
	let nearestDistribution = Infinity;

	for (const cls of ALL_GRAPH_CLASSES) {
		const centroid = centroids[cls];
		let sumSq = 0;
		for (let index = 0; index < dim; index++) {
			sumSq += (normalised[index] - centroid[index]) ** 2;
		}
		const distribution = Math.sqrt(sumSq);
		distances[cls] = distribution;

		if (distribution < nearestDistribution) {
			nearestDistribution = distribution;
			nearestClass = cls;
		}
	}

	// Confidence: 1 - (nearest / sum)
	const totalDistribution = Object.values(distances).reduce((s, d) => s + d, 0);
	const confidence = totalDistribution > 0 ? 1 - nearestDistribution / totalDistribution : 1;

	return {
		predictedClass: nearestClass,
		confidence,
		distances,
	};
};

/**
 * Per-class precision, recall, F1, and support.
 */
export interface PerClassMetrics {
	precision: number;
	recall: number;
	f1: number;
	support: number;
}

/**
 * Multi-class classification metrics.
 */
export interface ClassificationMetrics {
	/** Overall accuracy (correct / total) */
	accuracy: number;
	/** Per-class precision, recall, F1, and support */
	perClass: Record<GraphClass, PerClassMetrics>;
	/** Macro-averaged F1 (unweighted mean of per-class F1 scores) */
	macroF1: number;
}

/**
 * Evaluate classifier predictions against ground truth labels.
 *
 * Computes accuracy, per-class precision/recall/F1, and macro F1.
 *
 * @param predictions - Array of predicted and actual class labels
 * @returns Multi-class classification metrics
 */
export const evaluateClassifier = (
	predictions: Array<{ predicted: GraphClass; actual: GraphClass }>,
): ClassificationMetrics => {
	if (predictions.length === 0) {
		const emptyPerClass = {} as Record<GraphClass, PerClassMetrics>;
		for (const cls of ALL_GRAPH_CLASSES) {
			emptyPerClass[cls] = { precision: 0, recall: 0, f1: 0, support: 0 };
		}
		return { accuracy: 0, perClass: emptyPerClass, macroF1: 0 };
	}

	// Count correct predictions
	const correct = predictions.filter(
		(p) => p.predicted === p.actual,
	).length;
	const accuracy = correct / predictions.length;

	// Per-class metrics via confusion counts
	const perClass = {} as Record<GraphClass, PerClassMetrics>;
	let f1Sum = 0;
	let classesWithSupport = 0;

	for (const cls of ALL_GRAPH_CLASSES) {
		const tp = predictions.filter(
			(p) => p.predicted === cls && p.actual === cls,
		).length;
		const fp = predictions.filter(
			(p) => p.predicted === cls && p.actual !== cls,
		).length;
		const function_ = predictions.filter(
			(p) => p.predicted !== cls && p.actual === cls,
		).length;
		const support = tp + function_;

		const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
		const recall = support > 0 ? tp / support : 0;
		const f1 =
			precision + recall > 0
				? (2 * precision * recall) / (precision + recall)
				: 0;

		perClass[cls] = { precision, recall, f1, support };

		if (support > 0) {
			f1Sum += f1;
			classesWithSupport++;
		}
	}

	const macroF1 = classesWithSupport > 0 ? f1Sum / classesWithSupport : 0;

	return { accuracy, perClass, macroF1 };
};
