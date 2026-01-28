/**
 * Classification Evaluation Experiment
 *
 * Runs the full classification evaluation pipeline across four graph
 * structural classes (Erdos-Renyi, Barabasi-Albert, Watts-Strogatz,
 * Real-World) and outputs structured console metrics for the TAP runner.
 *
 * Metrics:
 * - Per-class precision, recall, F1, and support
 * - Accuracy vs random baseline (25% for 4 classes)
 * - Macro F1 assertion (> 0.5)
 */

import { describe, expect, it } from "vitest";

import { runClassificationEvaluation } from "../../../../classification/classification-evaluator.js";
import { ALL_GRAPH_CLASSES } from "../../../../classification/graph-classifier.js";

describe("Classification Evaluation", { timeout: 60_000 }, () => {
	it("should classify graph structures above random baseline", async () => {
		const result = await runClassificationEvaluation({
			trainPerClass: 30,
			testPerClass: 15,
			minNodes: 30,
			maxNodes: 80,
			seed: 42,
		});

		const { metrics, trainingSize, testSize } = result;

		// === Classification Correctness ===
		console.log("\n=== Classification Correctness ===");
		console.log("class\tprecision\trecall\tf1\tsupport");

		for (const cls of ALL_GRAPH_CLASSES) {
			const pc = metrics.perClass[cls];
			if (pc) {
				console.log(
					`${cls}\t${pc.precision.toFixed(3)}\t${pc.recall.toFixed(3)}\t${pc.f1.toFixed(3)}\t${pc.support}`,
				);
			}
		}

		console.log(`\naccuracy\t${metrics.accuracy.toFixed(3)}`);
		console.log(`macro_f1\t${metrics.macroF1.toFixed(3)}`);
		console.log(`training_size\t${trainingSize}`);
		console.log(`test_size\t${testSize}`);

		// === Classification Significance ===
		const randomBaseline = 1 / ALL_GRAPH_CLASSES.length; // 25% for 4 classes
		const improvement = metrics.accuracy - randomBaseline;
		const relativeImprovement =
			randomBaseline > 0 ? improvement / randomBaseline : 0;

		console.log("\n=== Classification Significance ===");
		console.log(`random_baseline\t${randomBaseline.toFixed(3)}`);
		console.log(`accuracy\t${metrics.accuracy.toFixed(3)}`);
		console.log(`absolute_improvement\t${improvement.toFixed(3)}`);
		console.log(
			`relative_improvement\t${relativeImprovement.toFixed(3)}`,
		);
		console.log(
			`above_random\t${metrics.accuracy > randomBaseline ? "YES" : "NO"}`,
		);

		// Per-class F1 breakdown for significance
		console.log("\nclass\tf1\tvs_random");
		for (const cls of ALL_GRAPH_CLASSES) {
			const pc = metrics.perClass[cls];
			if (pc) {
				const classImprovement = pc.f1 - randomBaseline;
				console.log(
					`${cls}\t${pc.f1.toFixed(3)}\t${classImprovement > 0 ? "+" : ""}${classImprovement.toFixed(3)}`,
				);
			}
		}

		// Assertions
		expect(metrics.macroF1).toBeGreaterThan(0.5);
		expect(metrics.accuracy).toBeGreaterThan(randomBaseline);
	});
});
