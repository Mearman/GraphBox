/**
 * Generation Evaluation Experiment
 *
 * Runs the full generation evaluation pipeline, measuring how well
 * feature-constrained graph generation produces graphs that are
 * correctly classified by the trained classifier.
 *
 * Metrics:
 * - Per-class acceptance rate and mean confidence
 * - Overall acceptance rate vs 33% random baseline (3 synthetic classes)
 * - Overall acceptance rate assertion (> 0.5)
 */

import { describe, expect, it } from "vitest";

import { runGenerationEvaluation } from "../../../../generation/generation-evaluator.js";

const SYNTHETIC_CLASSES = [
	"erdos-renyi",
	"barabasi-albert",
	"watts-strogatz",
] as const;

describe("Generation Evaluation", { timeout: 60_000 }, () => {
	it("should generate graphs accepted above random baseline", async () => {
		const result = await runGenerationEvaluation({
			graphsPerClass: 15,
			classifierConfig: {
				trainPerClass: 30,
				testPerClass: 10,
				minNodes: 30,
				maxNodes: 80,
				seed: 42,
			},
		});

		const { perClass, overallAcceptanceRate, overallMeanConfidence } =
			result;

		// === Generation Correctness ===
		console.log("\n=== Generation Correctness ===");
		console.log(
			"class\ttotal\taccepted\tacceptance_rate\tmean_confidence\tmean_attempts",
		);

		for (const cls of SYNTHETIC_CLASSES) {
			const pc = perClass[cls];
			console.log(
				`${cls}\t${pc.total}\t${pc.accepted}\t${pc.acceptanceRate.toFixed(3)}\t${pc.meanConfidence.toFixed(3)}\t${pc.meanAttempts.toFixed(1)}`,
			);
		}

		console.log(
			`\noverall_acceptance_rate\t${overallAcceptanceRate.toFixed(3)}`,
		);
		console.log(
			`overall_mean_confidence\t${overallMeanConfidence.toFixed(3)}`,
		);

		// Classification metrics from generated graphs
		const cm = result.classificationMetrics;
		console.log(`generation_accuracy\t${cm.accuracy.toFixed(3)}`);
		console.log(`generation_macro_f1\t${cm.macroF1.toFixed(3)}`);

		// === Generation Significance ===
		// Random baseline: 1/3 chance of generating correct class (3 synthetic classes)
		const randomBaseline = 1 / SYNTHETIC_CLASSES.length;
		const improvement = overallAcceptanceRate - randomBaseline;
		const relativeImprovement =
			randomBaseline > 0 ? improvement / randomBaseline : 0;

		console.log("\n=== Generation Significance ===");
		console.log(`random_baseline\t${randomBaseline.toFixed(3)}`);
		console.log(
			`overall_acceptance_rate\t${overallAcceptanceRate.toFixed(3)}`,
		);
		console.log(`absolute_improvement\t${improvement.toFixed(3)}`);
		console.log(
			`relative_improvement\t${relativeImprovement.toFixed(3)}`,
		);
		console.log(
			`above_random\t${overallAcceptanceRate > randomBaseline ? "YES" : "NO"}`,
		);

		// Per-class significance
		console.log("\nclass\tacceptance_rate\tvs_random");
		for (const cls of SYNTHETIC_CLASSES) {
			const pc = perClass[cls];
			const classImprovement = pc.acceptanceRate - randomBaseline;
			console.log(
				`${cls}\t${pc.acceptanceRate.toFixed(3)}\t${classImprovement > 0 ? "+" : ""}${classImprovement.toFixed(3)}`,
			);
		}

		// Assertions
		expect(overallAcceptanceRate).toBeGreaterThan(0.5);
		expect(overallAcceptanceRate).toBeGreaterThan(randomBaseline);
	});
});
