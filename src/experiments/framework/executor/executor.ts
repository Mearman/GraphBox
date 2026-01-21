/**
 * Experiment Executor
 *
 * Orchestrates experiment execution across SUTs and cases.
 * Handles error isolation, progress reporting, and result collection.
 */

import { execSync } from "node:child_process";
import { arch, platform, version as nodeVersion } from "node:process";

import type { CaseDefinition, Primitive } from "../types/case.js";
import type { CorrectnessResult,EvaluationResult, Provenance } from "../types/result.js";
import type { SutDefinition } from "../types/sut.js";
import {generateRunId } from "./run-id.js";

/**
 * Configuration for experiment execution.
 */
export interface ExecutorConfig {
	/** Continue execution if a single run fails */
	continueOnError: boolean;

	/** Number of repetitions per case (for statistical analysis) */
	repetitions: number;

	/** Random seed base (incremented per repetition) */
	seedBase: number;

	/** Timeout per run in milliseconds (0 = no timeout) */
	timeoutMs: number;

	/** Whether to collect provenance information */
	collectProvenance: boolean;

	/** Progress callback */
	onProgress?: (progress: ExecutionProgress) => void;

	/** Per-run callback */
	onResult?: (result: EvaluationResult) => void;
}

/**
 * Default executor configuration.
 */
export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
	continueOnError: true,
	repetitions: 1,
	seedBase: 42,
	timeoutMs: 0,
	collectProvenance: true,
};

/**
 * Execution progress report.
 */
export interface ExecutionProgress {
	/** Total planned runs */
	total: number;

	/** Completed runs */
	completed: number;

	/** Failed runs */
	failed: number;

	/** Current SUT */
	currentSut?: string;

	/** Current case */
	currentCase?: string;

	/** Current repetition */
	currentRepetition?: number;

	/** Elapsed time in milliseconds */
	elapsedMs: number;
}

/**
 * Execution summary returned after completion.
 */
export interface ExecutionSummary {
	/** Total runs attempted */
	totalRuns: number;

	/** Successful runs */
	successfulRuns: number;

	/** Failed runs */
	failedRuns: number;

	/** Total elapsed time */
	elapsedMs: number;

	/** Results collected */
	results: EvaluationResult[];

	/** Errors encountered */
	errors: Array<{ runId: string; error: string }>;
}

/**
 * Execution plan for a single run.
 */
export interface PlannedRun {
	/** Deterministic run ID */
	runId: string;

	/** SUT to execute */
	sutId: string;

	/** Case to run against */
	caseId: string;

	/** Repetition number */
	repetition: number;

	/** Random seed */
	seed: number;

	/** Configuration overrides */
	config?: Record<string, unknown>;
}

/**
 * Get provenance information for reproducibility.
 * @param collectProvenance
 */
const getProvenance = (collectProvenance: boolean): Provenance => {
	if (!collectProvenance) {
		return {
			runtime: {
				platform: platform,
				arch: arch,
				nodeVersion: nodeVersion,
			},
		};
	}

	let gitCommit: string | undefined;
	let dirty = false;

	try {
		gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
		const status = execSync("git status --porcelain", { encoding: "utf-8" });
		dirty = status.length > 0;
	} catch {
		// Git not available or not a git repo
	}

	return {
		runtime: {
			platform: platform,
			arch: arch,
			nodeVersion: nodeVersion,
		},
		gitCommit,
		dirty,
		timestamp: new Date().toISOString(),
	};
};

/**
 * Experiment executor.
 */
export class Executor<TExpander, TResult> {
	private readonly config: ExecutorConfig;

	constructor(config: Partial<ExecutorConfig> = {}) {
		this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
	}

	/**
	 * Plan execution runs without executing.
	 *
	 * @param suts - SUTs to execute
	 * @param cases - Cases to run against
	 * @returns Array of planned runs
	 */
	plan(
		suts: SutDefinition<TExpander, TResult>[],
		cases: CaseDefinition<TExpander>[]
	): PlannedRun[] {
		const runs: PlannedRun[] = [];

		for (const sutDef of suts) {
			for (const caseDef of cases) {
				for (let rep = 0; rep < this.config.repetitions; rep++) {
					const seed = this.config.seedBase + rep;
					const runId = generateRunId({
						sutId: sutDef.registration.id,
						caseId: caseDef.case.caseId,
						seed,
						repetition: rep,
					});

					runs.push({
						runId,
						sutId: sutDef.registration.id,
						caseId: caseDef.case.caseId,
						repetition: rep,
						seed,
					});
				}
			}
		}

		return runs;
	}

	/**
	 * Execute all planned runs.
	 *
	 * @param suts - SUTs to execute
	 * @param cases - Cases to run against
	 * @param metricsExtractor - Function to extract metrics from result
	 * @returns Execution summary with all results
	 */
	async execute(
		suts: SutDefinition<TExpander, TResult>[],
		cases: CaseDefinition<TExpander>[],
		metricsExtractor: (result: TResult) => Record<string, number>
	): Promise<ExecutionSummary> {
		const startTime = performance.now();
		const results: EvaluationResult[] = [];
		const errors: Array<{ runId: string; error: string }> = [];

		const plannedRuns = this.plan(suts, cases);
		const sutMap = new Map(suts.map((s) => [s.registration.id, s]));
		const caseMap = new Map(cases.map((c) => [c.case.caseId, c]));

		let completed = 0;
		let failed = 0;

		for (const run of plannedRuns) {
			const sutDef = sutMap.get(run.sutId);
			const caseDef = caseMap.get(run.caseId);

			if (!sutDef || !caseDef) {
				errors.push({ runId: run.runId, error: "SUT or case not found" });
				failed++;
				continue;
			}

			// Report progress
			if (this.config.onProgress) {
				this.config.onProgress({
					total: plannedRuns.length,
					completed,
					failed,
					currentSut: run.sutId,
					currentCase: run.caseId,
					currentRepetition: run.repetition,
					elapsedMs: performance.now() - startTime,
				});
			}

			try {
				const result = await this.executeRun(
					run,
					sutDef,
					caseDef,
					metricsExtractor
				);
				results.push(result);

				if (this.config.onResult) {
					this.config.onResult(result);
				}

				completed++;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				errors.push({ runId: run.runId, error: errorMessage });
				failed++;

				if (!this.config.continueOnError) {
					throw error;
				}
			}
		}

		return {
			totalRuns: plannedRuns.length,
			successfulRuns: completed,
			failedRuns: failed,
			elapsedMs: performance.now() - startTime,
			results,
			errors,
		};
	}

	/**
	 * Execute a single run.
	 * @param run
	 * @param sutDef
	 * @param caseDef
	 * @param metricsExtractor
	 */
	private async executeRun(
		run: PlannedRun,
		sutDef: SutDefinition<TExpander, TResult>,
		caseDef: CaseDefinition<TExpander>,
		metricsExtractor: (result: TResult) => Record<string, number>
	): Promise<EvaluationResult> {
		const runStartTime = performance.now();

		// Create expander for this case
		const expander = await caseDef.createExpander(caseDef.case.inputs);

		// Get seeds
		const seeds = caseDef.getSeeds(caseDef.case.inputs);

		// Create SUT instance
		const sutInstance = sutDef.factory(expander, seeds, run.config);

		// Execute
		const sutResult = await sutInstance.run();

		const executionTimeMs = performance.now() - runStartTime;

		// Extract metrics
		const metrics = metricsExtractor(sutResult);

		// Build correctness result (basic - can be extended)
		const correctness: CorrectnessResult = {
			expectedExists: caseDef.case.expectedOutput !== undefined,
			producedOutput: sutResult !== null && sutResult !== undefined,
			valid: true, // Assume valid if no exception
			matchesExpected: null, // Would need comparison logic
		};

		// Build provenance
		const provenance = getProvenance(this.config.collectProvenance);
		provenance.executionTimeMs = executionTimeMs;

		return {
			run: {
				runId: run.runId,
				sut: run.sutId,
				sutRole: sutDef.registration.role,
				sutVersion: sutDef.registration.version,
				caseId: run.caseId,
				caseClass: caseDef.case.caseClass,
				config: run.config as Record<string, Primitive> | undefined,
				seed: run.seed,
				repetition: run.repetition,
			},
			correctness,
			outputs: {
				summary: {
					// Could extract from sutResult
				},
			},
			metrics: {
				numeric: metrics,
			},
			provenance,
		};
	}
}

/**
 * Create a default executor with standard configuration.
 * @param config
 */
export const createExecutor = <TExpander, TResult>(config?: Partial<ExecutorConfig>): Executor<TExpander, TResult> => new Executor(config);
