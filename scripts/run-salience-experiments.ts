#!/usr/bin/env tsx
import { runSalienceCoverageExperiments } from "../src/experiments/experiments/salience-coverage-comparison.js";

runSalienceCoverageExperiments().catch((error) => {
	console.error("Experiment failed:", error);
	process.exit(1);
});
