/**
 * Evaluate Command
 *
 * Orchestrates the PPEF-compliant three-phase evaluation pipeline:
 * - Execute: Run SUTs against cases via Executor
 * - Aggregate: Compute summaries via aggregateResults
 * - Render: Generate LaTeX tables via LaTeXRenderer
 *
 * Usage:
 *   npx graphbox evaluate --phase=all
 *   npx graphbox evaluate --phase=execute --repetitions=10
 *   npx graphbox evaluate --phase=render --table=runtime-performance
 *   npx graphbox evaluate --tags=core
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";

import { aggregateResults, type AggregationPipelineOptions, createAggregationOutput } from "ppef/aggregation";
// Framework imports
import { CheckpointManager, createExecutor, executeParallel, type ExecutorConfig, FileStorage, getGitCommit, InMemoryLock } from "ppef/executor";
import { CaseRegistry } from "ppef/registry/case-registry";
import { SUTRegistry } from "ppef/registry/sut-registry";
import { createLatexRenderer } from "ppef/renderers/latex-renderer";
import type { AggregatedResult } from "ppef/types/aggregate";
import type { CaseDefinition } from "ppef/types/case";
import type { ClaimEvaluation } from "ppef/types/claims";
import type { EvaluationResult } from "ppef/types/result";
import type { SutDefinition } from "ppef/types/sut";

import type { BidirectionalBFSResult } from "../algorithms/traversal/bidirectional-bfs.js";
import type { OverlapBasedExpansionResult } from "../algorithms/traversal/overlap-based/overlap-result.js";
import type { ParsedArguments } from "../cli-utils/arg-parser";
import { getBoolean, getNumber, getOptional } from "../cli-utils/arg-parser";
import { formatError } from "../cli-utils/error-formatter";
// ClaimsEvaluator API not yet available
// import { ClaimsEvaluator } from "ppef/evaluators";
// import { getClaimsByTag, getCoreClaims, THESIS_CLAIMS } from "../domain/claims.js";
import { TABLE_SPECS } from "../domain/tables.js";
import type { EnsembleExpansionResult } from "../experiments/baselines/ensemble-expansion.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../experiments/evaluation/fixtures/index.js";
// Salience coverage metrics
import {
	computeSalienceCoverageFromStringPaths,
	computeSalienceGroundTruth,
	type SalienceCoverageConfig,
} from "../experiments/evaluation/metrics/index.js";
import {type GraphCaseRegistry, registerCases } from "../registries/register-cases.js";
import { type RankingCaseRegistry,registerRankingCases } from "../registries/register-ranking-cases.js";
import { type RankingInputs, RankingResult, RankingResultBase, RankingSutRegistry,registerRankingSuts } from "../registries/register-ranking-suts.js";
import { type ExpansionInputs, ExpansionResult, ExpansionSutRegistry,registerExpansionSuts } from "../registries/register-suts.js";

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for aggregated results JSON structure.
 */
interface AggregatedResultsJson {
	aggregates: unknown[];
}

const isAggregatedResultsJson = (value: unknown): value is AggregatedResultsJson => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return "aggregates" in v && Array.isArray(v.aggregates);
};

/**
 * Type guard for AggregatedResult.
 * @param value
 */
const isAggregatedResult = (value: unknown): value is AggregatedResult => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return (
		typeof v.sut === "string" &&
		typeof v.metrics === "object" &&
		v.metrics !== null
	);
};

/**
 * Type guard for claim summary JSON structure.
 */
interface ClaimSummaryJson {
	evaluations: unknown[];
}

const isClaimSummaryJson = (value: unknown): value is ClaimSummaryJson => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return "evaluations" in v && Array.isArray(v.evaluations);
};

/**
 * Type guard for ClaimEvaluation.
 * @param value
 */
const isClaimEvaluation = (value: unknown): value is ClaimEvaluation => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return (
		typeof v.claim === "object" &&
		v.claim !== null &&
		"status" in v
	);
};

/**
 * Type guard for checkpoint data.
 */
interface CheckpointData {
	completedRunIds?: string[];
	config?: { totalRuns?: number };
	results?: Record<string, EvaluationResult>;
	createdAt?: string;
	updatedAt?: string;
}

const isCheckpointData = (value: unknown): value is CheckpointData => {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return (
		(v.completedRunIds === undefined || Array.isArray(v.completedRunIds)) &&
		(v.config === undefined || typeof v.config === "object") &&
		(v.results === undefined || typeof v.results === "object") &&
		(v.createdAt === undefined || typeof v.createdAt === "string") &&
		(v.updatedAt === undefined || typeof v.updatedAt === "string")
	);
};

/**
 * Path storage for salience coverage computation.
 *
 * For parallel execution compatibility, paths are written to disk immediately
 * during metric extraction with a unique identifier, then renamed to the
 * correct runId in the onResult callback.
 */
const pathStorage = {
	/** Storage directory for paths */
	pathsDir: null as string | null,
	/** Map of timestamp to pathId for thread-safe lookup */
	pendingPathIds: new Map<number, string>(),

	/**
	 * Initialize with paths directory
	 * @param pathsDir
	 */
	init(pathsDir: string) {
		this.pathsDir = pathsDir;
	},

	/**
	 * Store paths to disk with a unique identifier.
	 * Returns the timestamp that can be used to retrieve the pathId later.
	 * This is safe for parallel execution because each call creates a unique file.
	 * @param paths
	 */
	storePaths(paths: string[][]): number {
		const timestamp = Date.now();

		if (!this.pathsDir) {
			return timestamp;
		}

		// Generate unique identifier: timestamp + random string
		const uniqueId = `${timestamp}-${Math.random().toString(36).slice(2)}`;
		const temporaryFile = path.resolve(this.pathsDir, `tmp-${uniqueId}.json`);

		try {
			writeFileSync(temporaryFile, JSON.stringify(paths), "utf8");
			// Store mapping from timestamp to unique ID
			this.pendingPathIds.set(timestamp, uniqueId);
		} catch {
			// Silently fail
		}

		return timestamp;
	},

	/**
	 * Rename temp paths file to the final runId location.
	 * Called from onResult callback when we know the runId.
	 * @param timestamp
	 * @param runId
	 */
	associateWithRun(timestamp: number, runId: string) {
		const uniqueId = this.pendingPathIds.get(timestamp);
		if (!uniqueId || !this.pathsDir) {
			return;
		}

		const temporaryFile = path.resolve(this.pathsDir, `tmp-${uniqueId}.json`);
		const finalFile = path.resolve(this.pathsDir, `${runId}.json`);

		try {
			if (existsSync(temporaryFile)) {
				renameSync(temporaryFile, finalFile);
			}
		} catch {
			// If rename fails, try copying as fallback
			try {
				const content = readFileSync(temporaryFile, "utf8");
				writeFileSync(finalFile, content, "utf8");
				unlinkSync(temporaryFile);
			} catch {
				// Silently fail - file will be cleaned up later
			}
		}

		// Clean up the pending entry
		this.pendingPathIds.delete(timestamp);
	},

	/**
	 * Load paths from file (for aggregate phase)
	 * @param runId
	 */
	loadPathsFromFile(runId: string): string[][] | null {
		if (this.pathsDir) {
			const pathFile = path.resolve(this.pathsDir, `${runId}.json`);
			if (existsSync(pathFile)) {
				try {
					const content = readFileSync(pathFile, "utf8");
					return JSON.parse(content) as string[][];
				} catch {
					return null;
				}
			}
		}
		return null;
	},
};

/**
 * Phases of the evaluation pipeline.
 */
export type EvaluationPhase = "execute" | "aggregate" | "render" | "progress" | "all";

/**
 * Evaluation command options.
 */
/**
 * Parse run filter string into a set of run indices.
 * Supports:
 *   - "0-40" - range (runs 0-40)
 *   - "0,10,20,30" - specific runs
 *   - "0-20,60-80" - multiple ranges
 * @param filter - Filter string
 * @param totalRuns - Total number of runs
 * @returns Set of run indices to execute
 */
const parseRunFilter = (filter: string, totalRuns: number): Set<number> => {
	const selected = new Set<number>();

	for (const part of filter.split(",")) {
		const trimmed = part.trim();
		if (trimmed.includes("-")) {
			// Range: "0-40"
			const [start, end] = trimmed.split("-").map((s) => Number.parseInt(s, 10));
			if (Number.isNaN(start) || Number.isNaN(end)) {
				throw new TypeError(`Invalid range in run-filter: ${trimmed}`);
			}
			for (let index = start; index <= end; index++) {
				if (index >= 0 && index < totalRuns) {
					selected.add(index);
				}
			}
		} else {
			// Single index: "0" or "42"
			const index = Number.parseInt(trimmed, 10);
			if (Number.isNaN(index)) {
				throw new TypeError(`Invalid run index in run-filter: ${trimmed}`);
			}
			if (index >= 0 && index < totalRuns) {
				selected.add(index);
			}
		}
	}

	return selected;
};

/**
 * Parse parallel workers count from argument.
 * Supports:
 *   - "80%" - percentage of CPU cores (e.g., 80% of 12 = 10 workers)
 *   - "8" or 8 - exact number of workers
 *   - undefined - defaults to 75% of cores (3/4 of available cores)
 * @param arg - Argument value (string or number)
 * @param argument
 * @returns Number of workers
 */
const parseParallelWorkers = (argument: string | number | undefined): number => {
	const totalCores = cpus().length;

	if (argument === undefined) {
		// Default: 75% of cores (3/4), leaving headroom for system
		return Math.max(1, Math.floor((totalCores * 3) / 4));
	}

	// Convert to string if it's a number
	const argumentString = typeof argument === "number" ? argument.toString() : argument;

	// Check for percentage format (e.g., "80%")
	if (argumentString.endsWith("%")) {
		const percentage = Number.parseFloat(argumentString.slice(0, -1));
		if (Number.isNaN(percentage) || percentage <= 0 || percentage > 100) {
			throw new Error(`Invalid worker percentage: ${argumentString}. Must be 1-100%`);
		}
		return Math.max(1, Math.floor((percentage / 100) * totalCores));
	}

	// Exact number
	const count = Number.parseInt(argumentString, 10);
	if (Number.isNaN(count) || count <= 0) {
		throw new Error(`Invalid worker count: ${argumentString}. Must be a positive number`);
	}
	return Math.min(count, totalCores);
};

/**
 * Parse run ID filter from JSON array string.
 * Used by parallel workers to receive their assigned run IDs.
 * @param filter - JSON array string of run IDs
 * @returns Set of run IDs to execute
 */
const parseRunIdFilter = (filter: string): Set<string> => {
	try {
		const runIds = JSON.parse(filter) as string[];
		if (!Array.isArray(runIds)) {
			throw new TypeError("Run filter must be a JSON array");
		}
		return new Set(runIds);
	} catch {
		throw new Error(`Invalid run ID filter format: ${filter}`);
	}
};

/**
 * Evaluation scenarios.
 */
export type EvaluationScenario = "sampling" | "ranking";

/**
 * Evaluation command options.
 */
export interface EvaluateOptions {
	/** Phase(s) to run */
	phase: EvaluationPhase;

	/** Evaluation scenario: sampling (expansion) or ranking */
	scenario: EvaluationScenario;

	/** Output directory for results */
	outputDir: string;

	/** Number of repetitions per case */
	repetitions: number;

	/** Random seed base */
	seedBase: number;

	/** Continue on error */
	continueOnError: boolean;

	/** Timeout per run (ms) */
	timeoutMs: number;

	/** Collect provenance information */
	collectProvenance: boolean;

	/** Checkpoint mode: "file", "git", or "auto" */
	checkpointMode: string;

	/** Number of concurrent runs (1 = sequential) */
	concurrency: number;

	/** Use multi-process parallel execution (spawns child processes) */
	parallel: boolean;

	/** Number of parallel workers (default: CPU count) */
	parallelWorkers?: number;

	/** Filter specific runs (for manual multi-core execution) */
	runFilter?: string;

	/** Sort runs by graph size (smallest first) - default true */
	sortBySize?: boolean;

	/** Filter claims by tag */
	tags?: string[];

	/** Filter cases by tag (e.g., "small", "medium", "large") */
	caseFilter?: string[];

	/** Specific claim ID to evaluate */
	claim?: string;

	/** Specific table ID to render */
	table?: string;

	/** Show verbose output */
	verbose: boolean;
}

/**
 * Parse evaluate command arguments.
 * @param arguments_
 */
export const parseEvaluateArgs = (arguments_: ParsedArguments): EvaluateOptions => {
	const phase = getOptional<EvaluationPhase>(arguments_, "phase", "all");
	const scenario = getOptional<EvaluationScenario>(arguments_, "scenario", "sampling");
	const outputDir = getOptional<string>(arguments_, "output", "results");
	const repetitions = getNumber(arguments_, "repetitions", 1);
	const seedBase = getNumber(arguments_, "seed", 42);
	const continueOnError = getBoolean(arguments_, "continue-on-error", true);
	const timeoutMs = getNumber(arguments_, "timeout", 0);
	const collectProvenance = getBoolean(arguments_, "provenance", true);
	const checkpointMode = getOptional<string>(arguments_, "checkpoint-mode", "auto");
	// Default to number of CPU cores for parallel execution
	const defaultConcurrency = cpus().length;
	const concurrency = getNumber(arguments_, "concurrency", defaultConcurrency);

	// Multi-process parallel execution (spawns child processes, true multi-core)
	const parallel = getBoolean(arguments_, "parallel", false);
	const parallelWorkersArgument = getOptional<string>(arguments_, "parallel-workers");
	const parallelWorkers = parseParallelWorkers(parallelWorkersArgument);

	// Run filtering for manual multi-core execution
	// Format: JSON array of run IDs or comma-separated run IDs
	const runFilter = getOptional<string>(arguments_, "run-filter");

	// Sort runs by graph size (smallest first) - default true
	const sortBySize = getOptional<boolean>(arguments_, "sort-by-size", true);

	// Claim filtering
	const tagsArgument = getOptional<string>(arguments_, "tags");
	const tags = tagsArgument?.split(",").map((t) => t.trim());

	// Case filtering by tag (e.g., "small", "medium", "large")
	const caseFilterArgument = getOptional<string>(arguments_, "case-filter");
	const caseFilter = caseFilterArgument?.split(",").map((t) => t.trim());

	const claim = getOptional<string>(arguments_, "claim");
	const table = getOptional<string>(arguments_, "table");
	const verbose = getBoolean(arguments_, "verbose", false);

	// Validate phase
	if (!["execute", "aggregate", "render", "progress", "all"].includes(phase)) {
		throw new Error(`Invalid phase: ${phase}. Must be one of: execute, aggregate, render, progress, all`);
	}

	// Validate scenario
	if (!["sampling", "ranking"].includes(scenario)) {
		throw new Error(`Invalid scenario: ${scenario}. Must be one of: sampling, ranking`);
	}

	return {
		phase,
		scenario,
		outputDir,
		repetitions,
		seedBase,
		continueOnError,
		timeoutMs,
		collectProvenance,
		checkpointMode,
		concurrency,
		parallel,
		parallelWorkers,
		runFilter,
		sortBySize,
		tags,
		caseFilter,
		claim,
		table,
		verbose,
	};
};

/**
 * Get SUT definitions from a SUT registry.
 * @param registry
 */
const getSutDefinitions = (registry: ExpansionSutRegistry): Array<SutDefinition<ExpansionInputs, ExpansionResult>> => {
	const ids = registry.list();
	return ids.map((id) => {
		const registration = registry.listRegistrations().find((r) => r.id === id);
		if (!registration) {
			throw new Error(`SUT registration not found: ${id}`);
		}
		return {
			registration,
			factory: (config) => registry.create(id, config),
		} as SutDefinition<ExpansionInputs, ExpansionResult>;
	});
};

/**
 * Get case definitions from a case registry, optionally filtered by tags.
 * @param registry
 * @param filterTags - Optional array of tags to filter cases by (e.g., ["small", "social"])
 */
const getCaseDefinitions = (
	registry: GraphCaseRegistry,
	filterTags?: string[]
): Array<CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>> => {
	const ids = registry.list();
	const cases = ids.map((id) => registry.getOrThrow(id));

	// Filter by tags if specified
	if (filterTags && filterTags.length > 0) {
		return cases.filter((c) => {
			const caseTags = c.case.tags ?? [];
			// Case matches if it has ANY of the filter tags
			return filterTags.some((filterTag) => caseTags.includes(filterTag));
		});
	}

	return cases;
};

/**
 * Get ranking SUT definitions from a ranking SUT registry.
 * @param registry
 */
const getRankingSutDefinitions = (registry: RankingSutRegistry): Array<SutDefinition<RankingInputs, RankingResult>> => {
	const ids = registry.list();
	return ids.map((id) => {
		const registration = registry.listRegistrations().find((r) => r.id === id);
		if (!registration) {
			throw new Error(`SUT registration not found: ${id}`);
		}
		return {
			registration,
			factory: (config) => registry.create(id, config),
		} as SutDefinition<RankingInputs, RankingResult>;
	});
};

/**
 * Get ranking case definitions from a ranking case registry, optionally filtered by tags.
 * @param registry
 * @param filterTags - Optional array of tags to filter cases by
 */
const getRankingCaseDefinitions = (
	registry: RankingCaseRegistry,
	filterTags?: string[]
): Array<CaseDefinition<BenchmarkGraphExpander, RankingInputs>> => {
	const ids = registry.list();
	const cases = ids.map((id) => registry.getOrThrow(id));

	// Filter by tags if specified
	if (filterTags && filterTags.length > 0) {
		return cases.filter((c) => {
			const caseTags = c.case.tags ?? [];
			// Case matches if it has ANY of the filter tags
			return filterTags.some((filterTag) => caseTags.includes(filterTag));
		});
	}

	return cases;
};

/**
 * Type guard to check if result is BidirectionalBFSResult.
 * @param result
 */
const isBidirectionalBFSResult = (result: ExpansionResult): result is BidirectionalBFSResult => "visitedA" in result && "visitedB" in result;

/**
 * Type guard to check if result is OverlapBasedExpansionResult.
 * @param result
 */
const isOverlapBasedExpansionResult = (result: ExpansionResult): result is OverlapBasedExpansionResult => "overlapMetadata" in result;

/**
 * Type guard to check if result is EnsembleExpansionResult.
 * @param result
 */
const isEnsembleExpansionResult = (result: ExpansionResult): result is EnsembleExpansionResult => "sampledNodesPerStrategy" in result;

/**
 * Metrics extractor for expansion results.
 * Handles BidirectionalBFSResult, DegreePrioritisedExpansionResult, and OverlapBasedExpansionResult.
 *
 * Also stores paths to disk for salience coverage computation.
 * @param result
 */
const extractMetrics = (result: ExpansionResult): Record<string, number> => {
	// Store paths to disk for salience coverage computation
	// Returns a timestamp that will be used to associate paths with the runId later
	const pathsForStorage = result.paths.map((p) => {
		// Handle both string[] and {fromSeed, toSeed, nodes[]} path formats
		if (Array.isArray(p)) {
			return p;
		}
		return p.nodes;
	});
	const pathTimestamp = pathStorage.storePaths(pathsForStorage);

	// Handle BidirectionalBFSResult (earlier design with parameterised termination)
	if (isBidirectionalBFSResult(result)) {
		const sampledNodes = result.visitedA.size + result.visitedB.size;
		const metrics: Record<string, number> = {
			// Basic metrics
			"iterations": result.iterations,
			"unique-paths": result.paths.length,
			"sampled-nodes": sampledNodes,
			// Placeholder metrics for compatibility with aggregator
			"nodes-expanded": sampledNodes,
			"edges-traversed": sampledNodes, // Approximate edges ≈ nodes for bidirectional BFS
			"sampled-edges": sampledNodes,
			// Hub metrics (not available in BidirectionalBFSResult, use default values)
			"hub-traversal": 0,
			"hub-avoidance-rate": 0,
			"hub-avoidance-rate-100": 0,
			"peripheral-coverage-ratio": 0,
			// Coverage metrics (placeholders)
			"node-coverage": 0,
			"bucket-coverage": 0,
			"structural-coverage": sampledNodes > 0 ? 1 : 0,
			// Overlap-specific metrics (set to 0 for non-overlap algorithms)
			"overlap-events": 0,
			"termination-reason": 0,
			// Path timestamp for salience coverage computation
			"_pathTimestamp": pathTimestamp,
		};

		// Path diversity metrics (always include, even when no paths)
		if (result.paths.length > 0) {
			const uniquePaths = result.paths.length;
			metrics["path-diversity"] = uniquePaths / Math.log(result.iterations + 2);

			// Path lengths
			const pathLengths = result.paths.map((p) => p.length);
			const avgPathLength = pathLengths.reduce((sum, length) => sum + length, 0) / pathLengths.length;
			metrics["avg-path-length"] = avgPathLength;
			metrics["min-path-length"] = Math.min(...pathLengths);
			metrics["max-path-length"] = Math.max(...pathLengths);
		} else {
			// No paths found - set defaults to ensure consistent metrics across all SUTs
			metrics["path-diversity"] = 0;
			metrics["avg-path-length"] = 0;
			metrics["min-path-length"] = 0;
			metrics["max-path-length"] = 0;
		}

		return metrics;
	}

	// Handle OverlapBasedExpansionResult (overlap-based termination)
	if (isOverlapBasedExpansionResult(result)) {
		const stats = result.stats;
		const overlapMetadata = result.overlapMetadata;

		// Encode termination reason as numeric code
		const terminationCode: Record<string, number> = {
			"overlap-satisfied": 1,
			"n1-coverage": 2,
			"max-iterations": 3,
			"exhaustion": 4,
		};

		const metrics: Record<string, number> = {
			// Basic stats
			"nodes-expanded": stats.nodesExpanded,
			"edges-traversed": stats.edgesTraversed,
			"iterations": stats.iterations,
			"unique-paths": result.paths.length,
			"sampled-nodes": result.sampledNodes.size,
			"sampled-edges": result.sampledEdges.size,

			// Overlap-specific metrics
			"overlap-events": overlapMetadata.overlapEvents.length,
			"termination-reason": terminationCode[overlapMetadata.terminationReason] ?? 0,

			// Hub metrics (from degree distribution)
			"hub-traversal": 0,
			"hub-avoidance-rate": 0,
			"hub-avoidance-rate-100": 0,
			"peripheral-coverage-ratio": 0,

			// Path timestamp for salience coverage computation
			"_pathTimestamp": pathTimestamp,
		};

		// Hub traversal: percentage of nodes expanded that are high-degree (51+)
		const highDegreeCount = (stats.degreeDistribution.get("51-100") ?? 0)
			+ (stats.degreeDistribution.get("101-500") ?? 0)
			+ (stats.degreeDistribution.get("501-1000") ?? 0)
			+ (stats.degreeDistribution.get("1000+") ?? 0);
		metrics["hub-traversal"] = stats.nodesExpanded > 0 ? highDegreeCount / stats.nodesExpanded : 0;

		// Hub avoidance rate: proportion of expanded nodes that are hubs (50+)
		const hubCount = (stats.degreeDistribution.get("51-100") ?? 0)
			+ (stats.degreeDistribution.get("101-500") ?? 0)
			+ (stats.degreeDistribution.get("501-1000") ?? 0)
			+ (stats.degreeDistribution.get("1000+") ?? 0);
		metrics["hub-avoidance-rate"] = stats.nodesExpanded > 0 ? hubCount / stats.nodesExpanded : 0;

		// 100+ hub rate
		const hub100Count = (stats.degreeDistribution.get("101-500") ?? 0)
			+ (stats.degreeDistribution.get("501-1000") ?? 0)
			+ (stats.degreeDistribution.get("1000+") ?? 0);
		metrics["hub-avoidance-rate-100"] = stats.nodesExpanded > 0 ? hub100Count / stats.nodesExpanded : 0;

		// Peripheral coverage: nodes with degree 1-10
		const peripheralCount = (stats.degreeDistribution.get("1-5") ?? 0)
			+ (stats.degreeDistribution.get("6-10") ?? 0);
		metrics["peripheral-coverage-ratio"] = stats.nodesExpanded > 0 ? peripheralCount / stats.nodesExpanded : 0;

		// Coverage metrics
		metrics["node-coverage"] = overlapMetadata.coverage ?? 0;

		// Bucket coverage: number of degree buckets with at least one node
		const bucketsWithData = [...stats.degreeDistribution.entries()].filter(([_, count]) => count > 0).length;
		metrics["bucket-coverage"] = bucketsWithData / stats.degreeDistribution.size;

		// Path diversity metrics (always include, even when no paths)
		if (result.paths.length > 0) {
			const uniquePaths = result.paths.length;
			metrics["path-diversity"] = uniquePaths / Math.log(stats.iterations + 2);

			const pathLengths = result.paths.map((p) => p.nodes.length);
			const avgPathLength = pathLengths.reduce((sum, length) => sum + length, 0) / pathLengths.length;
			metrics["avg-path-length"] = avgPathLength;
			metrics["min-path-length"] = Math.min(...pathLengths);
			metrics["max-path-length"] = Math.max(...pathLengths);
		} else {
			// No paths found - set defaults to ensure consistent metrics across all SUTs
			metrics["path-diversity"] = 0;
			metrics["avg-path-length"] = 0;
			metrics["min-path-length"] = 0;
			metrics["max-path-length"] = 0;
		}

		// Structural coverage: ratio of overlapping frontier pairs to total possible pairs
		const overlappingPairs = new Set<string>();
		for (const event of overlapMetadata.overlapEvents) {
			const key = event.frontierA < event.frontierB
				? `${event.frontierA}-${event.frontierB}`
				: `${event.frontierB}-${event.frontierA}`;
			overlappingPairs.add(key);
		}
		metrics["structural-coverage"] = overlappingPairs.size > 0 ? 1 : 0;

		return metrics;
	}

	// Handle EnsembleExpansionResult (ensemble strategy with union-based results)
	if (isEnsembleExpansionResult(result)) {
		const stats = result.stats;

		// Estimate iterations from total paths (ensemble doesn't track iterations directly)
		const estimatedIterations = stats.totalPaths > 0 ? stats.totalPaths : stats.totalUnionNodes;

		const metrics: Record<string, number> = {
			// Basic metrics - derived from ensemble stats
			"nodes-expanded": stats.totalUnionNodes,
			"edges-traversed": result.sampledEdges.size,
			"iterations": estimatedIterations,
			"unique-paths": result.paths.length,
			"sampled-nodes": result.sampledNodes.size,
			"sampled-edges": result.sampledEdges.size,

			// Overlap-specific metrics (not applicable to ensemble)
			"overlap-events": 0,
			"termination-reason": 0,

			// Hub metrics (ensemble doesn't track degree distribution)
			"hub-traversal": 0,
			"hub-avoidance-rate": 0,
			"hub-avoidance-rate-100": 0,
			"peripheral-coverage-ratio": 0,

			// Coverage metrics
			"node-coverage": result.sampledNodes.size / Math.max(1, result.sampledNodes.size * 2),
			"bucket-coverage": 0, // Not available without degree distribution
			"structural-coverage": result.sampledEdges.size > 0 && result.sampledNodes.size > 0
				? result.sampledEdges.size / result.sampledNodes.size
				: 0,

			// Path timestamp for salience coverage computation
			"_pathTimestamp": pathTimestamp,
		};

		// Path diversity metrics (always include, even when no paths)
		if (result.paths.length > 0) {
			const uniquePaths = result.paths.length;
			metrics["path-diversity"] = uniquePaths / Math.log(estimatedIterations + 2);

			const pathLengths = result.paths.map((p) => p.nodes.length);
			const avgPathLength = pathLengths.reduce((sum, length) => sum + length, 0) / pathLengths.length;
			metrics["avg-path-length"] = avgPathLength;
			metrics["min-path-length"] = Math.min(...pathLengths);
			metrics["max-path-length"] = Math.max(...pathLengths);
		} else {
			// No paths found - set defaults to ensure consistent metrics across all SUTs
			metrics["path-diversity"] = 0;
			metrics["avg-path-length"] = 0;
			metrics["min-path-length"] = 0;
			metrics["max-path-length"] = 0;
		}

		return metrics;
	}

	// Handle DegreePrioritisedExpansionResult (refined design with frontier exhaustion)
	const stats = result.stats;

	// Base metrics from stats
	const metrics: Record<string, number> = {
		"nodes-expanded": stats.nodesExpanded,
		"edges-traversed": stats.edgesTraversed,
		"iterations": stats.iterations,
		"unique-paths": result.paths.length,
		"sampled-nodes": result.sampledNodes.size,
		"sampled-edges": result.sampledEdges.size,

		// Overlap-specific metrics (set to 0 for non-overlap algorithms)
		"overlap-events": 0,
		"termination-reason": 0,

		// Path timestamp for salience coverage computation
		"_pathTimestamp": pathTimestamp,
	};

	// Path diversity metrics (always include, even when no paths)
	if (result.paths.length > 0) {
		// Path diversity: ratio of unique paths to log of iterations
		const uniquePaths = result.paths.length;
		metrics["path-diversity"] = uniquePaths / Math.log(stats.iterations + 2);

		// Path lengths
		const pathLengths = result.paths.map((p) => p.nodes.length);
		const avgPathLength = pathLengths.reduce((sum, length) => sum + length, 0) / pathLengths.length;
		metrics["avg-path-length"] = avgPathLength;
		metrics["min-path-length"] = Math.min(...pathLengths);
		metrics["max-path-length"] = Math.max(...pathLengths);
	} else {
		// No paths found - set defaults to ensure consistent metrics across all SUTs
		metrics["path-diversity"] = 0;
		metrics["avg-path-length"] = 0;
		metrics["min-path-length"] = 0;
		metrics["max-path-length"] = 0;
	}

	// Hub traversal: percentage of nodes expanded that are high-degree (51+)
	const highDegreeCount = (stats.degreeDistribution.get("51-100") ?? 0)
		+ (stats.degreeDistribution.get("101-500") ?? 0)
		+ (stats.degreeDistribution.get("501-1000") ?? 0)
		+ (stats.degreeDistribution.get("1000+") ?? 0);
	const hubTraversal = stats.nodesExpanded > 0 ? highDegreeCount / stats.nodesExpanded : 0;
	metrics["hub-traversal"] = hubTraversal;

	// Hub-Avoidance Metrics
	// Hub avoidance rate: proportion of expanded nodes that are hubs (50+)
	// Using 50+ threshold to capture hubs in academic networks (Cora, CiteSeer)
	const hubCount = (stats.degreeDistribution.get("51-100") ?? 0)
		+ (stats.degreeDistribution.get("101-500") ?? 0)
		+ (stats.degreeDistribution.get("501-1000") ?? 0)
		+ (stats.degreeDistribution.get("1000+") ?? 0);
	const hubAvoidanceRate = stats.nodesExpanded > 0 ? hubCount / stats.nodesExpanded : 0;
	metrics["hub-avoidance-rate"] = hubAvoidanceRate;

	// Also track 100+ hub rate separately for large graphs
	const hub100Count = (stats.degreeDistribution.get("101-500") ?? 0)
		+ (stats.degreeDistribution.get("501-1000") ?? 0)
		+ (stats.degreeDistribution.get("1000+") ?? 0);
	const hub100AvoidanceRate = stats.nodesExpanded > 0 ? hub100Count / stats.nodesExpanded : 0;
	metrics["hub-avoidance-rate-100"] = hub100AvoidanceRate;

	// Peripheral coverage ratio: ratio of peripheral nodes (1-10) to hub nodes (50+)
	const peripheralCount = (stats.degreeDistribution.get("1-5") ?? 0)
		+ (stats.degreeDistribution.get("6-10") ?? 0);
	const peripheralCoverageRatio = hubCount > 0 ? peripheralCount / hubCount : peripheralCount;
	metrics["peripheral-coverage-ratio"] = peripheralCoverageRatio;

	// Node coverage: ratio of sampled nodes to total possible
	// (This is a placeholder - actual total would come from graph metadata)
	metrics["node-coverage"] = result.sampledNodes.size / Math.max(1, result.sampledNodes.size * 2);

	// Bucket coverage: number of degree buckets with at least one node
	const bucketsWithData = [...stats.degreeDistribution.entries()].filter(([_, count]) => count > 0).length;
	metrics["bucket-coverage"] = bucketsWithData / stats.degreeDistribution.size;

	// Structural coverage: ratio of edges to nodes (higher = more connected)
	metrics["structural-coverage"] = stats.nodesExpanded > 0
		? stats.edgesTraversed / stats.nodesExpanded
		: 0;

	return metrics;
};

/**
 * Run the execute phase.
 * @param options
 * @param sutRegistry
 * @param caseRegistry
 */
const runExecutePhase = async (options: EvaluateOptions, sutRegistry: SUTRegistry<unknown, unknown>, caseRegistry: CaseRegistry<unknown>): Promise<void> => {
	console.log("\n╔════════════════════════════════════════════════════════════╗");
	console.log("║  Phase 1: Execute                                         ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	// Show concurrency setting
	if (options.concurrency > 1) {
		console.log(`Concurrency: ${options.concurrency} (parallel execution)\n`);
	} else {
		console.log(`Concurrency: ${options.concurrency} (sequential)\n`);
	}

	// Get SUT and case definitions based on scenario
	// These are used for both checkpoint management and executor creation
	const suts = options.scenario === "ranking"
		? getRankingSutDefinitions(sutRegistry as RankingSutRegistry)
		: getSutDefinitions(sutRegistry as ExpansionSutRegistry);
	const cases = options.scenario === "ranking"
		? getRankingCaseDefinitions(caseRegistry as RankingCaseRegistry, options.caseFilter)
		: getCaseDefinitions(caseRegistry as GraphCaseRegistry, options.caseFilter);

	console.log(`SUTs: ${suts.length}`);
	for (const sut of suts) {
		console.log(`  - ${sut.registration.id} (${sut.registration.role})`);
	}

	console.log(`\nCases: ${cases.length}`);
	for (const case_ of cases) {
		console.log(`  - ${case_.case.name} (${case_.case.caseClass})`);
	}

	// Precompute salience ground truth for expansion scenarios
	// This is done once per test case, then reused for all SUT evaluations
	const salienceGroundTruthByCaseId = new Map<string, Set<string>>();
	if (options.scenario !== "ranking") {
		console.log("\nPrecomputing salience ground truth...");
		const salienceConfig: SalienceCoverageConfig = { topK: 10, lambda: 0, traversalMode: "undirected" };

		for (const caseDef of cases) {
			// Get the dataset ID from case inputs
			const datasetId = caseDef.case.inputs.summary?.datasetId as string | undefined;
			if (!datasetId) {
				console.log(`  Skipping ${caseDef.case.name}: no dataset ID`);
				continue;
			}

			// Load the benchmark graph directly
			const benchmarkData = await loadBenchmarkByIdFromUrl(datasetId);
			const graph = benchmarkData.graph;

			// Get seeds from case inputs (stored during case registration)
			const inputs = caseDef.getInputs() as ExpansionInputs;
			const seeds = inputs.seeds;

			// DEBUG: Log seeds for debugging
			console.log(`  DEBUG: Seeds for ${caseDef.case.name}: [${seeds.join(", ")}]`);

			// Enable detailed debug logging for salience computation
			// (globalThis as unknown as { DEBUG_SALIENCE: boolean }).DEBUG_SALIENCE = true;

			const groundTruth = computeSalienceGroundTruth(graph, seeds, salienceConfig);

			// DEBUG: Log first few paths
			if (groundTruth.size > 0) {
				const samplePaths = [...groundTruth].slice(0, 3);
				console.log(`  DEBUG: Sample paths: ${samplePaths.join("; ")}`);
			}

			salienceGroundTruthByCaseId.set(caseDef.case.caseId, groundTruth);

			console.log(`  ${caseDef.case.name}: ${groundTruth.size} top-${salienceConfig.topK} salient paths`);
		}
		console.log(`Ground truth computed for ${salienceGroundTruthByCaseId.size} cases\n`);
	}

	// Create checkpoint manager for resumable execution
	const executeDir = path.resolve(options.outputDir, "execute");
	if (!existsSync(executeDir)) {
		mkdirSync(executeDir, { recursive: true });
	}

	// Create paths storage directory for salience coverage computation
	const pathsDir = path.resolve(executeDir, "paths");
	if (!existsSync(pathsDir)) {
		mkdirSync(pathsDir, { recursive: true });
	}

	// Initialize path storage with the paths directory
	pathStorage.init(pathsDir);

	// Get worker identity for sharded checkpoint mode
	const workerName = process.env.GRAPHBOX_WORKER_NAME ?? "main";
	const workerIndexString = process.env.GRAPHBOX_WORKER_INDEX;
	const isWorker = workerName !== "main";
	const workerIndex = workerIndexString === undefined ? undefined : Number.parseInt(workerIndexString, 10);

	// Determine checkpoint path based on worker identity
	const checkpointPath = (isWorker && workerIndex !== undefined)
		// Worker mode: use sharded checkpoint path
		? path.resolve(executeDir, `checkpoint-worker-${String(workerIndex).padStart(2, "0")}.json`)
		// Main process: use main checkpoint path
		: path.resolve(executeDir, "checkpoint.json");

	// Create checkpoint storage
	const storage = new FileStorage(checkpointPath);
	const lock = new InMemoryLock();

	// Create checkpoint manager
	const checkpoint = new CheckpointManager({
		storage,
		lock,
		workerIndex,
		basePath: executeDir,
	});
	await checkpoint.load();

	// Get git commit for reproducibility
	const gitCommit = await getGitCommit();

	// Calculate total planned runs
	const totalPlanned = suts.length * cases.length * options.repetitions;

	// Check if checkpoint is stale (configuration changed)
	const executorConfig: Partial<ExecutorConfig> = {
		repetitions: options.repetitions,
		seedBase: options.seedBase,
		continueOnError: options.continueOnError,
		timeoutMs: options.timeoutMs,
		collectProvenance: options.collectProvenance,
		concurrency: options.concurrency,
	};

	// Type assertion for checkpoint.isStale - scenario determines which type is actually used
	const isStale = options.scenario === "ranking"
		? checkpoint.isStale(suts as unknown as Array<SutDefinition<BenchmarkGraphExpander, RankingResult>>, cases, executorConfig, totalPlanned)
		: checkpoint.isStale(suts as unknown as Array<SutDefinition<BenchmarkGraphExpander, ExpansionResult>>, cases, executorConfig, totalPlanned);

	if (checkpoint.exists()) {
		if (isStale) {
			console.log("\nWARNING: Checkpoint exists but configuration has changed.");
			console.log("  Invalidating checkpoint and starting fresh.");
			checkpoint.invalidate();
		} else {
			const progress = checkpoint.getProgress();
			console.log(`\n✓ Checkpoint found: ${progress.completed}/${progress.total} runs completed (${progress.percent}%)`);
			console.log("  Resuming from checkpoint...");
		}
	} else {
		// Initialize new checkpoint
		// Type assertion for checkpoint.initializeEmpty - scenario determines which type is actually used
		if (options.scenario === "ranking") {
			checkpoint.initializeEmpty(suts as unknown as Array<SutDefinition<BenchmarkGraphExpander, RankingResult>>, cases, executorConfig, totalPlanned, gitCommit);
		} else {
			checkpoint.initializeEmpty(suts as unknown as Array<SutDefinition<BenchmarkGraphExpander, ExpansionResult>>, cases, executorConfig, totalPlanned, gitCommit);
		}
		await checkpoint.save();
		console.log("\n  Created new checkpoint (will save incrementally)");
	}

	// Collect completed results from checkpoint
	const completedResults = checkpoint.getResults();

	// Track run timing per worker
	const runStartTimes = new Map<string, number>();
	const workerRunCount = { current: 0, total: 0 };

	// Format duration as human-readable string
	const formatDuration = (ms: number): string => {
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60_000).toFixed(1)}m`;
	};

	// Configure executor with checkpoint callback
	const executorConfigWithCallbacks = {
		...executorConfig,
		onProgress: (progress) => {
			// Track run start time
			const runKey = `${progress.currentSut}-${progress.currentCase}-${progress.currentRepetition}`;
			if (!runStartTimes.has(runKey)) {
				runStartTimes.set(runKey, Date.now());
				workerRunCount.total = progress.total;

				const timestamp = new Date().toISOString().slice(11, 19);
				if (isWorker) {
					console.log(`\n[${timestamp}] ${workerName}: START ${progress.currentSut} @ ${progress.currentCase} (rep ${progress.currentRepetition})`);
				} else if (options.verbose) {
					console.log(`[${timestamp}] START ${progress.currentSut} @ ${progress.currentCase} (rep ${progress.currentRepetition})`);
				}
			}
		},
		onResult: async (result) => {
			// Associate temporarily stored paths with this run ID
			// Extract the timestamp from metrics and use it to find the pending pathId
			const pathTimestamp = result.metrics.numeric["_pathTimestamp"] as number | undefined;
			if (pathTimestamp !== undefined) {
				pathStorage.associateWithRun(pathTimestamp, result.run.runId);
			}

			// Calculate and display run duration
			const runKey = `${result.run.sut}-${result.run.caseId}-${result.run.repetition}`;
			const startTime = runStartTimes.get(runKey) ?? Date.now();
			const duration = Date.now() - startTime;
			workerRunCount.current++;

			const timestamp = new Date().toISOString().slice(11, 19);
			if (isWorker) {
				console.log(`[${timestamp}] ${workerName}: DONE ${result.run.sut} @ ${result.run.caseId} (${formatDuration(duration)})`);
			} else if (options.verbose) {
				console.log(`[${timestamp}] DONE ${result.run.sut} @ ${result.run.caseId} (${formatDuration(duration)})`);
			} else {
				process.stdout.write(`\r  [${workerRunCount.current}/${workerRunCount.total}] Complete...`);
			}

			// Save checkpoint incrementally after each result
			await checkpoint.saveIncremental(result);
		},
	} as ExecutorConfig & { onResult?: (result: EvaluationResult) => void | Promise<void> };

	// Create executor based on scenario
	// For sampling: use typed executor with BenchmarkGraphExpander, ExpansionInputs, ExpansionResult
	// For ranking: use typed executor with BenchmarkGraphExpander, RankingInputs, RankingResult
	if (options.scenario === "ranking") {
		// Ranking scenario: SUTs already return metrics, use pass-through extractor
		// NOTE: forceInProcess=true required because ranking SUTs use wrapper classes
		// that are not compatible with worker thread serialization
		const rankingExecutor = createExecutor<BenchmarkGraphExpander, RankingInputs, RankingResult>({
			...executorConfigWithCallbacks,
			forceInProcess: true,
		});

		// Plan all runs and filter out completed ones
		const allPlanned = rankingExecutor.plan(suts as unknown as Array<SutDefinition<RankingInputs, RankingResult>>, cases as Array<CaseDefinition<BenchmarkGraphExpander, RankingInputs>>);
		let remainingRuns = checkpoint.filterRemaining(allPlanned);

		// Apply run filter if specified
		if (options.runFilter) {
			console.log(`\nDEBUG: Received run filter (length ${options.runFilter.length}): ${options.runFilter.slice(0, 100)}...`);
			try {
				const runIdSet = parseRunIdFilter(options.runFilter);
				console.log(`DEBUG: Parsed ${runIdSet.size} run IDs from filter`);
				remainingRuns = remainingRuns.filter((run) => runIdSet.has(run.runId));
				console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (by run ID)`);
			} catch {
				const filterSet = parseRunFilter(options.runFilter, allPlanned.length);
				remainingRuns = remainingRuns.filter((_run, index) => filterSet.has(index));
				console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (${options.runFilter})`);
			}
		}

		// Sort runs by graph size (smallest first) for better progress visibility
		const sortBySize = options.sortBySize ?? true;
		if (sortBySize && remainingRuns.length > 1) {
			const caseSizeMap = new Map<string, { nodes: number; edges: number }>();
			for (const caseDef of cases) {
				const nodeCount = caseDef.case.inputs.summary?.nodes as number | undefined;
				const edgeCount = caseDef.case.inputs.summary?.edges as number | undefined;
				if (typeof nodeCount === "number") {
					caseSizeMap.set(caseDef.case.caseId, {
						nodes: nodeCount,
						edges: typeof edgeCount === "number" ? edgeCount : 0,
					});
				}
			}
			remainingRuns = remainingRuns.sort((a, b) => {
				const sizeA = caseSizeMap.get(a.caseId);
				const sizeB = caseSizeMap.get(b.caseId);
				if (!sizeA) return 1;
				if (!sizeB) return -1;
				if (sizeA.nodes !== sizeB.nodes) return sizeA.nodes - sizeB.nodes;
				if (sizeA.edges !== sizeB.edges) return sizeA.edges - sizeB.edges;
				return a.caseId.localeCompare(b.caseId);
			});
		}

		// Execute ranking scenario (single-process only for now)
		// Extract metrics from ranking results (top-level properties -> metrics.numeric)
		const rankingMetricsExtractor = (result: unknown): Record<string, number> => {
			const r = result as RankingResultBase;
			return {
				"paths-found": r.pathsFound,
				"mean-mi": r.meanMI,
				"std-mi": r.stdMI,
				"path-diversity": r.pathDiversity,
				"hub-avoidance": r.hubAvoidance,
				"node-coverage": r.nodeCoverage,
				"mean-score": r.meanScore,
				"std-score": r.stdScore,
			};
		};
		await rankingExecutor.execute(suts as unknown as Array<SutDefinition<RankingInputs, RankingResult>>, cases as Array<CaseDefinition<BenchmarkGraphExpander, RankingInputs>>, rankingMetricsExtractor, remainingRuns);
	} else {
		// Sampling scenario: use typed executor with BenchmarkGraphExpander, ExpansionInputs, ExpansionResult
		// NOTE: forceInProcess=true required because expansion SUTs use registry classes
		// that are not compatible with worker thread serialization
		const executor = createExecutor<BenchmarkGraphExpander, ExpansionInputs, ExpansionResult>({
			...executorConfigWithCallbacks,
			forceInProcess: true,
		});

		// Plan all runs and filter out completed ones
		const allPlanned = executor.plan(suts as Array<SutDefinition<ExpansionInputs, ExpansionResult>>, cases as Array<CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>>);
		let remainingRuns = checkpoint.filterRemaining(allPlanned);

		// Apply run filter if specified
		if (options.runFilter) {
			// DEBUG: Log the raw run filter
			console.log(`\nDEBUG: Received run filter (length ${options.runFilter.length}): ${options.runFilter.slice(0, 100)}...`);

			// Try to parse as JSON array of run IDs first (for parallel workers)
			try {
				const runIdSet = parseRunIdFilter(options.runFilter);
				console.log(`DEBUG: Parsed ${runIdSet.size} run IDs from filter`);
				remainingRuns = remainingRuns.filter((run) => runIdSet.has(run.runId));
				console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (by run ID)`);
			} catch {
				// Fall back to index-based filtering for backward compatibility
				const filterSet = parseRunFilter(options.runFilter, allPlanned.length);
				remainingRuns = remainingRuns.filter((_run, index) => filterSet.has(index));
				console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (${options.runFilter})`);
			}
		}

		// Sort runs by graph size (smallest first) for better progress visibility
		// Default to true unless explicitly disabled
		const sortBySize = options.sortBySize ?? true;
		if (sortBySize && remainingRuns.length > 1) {
			// Build a map of caseId to { nodes, edges } for sorting
			const caseSizeMap = new Map<string, { nodes: number; edges: number }>();
			for (const caseDef of cases) {
				const nodeCount = caseDef.case.inputs.summary?.nodes as number | undefined;
				const edgeCount = caseDef.case.inputs.summary?.edges as number | undefined;
				if (typeof nodeCount === "number") {
					caseSizeMap.set(caseDef.case.caseId, {
						nodes: nodeCount,
						edges: typeof edgeCount === "number" ? edgeCount : 0,
					});
				}
			}

			// Sort by nodes first, then edges, then caseId for determinism
			remainingRuns = remainingRuns.sort((a, b) => {
				const sizeA = caseSizeMap.get(a.caseId);
				const sizeB = caseSizeMap.get(b.caseId);
				if (!sizeA) return 1;
				if (!sizeB) return -1;
				if (sizeA.nodes !== sizeB.nodes) return sizeA.nodes - sizeB.nodes;
				if (sizeA.edges !== sizeB.edges) return sizeA.edges - sizeB.edges;
				return a.caseId.localeCompare(b.caseId);
			});
		}

		if (remainingRuns.length === 0) {
			console.log("\n\nAll runs already completed. Skipping execution.");
		} else {
			console.log(`\nRunning experiments... (${remainingRuns.length} remaining, ${completedResults.length} cached)`);

			// Execute all runs - checkpoint will track which are already done
			if (options.parallel) {
				// Multi-process parallel execution for true multi-core utilization
				console.log(`Using multi-process parallel execution (${options.parallelWorkers ?? cpus().length} workers)`);
				await executeParallel(remainingRuns, suts, cases, executorConfigWithCallbacks, {
					workers: options.parallelWorkers,
					checkpointDir: executeDir,
					timeoutMs: options.timeoutMs,
				});

				// Merge worker checkpoints after parallel execution (main process only)
				if (!isWorker) {
					console.log("\nMerging worker checkpoints...");

					// Find all worker shard files
					const shardFiles = await FileStorage.findShards(executeDir);

					if (shardFiles.length > 0) {
						console.log(`Found ${shardFiles.length} worker checkpoint shards`);
						for (const shard of shardFiles) {
							console.log(`  - ${shard}`);
						}

						// Merge shards into main checkpoint
						await checkpoint.mergeShards(shardFiles);
						console.log("Merged worker checkpoints into main checkpoint");

						// Optionally clean up shard files after merge
						// (Keep them for now for debugging)
					}
				}
			} else {
				// Single-process async execution (concurrent but single-threaded)
				// Pass remainingRuns to avoid re-executing completed runs
				await executor.execute(suts as Array<SutDefinition<ExpansionInputs, ExpansionResult>>, cases as Array<CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>>, extractMetrics, remainingRuns);
			}
		}
	}

	// Reload checkpoint from disk to get all results (including those saved incrementally)
	await checkpoint.load();

	// Merge all results (completed from checkpoint + new)
	const allResults = [...checkpoint.getResults()];

	// Post-process results to add salience coverage metrics
	// Use stored paths to compute coverage
	console.log("\nComputing salience coverage metrics...");

	// Store ground truth for use in aggregate phase
	const groundTruthFile = path.resolve(executeDir, "salience-ground-truth.json");
	const groundTruthData: Record<string, string[]> = {};
	for (const [caseId, paths] of salienceGroundTruthByCaseId) {
		groundTruthData[caseId] = [...paths];
	}
	writeFileSync(groundTruthFile, JSON.stringify(groundTruthData), "utf8");

	let computedCount = 0;
	for (const result of allResults) {
		const groundTruth = salienceGroundTruthByCaseId.get(result.run.caseId);
		if (!groundTruth) {
			continue;
		}

		// Load paths from file
		const paths = pathStorage.loadPathsFromFile(result.run.runId);

		if (!paths) {
			// No paths stored - this shouldn't happen if everything is working
			continue;
		}

		// Compute salience coverage
		const coverage = computeSalienceCoverageFromStringPaths(paths, groundTruth);

		// Add to metrics
		Object.assign(result.metrics, coverage);
		computedCount++;
	}

	console.log(`Computed salience coverage for ${computedCount}/${allResults.length} results`);
	console.log(`Ground truth saved to: ${groundTruthFile}\n`);

	// Write results to file
	const resultsFile = path.resolve(executeDir, "evaluation-results.json");
	const finalSummary = {
		totalRuns: allResults.length,
		successfulRuns: allResults.length,
		failedRuns: 0,
		elapsedMs: 0, // Would need to track across runs
		results: allResults,
	};
	writeFileSync(resultsFile, JSON.stringify(finalSummary, null, 2), "utf8");

	console.log(`\n\nResults written to: ${resultsFile}`);
	console.log(`  Total runs: ${allResults.length}`);
	console.log(`  From checkpoint: ${completedResults.length}`);
	console.log(`  New this run: ${allResults.length - completedResults.length}`);
	console.log(`\n${checkpoint.getSummary()}`);
};

/**
 * Run the aggregate phase.
 * @param options
 */
const runAggregatePhase = async (options: EvaluateOptions): Promise<void> => {
	console.log("\n╔════════════════════════════════════════════════════════════╗");
	console.log("║  Phase 2: Aggregate                                       ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	// Read execution results
	const executeDir = path.resolve(options.outputDir, "execute");
	const resultsFile = path.resolve(executeDir, "evaluation-results.json");

	if (!existsSync(resultsFile)) {
		throw new Error("Execution results not found. Run --phase=execute first.");
	}

	const summaryText = await read(resultsFile);
	const summary = JSON.parse(summaryText) as { totalRuns: number; successfulRuns: number; failedRuns: number; elapsedMs: number; results: EvaluationResult[] };

	console.log(`Loaded ${summary.results.length} results from execution.`);

	// Post-process results to add salience coverage metrics
	// Load paths from files and compute coverage
	console.log("\nComputing salience coverage metrics...");

	// Initialize pathStorage with paths directory for loading stored paths
	const aggregatePathsDir = path.resolve(executeDir, "paths");
	pathStorage.init(aggregatePathsDir);

	// Load ground truth from file (saved during execute phase)
	const groundTruthFile = path.resolve(executeDir, "salience-ground-truth.json");
	if (existsSync(groundTruthFile)) {
		const groundTruthText = readFileSync(groundTruthFile, "utf8");
		const groundTruthData = JSON.parse(groundTruthText) as Record<string, string[]>;
		const salienceGroundTruthByCaseId = new Map<string, Set<string>>();
		for (const [caseId, paths] of Object.entries(groundTruthData)) {
			salienceGroundTruthByCaseId.set(caseId, new Set(paths));
		}

		// Compute salience coverage for each result using stored paths
		let computedCount = 0;
		for (const result of summary.results) {
			const groundTruth = salienceGroundTruthByCaseId.get(result.run.caseId);
			if (!groundTruth) {
				continue;
			}

			// Load paths from file
			const paths = pathStorage.loadPathsFromFile(result.run.runId);
			if (!paths) {
				continue;
			}

			// Compute salience coverage
			const coverage = computeSalienceCoverageFromStringPaths(paths, groundTruth);

			// Add to metrics
			Object.assign(result.metrics, coverage);
			computedCount++;
		}

		console.log(`Computed salience coverage for ${computedCount}/${summary.results.length} results\n`);
	} else {
		console.log("Warning: Ground truth file not found. Salience coverage will be skipped.\n");
	}

	// Aggregate results
	const aggregateOptions: AggregationPipelineOptions = {
		groupByCaseClass: true,
		computeComparisons: true,
	};

	const aggregates = aggregateResults(summary.results, aggregateOptions);

	// Create aggregation output
	const aggregationOutput = createAggregationOutput(aggregates, summary.results);

	// Write aggregated results
	const aggregateDir = path.resolve(options.outputDir, "aggregate");
	if (!existsSync(aggregateDir)) {
		mkdirSync(aggregateDir, { recursive: true });
	}

	const aggregatedFile = path.resolve(aggregateDir, "aggregated-results.json");
	writeFileSync(aggregatedFile, JSON.stringify(aggregationOutput, null, 2), "utf8");

	console.log(`\nAggregated ${aggregates.length} groups.`);
	console.log(`Results written to: ${aggregatedFile}`);

	// Claims evaluation deferred until ClaimsEvaluator API is available
	// await evaluateClaimsInternal(options, aggregates);
};

/**
 * Evaluate claims against aggregated results.
 *
 * Pending migration to new ClaimsEvaluator API.
 * This function is intentionally unused pending migration.
 * @param _options
 * @param _aggregates
 */
const _evaluateClaimsInternal = async (_options: EvaluateOptions, _aggregates: unknown[]): Promise<void> => {
	// Placeholder for claims evaluation functionality pending ClaimsEvaluator API
	console.log("\n  Claims evaluation not yet implemented.");
};

/**
 * Run the render phase.
 * @param options
 */
const runRenderPhase = async (options: EvaluateOptions): Promise<void> => {
	console.log("\n╔════════════════════════════════════════════════════════════╗");
	console.log("║  Phase 3: Render                                          ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	// Read aggregated results
	const aggregateDir = path.resolve(options.outputDir, "aggregate");
	const aggregatedFile = path.resolve(aggregateDir, "aggregated-results.json");

	if (!existsSync(aggregatedFile)) {
		throw new Error("Aggregated results not found. Run --phase=aggregate first.");
	}

	const outputText = await read(aggregatedFile);
	const aggregationOutput = JSON.parse(outputText);

	if (!isAggregatedResultsJson(aggregationOutput)) {
		throw new Error("Invalid aggregated results format.");
	}

	const aggregates = aggregationOutput.aggregates.filter(isAggregatedResult);

	console.log(`Loaded ${aggregates.length} aggregated results.`);

	// Select tables to render
	let tableSpecs = TABLE_SPECS;

	if (options.table) {
		tableSpecs = tableSpecs.filter((t) => t.id === options.table);
		if (tableSpecs.length === 0) {
			throw new Error(`Table '${options.table}' not found.`);
		}
	}

	console.log(`Rendering ${tableSpecs.length} tables...`);

	// Create renderer
	const renderer = createLatexRenderer();

	// Render tables
	const renderDir = path.resolve(options.outputDir, "render", "latex");
	if (!existsSync(renderDir)) {
		mkdirSync(renderDir, { recursive: true });
	}

	const outputs = renderer.renderAll(aggregates, tableSpecs);

	for (const output of outputs) {
		const outputFile = path.resolve(renderDir, output.filename);
		writeFileSync(outputFile, output.content, "utf8");
		console.log(`  - ${output.filename}`);
	}

	console.log(`\nTables written to: ${renderDir}`);

	// Render claim summary if available
	const claimsFile = path.resolve(aggregateDir, "claim-evaluation.json");
	if (existsSync(claimsFile)) {
		console.log("\nRendering claim summary...");

		const claimsText = await read(claimsFile);
		const claimSummary = JSON.parse(claimsText);

		if (!isClaimSummaryJson(claimSummary)) {
			throw new Error("Invalid claim summary format.");
		}

		const evaluations = claimSummary.evaluations.filter(isClaimEvaluation);
		const claimOutput = renderer.renderClaimSummary(evaluations);
		const claimSummaryFile = path.resolve(renderDir, claimOutput.filename);
		writeFileSync(claimSummaryFile, claimOutput.content, "utf8");

		console.log(`  - ${claimOutput.filename}`);
	}
};

/**
 * Execute the evaluate command.
 * @param options
 */
/**
 * Show current evaluation progress from checkpoint.
 * @param options
 */
const showProgress = async (options: EvaluateOptions): Promise<void> => {
	const checkpointPath = path.resolve(options.outputDir, "execute/checkpoint.json");

	// Check if checkpoint exists
	try {
		const { readFile } = await import("node:fs/promises");
		const content = await readFile(checkpointPath, "utf8");
		const checkpoint = JSON.parse(content);

		if (!isCheckpointData(checkpoint)) {
			throw new Error("Invalid checkpoint format.");
		}

		const completedRunIds = checkpoint.completedRunIds ?? [];
		const uniqueCompleted = [...new Set(completedRunIds)];
		const totalRuns = checkpoint.config?.totalRuns ?? 132;
		const percent = ((uniqueCompleted.length / totalRuns) * 100).toFixed(1);

		console.log("╔════════════════════════════════════════════════════════════╗");
		console.log("║   Evaluation Progress                                         ║");
		console.log("╚════════════════════════════════════════════════════════════╝");

		console.log(`\n  Completed: ${uniqueCompleted.length}/${totalRuns} runs (${percent}%)`);
		console.log(`  Remaining: ${totalRuns - uniqueCompleted.length} runs`);
		console.log(`  Checkpoint: ${checkpointPath}`);

		// Show active workers
		const { execSync } = await import("node:child_process");
		try {
			const workerCount = execSync("ps aux | grep 'cli.js evaluate' | grep -v grep | wc -l", { encoding: "utf8" }).trim();
			const workers = Number.parseInt(workerCount, 10);
			if (workers > 0) {
				console.log(`  Active workers: ${workers}`);
			}
		} catch {
			// Worker count check failed, continue
		}

		// Group results by SUT and case
		const results = checkpoint.results ?? {};
		const bySut: Record<string, number> = {};
		const byCase: Record<string, number> = {};

		for (const runId of uniqueCompleted) {
			const result = results[String(runId)];
			if (result) {
				const sut = result.run?.sut ?? "unknown";
				const caseId = result.run?.caseId ?? "unknown";
				bySut[sut] = (bySut[sut] ?? 0) + 1;
				byCase[caseId] = (byCase[caseId] ?? 0) + 1;
			}
		}

		if (Object.keys(bySut).length > 0) {
			console.log("\n  By SUT:");
			for (const [sut, count] of Object.entries(bySut).sort((a, b) => b[1] - a[1])) {
				console.log(`    ${sut}: ${count}`);
			}
		}

		if (Object.keys(byCase).length > 0 && Object.keys(byCase).length < 20) {
			console.log("\n  By Case:");
			for (const [caseId, count] of Object.entries(byCase).sort((a, b) => b[1] - a[1])) {
				console.log(`    ${caseId}: ${count}`);
			}
		}

		// Show timestamps
		if (checkpoint.createdAt && checkpoint.updatedAt) {
			const started = new Date(checkpoint.createdAt);
			const updated = new Date(checkpoint.updatedAt);
			const elapsed = Date.now() - started.getTime();
			const elapsedMin = (elapsed / 60_000).toFixed(1);

			console.log(`\n  Started: ${started.toLocaleString()}`);
			console.log(`  Last update: ${updated.toLocaleString()}`);
			console.log(`  Elapsed: ${elapsedMin}m`);

			// Estimate remaining time
			if (uniqueCompleted.length > 0) {
				const avgTimePerRun = elapsed / uniqueCompleted.length;
				const remainingRuns = totalRuns - uniqueCompleted.length;
				const estimatedRemaining = (avgTimePerRun * remainingRuns / 60_000).toFixed(0);
				console.log(`  Est. remaining: ~${estimatedRemaining}m`);
			}
		}
	} catch {
		console.log("╔════════════════════════════════════════════════════════════╗");
		console.log("║   Evaluation Progress                                         ║");
		console.log("╚════════════════════════════════════════════════════════════╝");
		console.log(`\n  No checkpoint found at: ${checkpointPath}`);
		console.log("  Run --phase=execute to start evaluation");
	}
};

export const executeEvaluate = async (options: EvaluateOptions): Promise<void> => {
	try {
		// Handle progress phase separately (no registry initialization needed)
		if (options.phase === "progress") {
			await showProgress(options);
			return;
		}

		// Initialize registries based on scenario
		let sutRegistry: SUTRegistry<unknown, unknown>;
		let caseRegistry: CaseRegistry<unknown>;

		if (options.scenario === "ranking") {
			console.log("\nScenario: Ranking (Path Salience evaluation)");
			sutRegistry = registerRankingSuts(new SUTRegistry());
			caseRegistry = await registerRankingCases(new CaseRegistry());
		} else {
			console.log("\nScenario: Sampling (expansion evaluation)");
			sutRegistry = registerExpansionSuts(new SUTRegistry());
			caseRegistry = await registerCases(new CaseRegistry());
		}

		console.log("╔════════════════════════════════════════════════════════════╗");
		console.log("║   GraphBox Evaluation Framework                            ║");
		console.log("║   PPEF-Compliant: Execute → Aggregate → Render              ║");
		console.log("╚════════════════════════════════════════════════════════════╝");
		console.log(`\nOutput directory: ${options.outputDir}`);
		console.log(`Phase: ${options.phase}`);
		console.log(`Repetitions: ${options.repetitions}`);

		// Run phases based on selection
		const shouldExecute = options.phase === "execute" || options.phase === "all";
		const shouldAggregate = options.phase === "aggregate" || options.phase === "all";
		const shouldRender = options.phase === "render" || options.phase === "all";

		if (shouldExecute) {
			await runExecutePhase(options, sutRegistry, caseRegistry);
		}

		if (shouldAggregate) {
			await runAggregatePhase(options);
		}

		if (shouldRender) {
			await runRenderPhase(options);
		}

		console.log("\n✓ Evaluation complete");
	} catch (error) {
		const formatted = formatError(error);
		console.error(`\nError: ${formatted.message}`);
		if (formatted.suggestion !== undefined) {
			console.error(`Suggestion: ${formatted.suggestion}`);
		}
		process.exit(formatted.exitCode);
	}
};

/**
 * Helper to read a file.
 * @param path
 */
const read = async (path: string): Promise<string> => {
	// Use dynamic import to avoid bundling issues
	const { readFile } = await import("node:fs/promises");
	return readFile(path, "utf8");
};

/**
 * Run the evaluate command from parsed arguments.
 * @param arguments_
 */
export const runEvaluate = (arguments_: ParsedArguments): void => {
	const options = parseEvaluateArgs(arguments_);
	void executeEvaluate(options);
};
