/**
 * Generation Evaluation Pipeline
 *
 * Evaluates feature-constrained graph generation by:
 * 1. Training a classifier on standard graph classes
 * 2. Generating graphs for each target class using constrained generation
 * 3. Measuring how many generated graphs are correctly classified
 * 4. Computing acceptance rate, mean confidence, and per-class metrics
 */

import {
	type ClassificationEvaluationConfig,
	runClassificationEvaluation,
} from "../classification/classification-evaluator.js";
import {
	type ClassificationMetrics,
	evaluateClassifier,
	type GraphClass,
} from "../classification/graph-classifier.js";
import {
	type ConstrainedGeneratorConfig,
	generateConstrainedBatch,
	type GeneratedGraph,
} from "./constrained-generator.js";

/**
 * Configuration for the generation evaluation.
 */
export interface GenerationEvaluationConfig {
	/** Number of graphs to generate per class (default: 20) */
	graphsPerClass?: number;
	/** Constrained generator configuration */
	generatorConfig?: ConstrainedGeneratorConfig;
	/** Classification training configuration */
	classifierConfig?: ClassificationEvaluationConfig;
}

/**
 * Per-class generation metrics.
 */
export interface PerClassGenerationMetrics {
	/** Number of graphs generated */
	total: number;
	/** Number correctly classified as target */
	accepted: number;
	/** Acceptance rate (accepted / total) */
	acceptanceRate: number;
	/** Mean classification confidence across all generated graphs */
	meanConfidence: number;
	/** Mean attempts needed for accepted graphs */
	meanAttempts: number;
}

/**
 * Full generation evaluation result.
 */
export interface GenerationEvaluationResult {
	/** Per-class generation metrics */
	perClass: Record<Exclude<GraphClass, "real-world">, PerClassGenerationMetrics>;
	/** Overall acceptance rate across all classes */
	overallAcceptanceRate: number;
	/** Overall mean confidence */
	overallMeanConfidence: number;
	/** Classification metrics from generated graphs (treated as test set) */
	classificationMetrics: ClassificationMetrics;
	/** All generated graphs for inspection */
	generatedGraphs: GeneratedGraph[];
}

const SYNTHETIC_CLASSES: ReadonlyArray<Exclude<GraphClass, "real-world">> = [
	"erdos-renyi",
	"barabasi-albert",
	"watts-strogatz",
] as const;

/**
 * Run the full generation evaluation pipeline.
 *
 * 1. Trains a classifier via the classification evaluation pipeline.
 * 2. Generates constrained graphs for each synthetic class.
 * 3. Computes acceptance rates, confidence, and classification metrics.
 *
 * @param config - Optional evaluation configuration
 * @returns Generation evaluation results with per-class and overall metrics
 */
export const runGenerationEvaluation = async (
	config?: GenerationEvaluationConfig,
): Promise<GenerationEvaluationResult> => {
	const graphsPerClass = config?.graphsPerClass ?? 20;

	// --- 1. Train classifier ---
	const classificationResult = await runClassificationEvaluation(
		config?.classifierConfig,
	);
	const classifier = classificationResult.classifier;

	// --- 2. Generate constrained graphs ---
	const allGenerated: GeneratedGraph[] = [];
	const perClass = {} as Record<
		Exclude<GraphClass, "real-world">,
		PerClassGenerationMetrics
	>;

	for (const cls of SYNTHETIC_CLASSES) {
		const batch = generateConstrainedBatch(
			cls,
			graphsPerClass,
			classifier,
			config?.generatorConfig,
		);
		allGenerated.push(...batch);

		const accepted = batch.filter((g) => g.matchesTarget);
		const totalConfidence = batch.reduce((s, g) => s + g.confidence, 0);
		const totalAttempts = accepted.reduce((s, g) => s + g.attempts, 0);

		perClass[cls] = {
			total: batch.length,
			accepted: accepted.length,
			acceptanceRate: batch.length > 0 ? accepted.length / batch.length : 0,
			meanConfidence: batch.length > 0 ? totalConfidence / batch.length : 0,
			meanAttempts: accepted.length > 0 ? totalAttempts / accepted.length : 0,
		};
	}

	// --- 3. Compute classification metrics on generated graphs ---
	const predictions = allGenerated.map((g) => ({
		predicted: g.classifiedAs,
		actual: g.targetClass as GraphClass,
	}));
	const classificationMetrics = evaluateClassifier(predictions);

	// --- 4. Compute overall metrics ---
	const totalGraphs = allGenerated.length;
	const totalAccepted = allGenerated.filter((g) => g.matchesTarget).length;
	const overallAcceptanceRate =
		totalGraphs > 0 ? totalAccepted / totalGraphs : 0;
	const overallMeanConfidence =
		totalGraphs > 0
			? allGenerated.reduce((s, g) => s + g.confidence, 0) / totalGraphs
			: 0;

	return {
		perClass,
		overallAcceptanceRate,
		overallMeanConfidence,
		classificationMetrics,
		generatedGraphs: allGenerated,
	};
};
