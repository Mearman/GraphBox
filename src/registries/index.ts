/**
 * GraphBox Registries
 *
 * Centralized exports for all GraphBox-specific case and SUT registrations.
 * This module provides a single entry point for accessing benchmark cases,
 * SUT registrations, and their respective registries.
 */

// Expansion algorithm exports
export { BENCHMARK_CASES } from "./register-cases.js";
export { SUT_REGISTRATIONS } from "./register-suts.js";

// Ranking algorithm exports
export { RANKING_CASES } from "./register-ranking-cases.js";
export { RANKING_SUT_REGISTRATIONS } from "./register-ranking-suts.js";

// Re-export types from expansion registrations (from register-suts.ts)
export type {
	ExpansionInputs,
	ExpansionResult,
	ExpansionSutRegistry,
} from "./register-suts.js";

// Re-export types from expansion registrations (from register-cases.ts)
export type {
	GraphCaseRegistry,
	SeedVariant,
	SyntheticGraphType,
} from "./register-cases.js";

// Re-export types from ranking registrations
export type {
	RankingInputs,
	RankingResult,
	RankingResultBase,
	RankingSutRegistry,
} from "./register-ranking-suts.js";

// Re-export type guards
export { isPathSalienceResult, isRankingResult, isShortestRankingResult } from "./register-ranking-suts.js";
