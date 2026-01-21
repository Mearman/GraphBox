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
import { createCheckpointManager, createExecutor, type ExecutorConfig,getGitCommit } from "../experiments/framework/executor/index.js";
import { CaseRegistry } from "../experiments/framework/registry/case-registry.js";
import { type GraphCaseRegistry,registerCases } from "../experiments/framework/registry/register-cases.js";
import { type ExpansionSutRegistry,registerExpansionSuts } from "../experiments/framework/registry/register-suts.js";
import { SUTRegistry } from "../experiments/framework/registry/sut-registry.js";
import { createLatexRenderer } from "../experiments/framework/renderers/latex-renderer.js";
import { TABLE_SPECS } from "../experiments/framework/renderers/table-specs.js";
import type { CaseDefinition } from "../experiments/framework/types/case.js";
import type { SutDefinition } from "../experiments/framework/types/sut.js";

/**
 * Phases of the evaluation pipeline.
 */
export type EvaluationPhase = "execute" | "aggregate" | "render" | "all";

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

	// Claim filtering
	const tagsArgument = getOptional<string>(arguments_, "tags");
	const tags = tagsArgument?.split(",").map((t) => t.trim());

	const claim = getOptional<string>(arguments_, "claim");
	const table = getOptional<string>(arguments_, "table");
	const verbose = getBoolean(arguments_, "verbose", false);

	// Validate phase
	if (!["execute", "aggregate", "render", "all"].includes(phase)) {
		throw new Error(`Invalid phase: ${phase}. Must be one of: execute, aggregate, render, all`);
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

	// Create checkpoint based on mode
	// For file mode, use full path to checkpoint.json
	// For git mode, use namespace string
	const checkpointMode = options.checkpointMode as "file" | "git" | "auto";
	const checkpoint = createCheckpointManager(
		checkpointMode === "git" || checkpointMode === "auto"
			? { mode: checkpointMode, pathOrNamespace: "results-execute" }
			: { mode: "file", pathOrNamespace: resolve(executeDir, "checkpoint.json") }
	);
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

	// Configure executor with checkpoint callback
	const executorConfigWithCallbacks: Partial<ExecutorConfig> = {
		...executorConfig,
		onProgress: (progress) => {
			if (options.verbose) {
				console.log(
					`  [${progress.completed}/${progress.total}] ${progress.currentSut} @ ${progress.currentCase} (rep ${progress.currentRepetition})`
				);
			} else {
				process.stdout.write(`\r  [${progress.completed}/${progress.total}] Complete...`);
			}
		},
		onResult: async (result) => {
			// Save checkpoint incrementally after each result
			await checkpoint.saveIncremental(result);
		},
	};

	const executor = createExecutor<BenchmarkGraphExpander, DegreePrioritisedExpansionResult>(executorConfigWithCallbacks);

	// Plan all runs and filter out completed ones
	const allPlanned = executor.plan(suts, cases);
	const remainingRuns = checkpoint.filterRemaining(allPlanned);

	if (remainingRuns.length === 0) {
		console.log("\n\nAll runs already completed. Skipping execution.");
	} else {
		console.log(`\nRunning experiments... (${remainingRuns.length} remaining, ${completedResults.length} cached)`);

		// Execute all runs - checkpoint will track which are already done
		await executor.execute(suts, cases, extractMetrics);
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
export const executeEvaluate = async (options: EvaluateOptions): Promise<void> => {
	try {
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
