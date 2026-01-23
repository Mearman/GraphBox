/**
 * Ranking SUT Registration
 *
 * Registers path ranking SUTs (Path Salience and baselines) with the global registry.
 *
 * Domain-specific types:
 * - RankingInputs: Algorithm-specific inputs (expander + source + target)
 */

import { SUTRegistry } from "ppef/registry";
import type { SUT, SutRegistration } from "ppef/types/sut";

import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { type PathSalienceConfig, type PathSalienceResult,PathSalienceSUT } from "../experiments/suts/path-salience-sut.js";
import { type RandomRankingConfig, type RandomRankingResult,RandomRankingSUT } from "../experiments/suts/random-ranking-sut.js";
import { type ShortestRankingConfig, type ShortestRankingResult,ShortestRankingSUT } from "../experiments/suts/shortest-ranking-sut.js";

/**
 * Domain-specific input type for ranking algorithms.
 *
 * This type lives in the domain-specific registration file, not in the core framework.
 * The core framework remains universal - it doesn't need to know what "source" or "target" mean.
 *
 * Note: 'input' is the field name used by the executor when spreading { input, ...inputs }
 */
export interface RankingInputs {
	/** Graph expander for path discovery (named 'input' to match executor pattern) */
	input: BenchmarkGraphExpander;

	/** Source node ID */
	source: string;

	/** Target node ID */
	target: string;
}

/**
 * Union type for all ranking SUT results.
 * Each SUT returns its own specific result type.
 */
export type RankingResult = PathSalienceResult | RandomRankingResult | ShortestRankingResult;

/**
 * Common fields shared by all ranking results.
 * Use this type guard to safely access common properties.
 */
export interface RankingResultBase {
	pathsFound: number;
	meanMI: number;
	stdMI: number;
	pathDiversity: number;
	hubAvoidance: number;
	nodeCoverage: number;
	meanScore: number;
	stdScore: number;
}

/**
 * Type guard to check if a result is a ranking result.
 * @param result
 */
export const isRankingResult = (result: unknown): result is RankingResult => {
	const r = result as RankingResultBase;
	return (
		typeof r === "object" &&
		r !== null &&
		typeof r.pathsFound === "number" &&
		typeof r.meanMI === "number" &&
		typeof r.stdMI === "number" &&
		typeof r.pathDiversity === "number" &&
		typeof r.hubAvoidance === "number" &&
		typeof r.nodeCoverage === "number" &&
		typeof r.meanScore === "number" &&
		typeof r.stdScore === "number" &&
		Array.isArray((result as Record<string, unknown>).paths)
	);
};

/**
 * Type guard for PathSalienceResult.
 * @param result
 */
export const isPathSalienceResult = (result: RankingResult): result is PathSalienceResult => {
	const r = result as Partial<PathSalienceResult>;
	// Check for paths with mi field (PathSalienceResult and RandomRankingResult have this)
	return Array.isArray(r.paths) && r.paths.length > 0 && "mi" in r.paths[0];
};

/**
 * Type guard for ShortestRankingResult.
 * @param result
 */
export const isShortestRankingResult = (result: RankingResult): result is ShortestRankingResult => {
	const r = result as Partial<ShortestRankingResult>;
	// Check for paths with length field but no mi field (ShortestRankingResult specific)
	return Array.isArray(r.paths) && r.paths.length > 0 && "length" in r.paths[0] && !("mi" in r.paths[0]);
};

/**
 * Create a typed SUT registry for ranking algorithms.
 *
 * The registry is parameterized with:
 * - TInputs = RankingInputs (domain-specific type)
 * - TResult = RankingResult (union of all algorithm outputs)
 */
export type RankingSutRegistry = SUTRegistry<RankingInputs, RankingResult>;

/**
 * SUT registrations for ranking algorithms.
 */
export const RANKING_SUT_REGISTRATIONS: Record<string, SutRegistration> = {
	"path-salience-v1.0.0": {
		id: "path-salience-v1.0.0",
		name: "Path Salience Ranking",
		version: "1.0.0",
		role: "primary",
		config: {} satisfies PathSalienceConfig,
		tags: ["ranking", "information-theoretic", "mutual-information"],
		description: "Information-theoretic path ranking using mutual information",
	},
	"random-ranking-v1.0.0": {
		id: "random-ranking-v1.0.0",
		name: "Random Path Ranking",
		version: "1.0.0",
		role: "baseline",
		config: {} satisfies RandomRankingConfig,
		tags: ["ranking", "baseline", "null-hypothesis"],
		description: "Random path ranking (statistical null hypothesis)",
	},
	"shortest-ranking-v1.0.0": {
		id: "shortest-ranking-v1.0.0",
		name: "Shortest Path Ranking",
		version: "1.0.0",
		role: "baseline",
		config: {} satisfies ShortestRankingConfig,
		tags: ["ranking", "baseline", "conventional"],
		description: "Shortest-path-first ranking (conventional baseline)",
	},
};

/**
 * SUT wrapper for Path Salience Ranking.
 *
 * Returns PathSalienceResult directly.
 */
class PathSalienceSUTWrapper implements SUT<RankingInputs, PathSalienceResult> {
	readonly id = "path-salience-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: RankingInputs): Promise<PathSalienceResult> {
		const { input: expander, source, target } = inputs;
		const inputsArray = [source, target] as const;

		const sut = new PathSalienceSUT(expander, inputsArray, this.config as PathSalienceConfig);
		const result = await sut.run();

		if (!result.ok) {
			throw result.error;
		}
		return result.value;
	}
}

/**
 * SUT wrapper for Random Ranking.
 *
 * Returns RandomRankingResult directly.
 */
class RandomRankingSUTWrapper implements SUT<RankingInputs, RandomRankingResult> {
	readonly id = "random-ranking-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: RankingInputs): Promise<RandomRankingResult> {
		const { input: expander, source, target } = inputs;
		const inputsArray = [source, target] as const;

		const sut = new RandomRankingSUT(expander, inputsArray, this.config as RandomRankingConfig);
		const result = await sut.run();

		if (!result.ok) {
			throw result.error;
		}
		return result.value;
	}
}

/**
 * SUT wrapper for Shortest Path Ranking.
 *
 * Returns ShortestRankingResult directly.
 */
class ShortestRankingSUTWrapper implements SUT<RankingInputs, ShortestRankingResult> {
	readonly id = "shortest-ranking-v1.0.0";
	readonly config: Readonly<Record<string, unknown>>;

	constructor(config?: Record<string, unknown>) {
		this.config = { ...config };
	}

	async run(inputs: RankingInputs): Promise<ShortestRankingResult> {
		const { input: expander, source, target } = inputs;
		const inputsArray = [source, target] as const;

		const sut = new ShortestRankingSUT(expander, inputsArray, this.config as ShortestRankingConfig);
		const result = await sut.run();

		if (!result.ok) {
			throw result.error;
		}
		return result.value;
	}
}

/**
 * Register all ranking SUTs with a registry.
 *
 * Each SUT is registered with its specific result type.
 * The registry's TResult parameter is the union type RankingResult.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerRankingSuts = (
	registry: SUTRegistry<RankingInputs, RankingResult> = new SUTRegistry<RankingInputs, RankingResult>()
): SUTRegistry<RankingInputs, RankingResult> => {
	// Path Salience (Primary) - returns PathSalienceResult
	registry.register(
		RANKING_SUT_REGISTRATIONS["path-salience-v1.0.0"],
		(config?: Record<string, unknown>) => new PathSalienceSUTWrapper(config)
	);

	// Random Ranking (Baseline - Null Hypothesis) - returns RandomRankingResult
	registry.register(
		RANKING_SUT_REGISTRATIONS["random-ranking-v1.0.0"],
		(config?: Record<string, unknown>) => new RandomRankingSUTWrapper(config)
	);

	// Shortest Path Ranking (Baseline - Conventional) - returns ShortestRankingResult
	registry.register(
		RANKING_SUT_REGISTRATIONS["shortest-ranking-v1.0.0"],
		(config?: Record<string, unknown>) => new ShortestRankingSUTWrapper(config)
	);

	return registry;
};

/**
 * Global ranking SUT registry with all algorithms registered.
 */
export const rankingSutRegistry = registerRankingSuts(new SUTRegistry<RankingInputs, RankingResult>());
