/**
 * Checkpoint Manager for Experiment Execution
 *
 * Enables resumable experiment execution by:
 * 1. Writing incremental checkpoints after each completed run
 * 2. Detecting configuration changes to invalidate stale checkpoints
 * 3. Skipping completed runs when resuming
 *
 * Supports pluggable storage backends:
 * - FileStorage: JSON files (fast, local)
 * - GitStorage: Git notes (version controlled, shareable)
 *
 * Usage:
 * ```typescript
 * // File-based (default)
 * const checkpoint = new CheckpointManager("results/execute/checkpoint.json");
 *
 * // Git-based
 * const gitCheckpoint = new CheckpointManager("git:results-execute");
 *
 * // Explicit mode
 * const checkpoint = new CheckpointManager({
 *   mode: "git",
 *   namespace: "results-execute"
 * });
 *
 * await checkpoint.load();
 *
 * if (checkpoint.isStale(suts, cases, config)) {
 *   checkpoint.invalidate();
 * }
 *
 * const remainingRuns = plannedRuns.filter(
 *   run => !checkpoint.isCompleted(run.runId)
 * );
 *
 * executor.execute({...}, {
 *   onResult: (result) => checkpoint.recordResult(result)
 * });
 *
 * await checkpoint.save();
 * ```
 */

import { createHash } from "node:crypto";

import type { CaseDefinition } from "../types/case.js";
import type { EvaluationResult } from "../types/result.js";
import type { SutDefinition } from "../types/sut.js";
import type { CheckpointMode,CheckpointStorage  } from "./checkpoint-storage.js";
import { createCheckpointStorage, getGitNamespace } from "./checkpoint-storage.js";
import type { ExecutorConfig, PlannedRun } from "./executor.js";

// Re-export types for convenience
export type { CheckpointMode } from "./checkpoint-storage.js";

/**
 * Checkpoint file format.
 */
export interface CheckpointData {
	/** Hash of the execution configuration (SUTs, cases, config) */
	configHash: string;

	/** Timestamp when checkpoint was created */
	createdAt: string;

	/** Timestamp of last update */
	updatedAt: string;

	/** IDs of completed runs (for quick lookup) */
	completedRunIds: string[];

	/** Stored results by run ID */
	results: Record<string, EvaluationResult>;

	/** Total number of planned runs */
	totalPlanned: number;

	/** Git commit at checkpoint time (for reproducibility) */
	gitCommit?: string;
}

/**
 * Configuration signature for hashing.
 */
interface ConfigSignature {
	/** SUT identifiers and versions */
	suts: Array<{ id: string; version: string }>;

	/** Case identifiers and versions */
	cases: Array<{ id: string; version: string }>;

	/** Execution configuration */
	executorConfig: {
		repetitions: number;
		seedBase: number;
		timeoutMs: number;
	};

	/** Total planned runs */
	totalRuns: number;
}

/**
 * Checkpoint manager options.
 */
export interface CheckpointManagerOptions {
	/** Storage mode: "file", "git", or "auto" */
	mode?: CheckpointMode;

	/** File path (for file mode) or namespace (for git mode) */
	pathOrNamespace?: string;

	/** Git repository root (for git mode) */
	repoRoot?: string;
}

/**
 * Parse checkpoint location string.
 * Supports formats:
 * - "path/to/file.json" -> file mode
 * - "git:namespace" -> git mode
 * - "file:path" -> explicit file mode
 * - { mode: "git", namespace: "results-execute" } -> options object
 * @param location
 */
const parseCheckpointLocation = (location: string | CheckpointManagerOptions): CheckpointManagerOptions => {
	if (typeof location !== "string") {
		return location;
	}

	// Check for git:namespace format
	if (location.startsWith("git:")) {
		return {
			mode: "git",
			pathOrNamespace: location.slice(4),
		};
	}

	// Check for file:path format
	if (location.startsWith("file:")) {
		return {
			mode: "file",
			pathOrNamespace: location.slice(5),
		};
	}

	// Default to file mode with path
	return {
		mode: "file",
		pathOrNamespace: location,
	};
};

/**
 * Module-level lock for sequential checkpoint saves.
 * Prevents corruption when multiple workers try to save concurrently.
 */
const saveLock = {
	locked: false,
	queue: [] as Array<() => void>,

	async acquire(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (!this.locked) {
				this.locked = true;
				resolve();
			} else {
				this.queue.push(resolve);
			}
		});
	},

	release(): void {
		const next = this.queue.shift();
		if (next) {
			next();
		} else {
			this.locked = false;
		}
	},
};

/**
 * Checkpoint manager for resumable execution.
 */
export class CheckpointManager {
	private readonly storage: CheckpointStorage;
	private data: CheckpointData | null = null;
	private dirty = false;

	constructor(location: string | CheckpointManagerOptions = "results/execute/checkpoint.json") {
		const options = parseCheckpointLocation(location);

		// Auto-detect path/namespace if not provided
		let pathOrNamespace = options.pathOrNamespace;
		if (!pathOrNamespace) {
			pathOrNamespace = options.mode === "git" || options.mode === "auto" ? getGitNamespace("results/execute") : "results/execute/checkpoint.json";
		}

		this.storage = createCheckpointStorage(
			options.mode ?? "auto",
			pathOrNamespace,
			options.repoRoot
		);
	}

	/**
	 * Get the storage backend being used.
	 */
	getStorageType(): string {
		return this.storage.type;
	}

	/**
	 * Load checkpoint from storage if it exists.
	 * @returns true if checkpoint was loaded, false if not found or invalid
	 */
	async load(): Promise<boolean> {
		try {
			const loaded = await this.storage.load();
			if (loaded) {
				this.data = loaded;
				this.dirty = false;
				return true;
			}
			this.data = null;
			this.dirty = false;
			return false;
		} catch {
			this.data = null;
			this.dirty = false;
			return false;
		}
	}

	/**
	 * Save checkpoint to storage.
	 */
	async save(): Promise<void> {
		if (!this.dirty || !this.data) {
			return;
		}

		try {
			await this.storage.save(this.data);
			this.dirty = false;
		} catch (error) {
			console.warn(`Failed to save checkpoint: ${error}`);
		}
	}

	/**
	 * Save checkpoint incrementally (after each result).
	 * Uses storage backend's save mechanism.
	 * @param result
	 */
	async saveIncremental(result: EvaluationResult): Promise<void> {
		// Acquire lock to prevent concurrent writes
		await saveLock.acquire();
		try {
			if (!this.data) {
				this.initializeEmpty();
			}

			// Guard against null after initialization
			if (!this.data) {
				return;
			}

			// Record the result
			this.data.completedRunIds.push(result.run.runId);
			this.data.results[result.run.runId] = result;
			this.dirty = true;

			// Save immediately
			await this.save();
		} finally {
			saveLock.release();
		}
	}

	/**
	 * Check if checkpoint exists and is valid.
	 */
	exists(): boolean {
		return this.data !== null;
	}

	/**
	 * Check if a specific run has been completed.
	 * @param runId - Run identifier
	 */
	isCompleted(runId: string): boolean {
		return this.data?.completedRunIds.includes(runId) ?? false;
	}

	/**
	 * Get all completed results.
	 */
	getResults(): EvaluationResult[] {
		if (!this.data) {
			return [];
		}
		return Object.values(this.data.results);
	}

	/**
	 * Get progress information.
	 */
	getProgress(): { completed: number; total: number; percent: number } {
		if (!this.data) {
			return { completed: 0, total: 0, percent: 0 };
		}
		const completed = this.data.completedRunIds.length;
		const total = this.data.totalPlanned;
		const percent = total > 0 ? (completed / total) * 100 : 0;
		return { completed, total, percent: Math.round(percent) };
	}

	/**
	 * Check if checkpoint is stale (configuration has changed).
	 * @param suts - Current SUT definitions
	 * @param cases - Current case definitions
	 * @param config - Current executor config
	 * @param totalRuns - Total planned runs
	 */
	isStale<TExpander, TResult>(
		suts: SutDefinition<TExpander, TResult>[],
		cases: CaseDefinition<TExpander>[],
		config: Partial<ExecutorConfig>,
		totalRuns: number
	): boolean {
		if (!this.data) {
			return false; // No checkpoint, not stale
		}

		const currentHash = this.computeConfigHash(suts, cases, config, totalRuns);
		return this.data.configHash !== currentHash;
	}

	/**
	 * Invalidate checkpoint (delete and start fresh).
	 */
	invalidate(): void {
		this.data = null;
		this.dirty = true;
	}

	/**
	 * Initialize empty checkpoint data.
	 * @param suts
	 * @param cases
	 * @param config
	 * @param totalRuns
	 * @param gitCommit
	 */
	initializeEmpty<TExpander, TResult>(
		suts?: SutDefinition<TExpander, TResult>[],
		cases?: CaseDefinition<TExpander>[],
		config?: Partial<ExecutorConfig>,
		totalRuns?: number,
		gitCommit?: string
	): void {
		const configHash =
			suts && cases && config && totalRuns
				? this.computeConfigHash(suts, cases, config, totalRuns)
				: "pending";

		this.data = {
			configHash,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedRunIds: [],
			results: {},
			totalPlanned: totalRuns ?? 0,
			gitCommit,
		};
		this.dirty = true;
	}

	/**
	 * Compute hash of execution configuration.
	 * Used to detect when configuration changes invalidate checkpoint.
	 * @param suts
	 * @param cases
	 * @param config
	 * @param totalRuns
	 */
	private computeConfigHash<TExpander, TResult>(
		suts: SutDefinition<TExpander, TResult>[],
		cases: CaseDefinition<TExpander>[],
		config: Partial<ExecutorConfig>,
		totalRuns: number
	): string {
		const signature: ConfigSignature = {
			suts: suts.map((s) => ({
				id: s.registration.id,
				version: s.registration.version,
			})),
			cases: cases.map((c) => ({
				id: c.case.caseId,
				version: c.case.version ?? "1.0.0",
			})),
			executorConfig: {
				repetitions: config.repetitions ?? 1,
				seedBase: config.seedBase ?? 42,
				timeoutMs: config.timeoutMs ?? 0,
			},
			totalRuns,
		};

		return createHash("sha256")
			.update(JSON.stringify(signature))
			.digest("hex")
			.slice(0, 16);
	}

	/**
	 * Get remaining planned runs (excluding completed).
	 * @param plannedRuns - All planned runs
	 */
	filterRemaining<T extends PlannedRun>(plannedRuns: T[]): T[] {
		if (!this.data) {
			return plannedRuns;
		}
		const completedSet = new Set(this.data.completedRunIds);
		return plannedRuns.filter((run) => !completedSet.has(run.runId));
	}

	/**
	 * Merge new results into checkpoint (for batch updates).
	 * @param results - New results to add
	 */
	mergeResults(results: EvaluationResult[]): void {
		if (!this.data) {
			this.initializeEmpty();
		}

		// Guard against null after initialization
		if (!this.data) {
			return;
		}

		for (const result of results) {
			if (!this.data.completedRunIds.includes(result.run.runId)) {
				this.data.completedRunIds.push(result.run.runId);
				this.data.results[result.run.runId] = result;
			}
		}
		this.dirty = true;
	}

	/**
	 * Get checkpoint summary for logging.
	 */
	getSummary(): string {
		if (!this.data) {
			return "No checkpoint";
		}

		const progress = this.getProgress();
		return `Checkpoint: ${progress.completed}/${progress.total} runs (${progress.percent}%)`;
	}
}

/**
 * Get git commit hash for reproducibility.
 */
export const getGitCommit = async (): Promise<string | undefined> => {
	try {
		const { execSync } = await import("node:child_process");
		return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
	} catch {
		return undefined;
	}
};

/**
 * Create a checkpoint manager with default path.
 * @param location - Checkpoint location (path, git:namespace, or options)
 */
export const createCheckpointManager = (location: string | CheckpointManagerOptions = "results/execute/checkpoint.json"): CheckpointManager => new CheckpointManager(location);

/**
 * Create a file-based checkpoint manager.
 * @param path - Checkpoint file path
 */
export const createFileCheckpointManager = (path = "results/execute/checkpoint.json"): CheckpointManager => new CheckpointManager({ mode: "file", pathOrNamespace: path });

/**
 * Create a git-based checkpoint manager.
 * @param namespace - Git notes namespace (defaults to "results-execute")
 * @param repoRoot - Git repository root (defaults to process.cwd())
 */
export const createGitCheckpointManager = (namespace = "results-execute", repoRoot?: string): CheckpointManager => new CheckpointManager({ mode: "git", pathOrNamespace: namespace, repoRoot });
