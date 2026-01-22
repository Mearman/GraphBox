/**
 * Parallel executor using child processes.
 *
 * Spawns multiple Node.js processes, each executing a subset of runs.
 * Each worker writes to its own sharded checkpoint file to avoid race conditions.
 *
 * Sharded checkpoint files:
 *   results/execute/checkpoint-worker-00.json
 *   results/execute/checkpoint-worker-01.json
 *   ...
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpus } from "node:os";
import { resolve } from "node:path";

import type { EvaluationResult } from "../types/result.js";
import type { ExecutorConfig, PlannedRun } from "./executor.js";

export interface ParallelExecutorOptions {
	/** Number of parallel processes (default: CPU count) */
	workers?: number;

	/** Path to node executable */
	nodePath?: string;

	/** Checkpoint directory (defaults to "results/execute") */
	checkpointDir?: string;
}

/**
 * Generate random worker names using tech-themed adjectives.
 * Returns unique names for each worker.
 * @param count
 */
const generateWorkerNames = (count: number): string[] => {
	const adjectives = [
		"swift", "nimble", "quick", "brisk", "speedy", "rapid", "fast", "agile",
		"crisp", "snappy", "zippy", "flash", "bolt", "dash", "zoom", "jet",
		"rocket", "comet", "meteor", "star", "nova", "spark", "flare", "blaze",
		"quantum", "cyber", "digital", "pixel", "byte", "bit", "logic", "circuit",
	];
	const nouns = [
		"runner", "worker", "processor", "executor", "cruncher", "solver",
		"engine", "motor", "driver", "pilot", "agent", "bot", "node", "core",
	];

	// Generate unique names using random adjectives + nouns + hex suffix
	const usedNames = new Set<string>();
	const names: string[] = [];

	while (names.length < count) {
		const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
		const noun = nouns[Math.floor(Math.random() * nouns.length)];
		const suffix = randomBytes(2).toString("hex");
		const name = `${adj}-${noun}-${suffix}`;

		if (!usedNames.has(name)) {
			usedNames.add(name);
			names.push(name);
		}
	}

	return names;
};

/**
 * Generate sharded checkpoint path for a worker.
 *
 * @param checkpointDir - Base checkpoint directory
 * @param workerIndex - Worker index (0-based)
 * @returns Path to the worker's checkpoint file
 */
export const shardPath = (checkpointDir: string, workerIndex: number): string => resolve(checkpointDir, `checkpoint-worker-${String(workerIndex).padStart(2, "0")}.json`);

/**
 * Execute runs using multiple parallel processes.
 *
 * Each worker writes to its own sharded checkpoint file to avoid race conditions.
 * After all workers complete, the main process should merge the shards.
 *
 * @param runs - Planned runs to execute
 * @param suts - SUT definitions (not used directly, passed to workers)
 * @param cases - Case definitions (not used directly, passed to workers)
 * @param config - Executor configuration
 * @param options - Parallel executor options
 */
export const executeParallel = async (runs: PlannedRun[], suts: unknown, cases: unknown[], config: ExecutorConfig & { onResult?: (result: EvaluationResult) => void }, options: ParallelExecutorOptions = {}): Promise<{ results: EvaluationResult[]; errors: Array<{ runId: string; error: string }> }> => {
	const numberWorkers = options.workers ?? cpus().length;
	const nodePath = options.nodePath ?? process.execPath;
	const checkpointDir = options.checkpointDir ?? resolve(process.cwd(), "results/execute");

	console.log(`ParallelExecutor: Spawning ${numberWorkers} processes for ${runs.length} runs`);
	console.log(`Checkpoint directory: ${checkpointDir}`);

	// Generate unique names for each worker
	const workerNames = generateWorkerNames(numberWorkers);
	console.log(`Workers: ${workerNames.map((name, index) => `${index + 1}. ${name}`).join(", ")}`);

	// Split runs into batches
	const batchSize = Math.ceil(runs.length / numberWorkers);
	const batches: PlannedRun[][] = [];
	for (let index = 0; index < runs.length; index += batchSize) {
		batches.push(runs.slice(index, index + batchSize));
	}

	// Create a run filter function for each batch
	const runFilters = batches.map((batch, _index) => {
		const runIds = new Set(batch.map((r) => r.runId));
		return JSON.stringify([...runIds]);
	});

	// Spawn worker processes
	const workers = runFilters.map((runFilter, index) => {
		const workerName = workerNames[index];
		const workerCheckpointPath = shardPath(checkpointDir, index);

		const arguments_ = [
			resolve(process.cwd(), "dist/cli.js"),
			"evaluate",
			"--phase=execute",
			"--checkpoint-mode=file",
			`--run-filter=${runFilter}`,
		];

		return spawn(nodePath, arguments_, {
			stdio: "inherit",
			env: {
				...process.env,
				NODE_OPTIONS: "--max-old-space-size=4096",
				GRAPHBOX_WORKER_NAME: workerName,
				GRAPHBOX_WORKER_INDEX: index.toString(),
				GRAPHBOX_TOTAL_WORKERS: numberWorkers.toString(),
				GRAPHBOX_CHECKPOINT_DIR: checkpointDir,
				GRAPHBOX_CHECKPOINT_PATH: workerCheckpointPath,
			},
		});
	});

	// Wait for all workers to complete
	await Promise.all(workers.map((w) => new Promise((resolve) => {
		w.on("exit", (code) => resolve(code));
	})));

	// Load and return aggregated results
	// For now, return empty - the CLI will handle results and merge shards
	return { results: [], errors: [] };
};
