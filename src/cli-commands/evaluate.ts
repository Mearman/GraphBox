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

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { resolve } from "node:path";

import type { DegreePrioritisedExpansionResult } from "../algorithms/traversal/degree-prioritised-expansion.js";
import type { ParsedArguments } from "../cli-utils/arg-parser";
import { getBoolean, getNumber, getOptional } from "../cli-utils/arg-parser";
import { formatError } from "../cli-utils/error-formatter";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { aggregateResults, type AggregationPipelineOptions, createAggregationOutput } from "../experiments/framework/aggregation/index.js";
import { createClaimSummary, evaluateClaims } from "../experiments/framework/claims/index.js";
import { getClaimsByTag, getCoreClaims, THESIS_CLAIMS } from "../experiments/framework/claims/registry.js";
// Framework imports
import { CheckpointManager, createExecutor, executeParallel, type ExecutorConfig, FileStorage, getGitCommit, InMemoryLock } from "../experiments/framework/executor/index.js";
import { CaseRegistry } from "../experiments/framework/registry/case-registry.js";
import { type GraphCaseRegistry,registerCases } from "../experiments/framework/registry/register-cases.js";
import { type ExpansionSutRegistry,registerExpansionSuts } from "../experiments/framework/registry/register-suts.js";
import { SUTRegistry } from "../experiments/framework/registry/sut-registry.js";
import { createLatexRenderer } from "../experiments/framework/renderers/latex-renderer.js";
import { TABLE_SPECS } from "../experiments/framework/renderers/table-specs.js";
import type { CaseDefinition } from "../experiments/framework/types/case.js";
import type { EvaluationResult } from "../experiments/framework/types/result.js";
import type { SutDefinition } from "../experiments/framework/types/sut.js";

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
			if (isNaN(start) || isNaN(end)) {
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
			if (isNaN(index)) {
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
 *   - "8" - exact number of workers
 *   - undefined - defaults to 75% of cores (3/4 of available cores)
 * @param arg - Argument value
 * @param argument
 * @returns Number of workers
 */
const parseParallelWorkers = (argument: string | undefined): number => {
	const totalCores = cpus().length;

	if (argument === undefined) {
		// Default: 75% of cores (3/4), leaving headroom for system
		return Math.max(1, Math.floor((totalCores * 3) / 4));
	}

	// Check for percentage format (e.g., "80%")
	if (argument.endsWith("%")) {
		const percentage = Number.parseFloat(argument.slice(0, -1));
		if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
			throw new Error(`Invalid worker percentage: ${argument}. Must be 1-100%`);
		}
		return Math.max(1, Math.floor((percentage / 100) * totalCores));
	}

	// Exact number
	const count = Number.parseInt(argument, 10);
	if (isNaN(count) || count <= 0) {
		throw new Error(`Invalid worker count: ${argument}. Must be a positive number`);
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
 * Evaluation command options.
 */
export interface EvaluateOptions {
	/** Phase(s) to run */
	phase: EvaluationPhase;

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

	/** Filter claims by tag */
	tags?: string[];

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

	// Claim filtering
	const tagsArgument = getOptional<string>(arguments_, "tags");
	const tags = tagsArgument?.split(",").map((t) => t.trim());

	const claim = getOptional<string>(arguments_, "claim");
	const table = getOptional<string>(arguments_, "table");
	const verbose = getBoolean(arguments_, "verbose", false);

	// Validate phase
	if (!["execute", "aggregate", "render", "progress", "all"].includes(phase)) {
		throw new Error(`Invalid phase: ${phase}. Must be one of: execute, aggregate, render, progress, all`);
	}

	return {
		phase,
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
		tags,
		claim,
		table,
		verbose,
	};
};

/**
 * Get SUT definitions from a SUT registry.
 * @param registry
 */
const getSutDefinitions = (registry: ExpansionSutRegistry): Array<SutDefinition<BenchmarkGraphExpander, DegreePrioritisedExpansionResult>> => {
	const ids = registry.list();
	return ids.map((id) => {
		const registration = registry.listRegistrations().find((r) => r.id === id);
		if (!registration) {
			throw new Error(`SUT registration not found: ${id}`);
		}
		return {
			registration,
			factory: (expander, seeds, config) =>
				registry.createInstance(id, expander, seeds, config),
		} as SutDefinition<BenchmarkGraphExpander, DegreePrioritisedExpansionResult>;
	});
};

/**
 * Get case definitions from a case registry.
 * @param registry
 */
const getCaseDefinitions = (registry: GraphCaseRegistry): Array<CaseDefinition<BenchmarkGraphExpander>> => {
	const ids = registry.list();
	return ids.map((id) => registry.getOrThrow(id));
};

/**
 * Metrics extractor for degree-prioritised expansion results.
 * @param result
 */
const extractMetrics = (result: DegreePrioritisedExpansionResult): Record<string, number> => {
	const stats = result.stats;

	// Base metrics from stats
	const metrics: Record<string, number> = {
		"nodes-expanded": stats.nodesExpanded,
		"edges-traversed": stats.edgesTraversed,
		"iterations": stats.iterations,
		"unique-paths": result.paths.length,
		"sampled-nodes": result.sampledNodes.size,
		"sampled-edges": result.sampledEdges.size,
	};

	// Path diversity metrics
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
const runExecutePhase = async (options: EvaluateOptions, sutRegistry: ExpansionSutRegistry, caseRegistry: GraphCaseRegistry): Promise<void> => {
	console.log("\n╔════════════════════════════════════════════════════════════╗");
	console.log("║  Phase 1: Execute                                         ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	// Show concurrency setting
	if (options.concurrency > 1) {
		console.log(`Concurrency: ${options.concurrency} (parallel execution)\n`);
	} else {
		console.log(`Concurrency: ${options.concurrency} (sequential)\n`);
	}

	// Get SUT and case definitions
	const suts = getSutDefinitions(sutRegistry);
	const cases = getCaseDefinitions(caseRegistry);

	console.log(`SUTs: ${suts.length}`);
	for (const sut of suts) {
		console.log(`  - ${sut.registration.id} (${sut.registration.role})`);
	}

	console.log(`\nCases: ${cases.length}`);
	for (const case_ of cases) {
		console.log(`  - ${case_.case.name} (${case_.case.caseClass})`);
	}

	// Create checkpoint manager for resumable execution
	const executeDir = resolve(options.outputDir, "execute");
	if (!existsSync(executeDir)) {
		mkdirSync(executeDir, { recursive: true });
	}

	// Get worker identity for sharded checkpoint mode
	const workerName = process.env.GRAPHBOX_WORKER_NAME ?? "main";
	const workerIndexString = process.env.GRAPHBOX_WORKER_INDEX;
	const isWorker = workerName !== "main";
	const workerIndex = workerIndexString === undefined ? undefined : Number.parseInt(workerIndexString, 10);

	// Determine checkpoint path based on worker identity
	const checkpointMode = options.checkpointMode as "file" | "git" | "auto";
	let checkpointPath: string;
	if (isWorker && workerIndex !== undefined) {
		// Worker mode: use sharded checkpoint path
		checkpointPath = resolve(executeDir, `checkpoint-worker-${String(workerIndex).padStart(2, "0")}.json`);
	} else {
		// Main process: use main checkpoint path
		checkpointPath = resolve(executeDir, "checkpoint.json");
	}

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

	const isStale = checkpoint.isStale(suts, cases, executorConfig, totalPlanned);

	if (checkpoint.exists()) {
		if (isStale) {
			console.log("\n⚠ Checkpoint exists but configuration has changed.");
			console.log("  Invalidating checkpoint and starting fresh.");
			checkpoint.invalidate();
		} else {
			const progress = checkpoint.getProgress();
			console.log(`\n✓ Checkpoint found: ${progress.completed}/${progress.total} runs completed (${progress.percent}%)`);
			console.log("  Resuming from checkpoint...");
		}
	} else {
		// Initialize new checkpoint
		checkpoint.initializeEmpty(suts, cases, executorConfig, totalPlanned, gitCommit);
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

	const executor = createExecutor<BenchmarkGraphExpander, DegreePrioritisedExpansionResult>(executorConfigWithCallbacks);

	// Plan all runs and filter out completed ones
	const allPlanned = executor.plan(suts, cases);
	let remainingRuns = checkpoint.filterRemaining(allPlanned);

	// Apply run filter if specified
	if (options.runFilter) {
		// Try to parse as JSON array of run IDs first (for parallel workers)
		try {
			const runIdSet = parseRunIdFilter(options.runFilter);
			remainingRuns = remainingRuns.filter((run) => runIdSet.has(run.runId));
			console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (by run ID)`);
		} catch {
			// Fall back to index-based filtering for backward compatibility
			const filterSet = parseRunFilter(options.runFilter, allPlanned.length);
			remainingRuns = remainingRuns.filter((_run, index) => filterSet.has(index));
			console.log(`\nRun filter applied: ${remainingRuns.length} runs selected (${options.runFilter})`);
		}
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
			await executor.execute(suts, cases, extractMetrics);
		}
	}

	// Merge all results (completed from checkpoint + new)
	const allResults = [...checkpoint.getResults()];

	// Write results to file
	const resultsFile = resolve(executeDir, "evaluation-results.json");
	const finalSummary = {
		totalRuns: allResults.length,
		successfulRuns: allResults.length,
		failedRuns: 0,
		elapsedMs: 0, // Would need to track across runs
		results: allResults,
	};
	writeFileSync(resultsFile, JSON.stringify(finalSummary, null, 2), "utf-8");

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
	const executeDir = resolve(options.outputDir, "execute");
	const resultsFile = resolve(executeDir, "evaluation-results.json");

	if (!existsSync(resultsFile)) {
		throw new Error("Execution results not found. Run --phase=execute first.");
	}

	const summaryText = await read(resultsFile);
	const summary = JSON.parse(summaryText);

	console.log(`Loaded ${summary.results.length} results from execution.`);

	// Aggregate results
	const aggregateOptions: AggregationPipelineOptions = {
		groupByCaseClass: true,
		computeComparisons: true,
	};

	const aggregates = aggregateResults(summary.results, aggregateOptions);

	// Create aggregation output
	const aggregationOutput = createAggregationOutput(aggregates, summary.results);

	// Write aggregated results
	const aggregateDir = resolve(options.outputDir, "aggregate");
	if (!existsSync(aggregateDir)) {
		mkdirSync(aggregateDir, { recursive: true });
	}

	const aggregatedFile = resolve(aggregateDir, "aggregated-results.json");
	writeFileSync(aggregatedFile, JSON.stringify(aggregationOutput, null, 2), "utf-8");

	console.log(`\nAggregated ${aggregates.length} groups.`);
	console.log(`Results written to: ${aggregatedFile}`);

	// Evaluate claims
	await evaluateClaimsInternal(options, aggregates);
};

/**
 * Evaluate claims against aggregated results.
 * @param options
 * @param aggregates
 */
const evaluateClaimsInternal = async (options: EvaluateOptions, aggregates: unknown[]): Promise<void> => {
	console.log("\n  Evaluating claims...");

	// Select claims to evaluate
	let claims = THESIS_CLAIMS;

	if (options.claim) {
		claims = claims.filter((c) => c.claimId === options.claim);
		if (claims.length === 0) {
			console.log(`  Warning: Claim '${options.claim}' not found.`);
			return;
		}
	} else if (options.tags && options.tags.length > 0) {
		claims = options.tags.flatMap((tag) => getClaimsByTag(tag));
		// Deduplicate
		claims = [...new Map(claims.map((c) => [c.claimId, c])).values()];
	}

	if (claims.length === 0) {
		claims = getCoreClaims();
	}

	console.log(`  Evaluating ${claims.length} claims...`);

	const evaluations = evaluateClaims(claims, aggregates as never[]);
	const summary = createClaimSummary(evaluations);

	// Write claim evaluation results
	const aggregateDir = resolve(options.outputDir, "aggregate");
	const claimsFile = resolve(aggregateDir, "claim-evaluation.json");
	writeFileSync(claimsFile, JSON.stringify(summary, null, 2), "utf-8");

	console.log(`  Claim evaluation written to: ${claimsFile}`);
	console.log(`    Satisfied: ${summary.summary.satisfied}`);
	console.log(`    Violated: ${summary.summary.violated}`);
	console.log(`    Inconclusive: ${summary.summary.inconclusive}`);
	console.log(`    Satisfaction rate: ${(summary.summary.satisfactionRate * 100).toFixed(1)}%`);
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
	const aggregateDir = resolve(options.outputDir, "aggregate");
	const aggregatedFile = resolve(aggregateDir, "aggregated-results.json");

	if (!existsSync(aggregatedFile)) {
		throw new Error("Aggregated results not found. Run --phase=aggregate first.");
	}

	const outputText = await read(aggregatedFile);
	const aggregationOutput = JSON.parse(outputText);
	const aggregates = aggregationOutput.aggregates;

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
	const renderDir = resolve(options.outputDir, "render", "latex");
	if (!existsSync(renderDir)) {
		mkdirSync(renderDir, { recursive: true });
	}

	const outputs = renderer.renderAll(aggregates, tableSpecs);

	for (const output of outputs) {
		const outputFile = resolve(renderDir, output.filename);
		writeFileSync(outputFile, output.content, "utf-8");
		console.log(`  - ${output.filename}`);
	}

	console.log(`\nTables written to: ${renderDir}`);

	// Render claim summary if available
	const claimsFile = resolve(aggregateDir, "claim-evaluation.json");
	if (existsSync(claimsFile)) {
		console.log("\nRendering claim summary...");

		const claimsText = await read(claimsFile);
		const claimSummary = JSON.parse(claimsText);

		const claimOutput = renderer.renderClaimSummary(claimSummary.evaluations);
		const claimSummaryFile = resolve(renderDir, claimOutput.filename);
		writeFileSync(claimSummaryFile, claimOutput.content, "utf-8");

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
	const checkpointPath = resolve(options.outputDir, "execute/checkpoint.json");

	// Check if checkpoint exists
	try {
		const { readFile } = await import("node:fs/promises");
		const content = await readFile(checkpointPath, "utf-8");
		const checkpoint = JSON.parse(content);

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
			const workerCount = execSync("ps aux | grep 'cli.js evaluate' | grep -v grep | wc -l", { encoding: "utf-8" }).trim();
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
			const result = results[String(runId)] as EvaluationResult | undefined;
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
		if (checkpoint.createdAt) {
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

		// Initialize registries
		const sutRegistry = registerExpansionSuts(new SUTRegistry());
		const caseRegistry: GraphCaseRegistry = await registerCases(new CaseRegistry());

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
	return readFile(path, "utf-8");
};

/**
 * Run the evaluate command from parsed arguments.
 * @param arguments_
 */
export const runEvaluate = (arguments_: ParsedArguments): void => {
	const options = parseEvaluateArgs(arguments_);
	void executeEvaluate(options);
};
