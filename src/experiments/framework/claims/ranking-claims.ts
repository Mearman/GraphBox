/**
 * Ranking Claims
 *
 * Claims for Path Salience Ranking evaluation.
 * Tests whether information-theoretic ranking outperforms baseline methods.
 */

import type { EvaluationClaim } from "../types/claims.js";

/**
 * Claims for Path Salience Ranking evaluation.
 */
export const RANKING_CLAIMS: EvaluationClaim[] = [
	{
		claimId: "mi-higher-quality-than-random",
		description: "Path Salience achieves higher mean MI than random ranking",
		sut: "path-salience-v1.0.0",
		baseline: "random-ranking-v1.0.0",
		metric: "meanMI",
		direction: "greater",
		scope: "global",
		tags: ["ranking", "core"],
	},
	{
		claimId: "mi-higher-quality-than-shortest",
		description: "Path Salience achieves higher mean MI than shortest-path ranking",
		sut: "path-salience-v1.0.0",
		baseline: "shortest-ranking-v1.0.0",
		metric: "meanMI",
		direction: "greater",
		scope: "global",
		tags: ["ranking", "core"],
	},
	{
		claimId: "better-node-coverage-than-random",
		description: "Path Salience achieves higher node coverage than random ranking",
		sut: "path-salience-v1.0.0",
		baseline: "random-ranking-v1.0.0",
		metric: "nodeCoverage",
		direction: "greater",
		scope: "global",
		tags: ["ranking"],
	},
	{
		claimId: "better-path-diversity-than-shortest",
		description: "Path Salience achieves higher path diversity than shortest-path ranking",
		sut: "path-salience-v1.0.0",
		baseline: "shortest-ranking-v1.0.0",
		metric: "pathDiversity",
		direction: "greater",
		scope: "global",
		tags: ["ranking"],
	},
];
