/**
 * Integration tests for CheckpointManager
 *
 * Tests end-to-end checkpoint operations with real file system.
 */

import { existsSync,rmSync,unlinkSync  } from "node:fs";
import { join } from "node:path";

import { afterEach,beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult , RunContext } from "../../types/result.js";
import { CheckpointManager, InMemoryLock } from "../checkpoint-manager.js";
import { FileStorage } from "../checkpoint-storage.js";

const TEST_DIR = join(process.cwd(), "test-checkpoints");

/**
 * Create a minimal valid EvaluationResult for testing.
 * @param runId
 */
const createTestResult = (runId: string): EvaluationResult => {
	const runContext: RunContext = {
		runId,
		sut: "test-sut",
		sutRole: "primary",
		caseId: "test-case",
		config: { repetitions: 1, seedBase: 42 },
	};

	return {
		run: runContext,
		correctness: {
			expectedExists: false,
			producedOutput: true,
			valid: true,
			matchesExpected: null,
		},
		outputs: {},
		metrics: { numeric: {} },
		provenance: {
			runtime: {
				platform: process.platform,
				arch: process.arch,
				nodeVersion: process.version,
			},
		},
	};
};

/**
 * Clean up test checkpoint files.
 * @param path
 */
const cleanupCheckpointFile = (path: string): void => {
	try {
		if (existsSync(path)) {
			unlinkSync(path);
		}
	} catch {
		// Ignore
	}
};

/**
 * Clean up test directory.
 */
const cleanupTestDir = (): void => {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// Ignore
	}
};

describe("CheckpointManager (Integration)", () => {
	beforeEach(() => {
		cleanupTestDir();
	});

	afterEach(() => {
		cleanupTestDir();
	});

	describe("End-to-end checkpoint lifecycle", () => {
		it("should create checkpoint, save results, load, and verify", async () => {
			const checkpointPath = join(TEST_DIR, "checkpoint.json");
			const storage = new FileStorage(checkpointPath);
			const lock = new InMemoryLock();
			const checkpoint = new CheckpointManager({ storage, lock });

			// Initially no checkpoint
			expect(await checkpoint.load()).toBe(false);
			expect(checkpoint.exists()).toBe(false);

			// Save a result
			const result1 = createTestResult("run1");
			await checkpoint.saveIncremental(result1);

			// Load checkpoint
			const loaded = await checkpoint.load();
			expect(loaded).toBe(true);
			expect(checkpoint.exists()).toBe(true);

			// Verify data
			expect(checkpoint.isCompleted("run1")).toBe(true);
			expect(checkpoint.getResults()).toHaveLength(1);

			// Save another result
			const result2 = createTestResult("run2");
			await checkpoint.saveIncremental(result2);

			// Reload and verify both results
			await checkpoint.load();
			expect(checkpoint.isCompleted("run1")).toBe(true);
			expect(checkpoint.isCompleted("run2")).toBe(true);
			expect(checkpoint.getResults()).toHaveLength(2);

			// Clean up
			cleanupCheckpointFile(checkpointPath);
		});

		it("should resume from checkpoint and save more results", async () => {
			const checkpointPath = join(TEST_DIR, "resume-checkpoint.json");
			const storage = new FileStorage(checkpointPath);
			const lock = new InMemoryLock();
			const checkpoint = new CheckpointManager({ storage, lock });

			// Save initial results
			await checkpoint.saveIncremental(createTestResult("run1"));
			await checkpoint.saveIncremental(createTestResult("run2"));

			// Create new checkpoint manager instance (simulating process restart)
			const storage2 = new FileStorage(checkpointPath);
			const checkpoint2 = new CheckpointManager({ storage: storage2, lock });
			await checkpoint2.load();

			// Verify existing data
			expect(checkpoint2.isCompleted("run1")).toBe(true);
			expect(checkpoint2.isCompleted("run2")).toBe(true);

			// Add more results
			await checkpoint2.saveIncremental(createTestResult("run3"));
			await checkpoint2.saveIncremental(createTestResult("run4"));

			// Final verification with yet another instance
			const storage3 = new FileStorage(checkpointPath);
			const checkpoint3 = new CheckpointManager({ storage: storage3, lock });
			await checkpoint3.load();

			expect(checkpoint3.getResults()).toHaveLength(4);
			expect(checkpoint3.isCompleted("run1")).toBe(true);
			expect(checkpoint3.isCompleted("run2")).toBe(true);
			expect(checkpoint3.isCompleted("run3")).toBe(true);
			expect(checkpoint3.isCompleted("run4")).toBe(true);

			// Clean up
			cleanupCheckpointFile(checkpointPath);
		});
	});

	describe("Multi-worker simulation", () => {
		it("should handle multiple workers writing to separate files", async () => {
			const workers = 3;
			const checkpoints: CheckpointManager[] = [];
			const checkpointPaths: string[] = [];

			// Create checkpoint managers for each worker
			for (let index = 0; index < workers; index++) {
				const path = join(TEST_DIR, `checkpoint-worker-${index}.json`);
				checkpointPaths.push(path);
				const storage = new FileStorage(path);
				const lock = new InMemoryLock();
				const checkpoint = new CheckpointManager({
					storage,
					lock,
					workerIndex: index,
					totalWorkers: workers,
					basePath: TEST_DIR,
				});
				checkpoints.push(checkpoint);
			}

			// Each worker saves different results
			await checkpoints[0].saveIncremental(createTestResult("run0"));
			await checkpoints[0].saveIncremental(createTestResult("run1"));
			await checkpoints[1].saveIncremental(createTestResult("run2"));
			await checkpoints[1].saveIncremental(createTestResult("run3"));
			await checkpoints[2].saveIncremental(createTestResult("run4"));
			await checkpoints[2].saveIncremental(createTestResult("run5"));

			// Verify each worker has their own data
			await checkpoints[0].load();
			expect(checkpoints[0].getResults()).toHaveLength(2);
			expect(checkpoints[0].isCompleted("run0")).toBe(true);
			expect(checkpoints[0].isCompleted("run1")).toBe(true);

			await checkpoints[1].load();
			expect(checkpoints[1].getResults()).toHaveLength(2);
			expect(checkpoints[1].isCompleted("run2")).toBe(true);
			expect(checkpoints[1].isCompleted("run3")).toBe(true);

			await checkpoints[2].load();
			expect(checkpoints[2].getResults()).toHaveLength(2);
			expect(checkpoints[2].isCompleted("run4")).toBe(true);
			expect(checkpoints[2].isCompleted("run5")).toBe(true);

			// Clean up
			for (const path of checkpointPaths) {
				cleanupCheckpointFile(path);
			}
		});
	});

	describe("Merge phase", () => {
		it("should merge multiple worker checkpoints into aggregate", async () => {
			const workers = 3;
			const checkpointPaths: string[] = [];

			// Create worker checkpoints
			for (let index = 0; index < workers; index++) {
				const path = join(TEST_DIR, `checkpoint-worker-${index}.json`);
				checkpointPaths.push(path);
				const storage = new FileStorage(path);
				const lock = new InMemoryLock();
				const checkpoint = new CheckpointManager({
					storage,
					lock,
					workerIndex: index,
					totalWorkers: workers,
					basePath: TEST_DIR,
				});

				// Initialize with config hash
				checkpoint.initializeEmpty([], [], { repetitions: 1 }, 6);

				// Save some results
				const baseIndex = index * 2;
				await checkpoint.saveIncremental(createTestResult(`run${baseIndex}`));
				await checkpoint.saveIncremental(createTestResult(`run${baseIndex + 1}`));
			}

			// Now merge them
			const mainPath = join(TEST_DIR, "checkpoint.json");
			const mainStorage = new FileStorage(mainPath);
			const mainCheckpoint = new CheckpointManager({
				storage: mainStorage,
				lock: new InMemoryLock(),
			});

			await mainCheckpoint.mergeShards(checkpointPaths);

			// Verify merged data
			expect(mainCheckpoint.exists()).toBe(true);
			expect(mainCheckpoint.getResults()).toHaveLength(6);
			expect(mainCheckpoint.isCompleted("run0")).toBe(true);
			expect(mainCheckpoint.isCompleted("run1")).toBe(true);
			expect(mainCheckpoint.isCompleted("run2")).toBe(true);
			expect(mainCheckpoint.isCompleted("run3")).toBe(true);
			expect(mainCheckpoint.isCompleted("run4")).toBe(true);
			expect(mainCheckpoint.isCompleted("run5")).toBe(true);

			// Clean up
			cleanupCheckpointFile(mainPath);
			for (const path of checkpointPaths) {
				cleanupCheckpointFile(path);
			}
		});

		it("should use FileStorage.findShards to discover worker checkpoints", async () => {
			const workers = 3;

			// Create worker checkpoints
			for (let index = 0; index < workers; index++) {
				const path = join(TEST_DIR, `checkpoint-worker-${index}.json`);
				const storage = new FileStorage(path);
				const lock = new InMemoryLock();
				const checkpoint = new CheckpointManager({
					storage,
					lock,
					workerIndex: index,
					totalWorkers: workers,
					basePath: TEST_DIR,
				});
				await checkpoint.saveIncremental(createTestResult(`run${index}`));
			}

			// Discover shards
			const shards = await FileStorage.findShards(TEST_DIR);
			expect(shards).toHaveLength(3);

			// Merge discovered shards
			const mainPath = join(TEST_DIR, "checkpoint.json");
			const mainStorage = new FileStorage(mainPath);
			const mainCheckpoint = new CheckpointManager({
				storage: mainStorage,
				lock: new InMemoryLock(),
			});

			await mainCheckpoint.mergeShards(shards);

			// Verify all results merged
			expect(mainCheckpoint.getResults()).toHaveLength(3);

			// Clean up
			cleanupCheckpointFile(mainPath);
			for (let index = 0; index < workers; index++) {
				cleanupCheckpointFile(join(TEST_DIR, `checkpoint-worker-${index}.json`));
			}
		});
	});

	describe("Progress tracking", () => {
		it("should calculate progress correctly", async () => {
			const checkpointPath = join(TEST_DIR, "progress-checkpoint.json");
			const storage = new FileStorage(checkpointPath);
			const lock = new InMemoryLock();
			const checkpoint = new CheckpointManager({ storage, lock });

			// Initialize with total planned and save to persist totalPlanned
			checkpoint.initializeEmpty([], [], { repetitions: 1 }, 10);
			await checkpoint.save();

			const progress1 = checkpoint.getProgress();
			expect(progress1.completed).toBe(0);
			expect(progress1.total).toBe(10);
			expect(progress1.percent).toBe(0);

			// Save some results
			await checkpoint.saveIncremental(createTestResult("run1"));
			await checkpoint.saveIncremental(createTestResult("run2"));
			await checkpoint.saveIncremental(createTestResult("run3"));

			// Reload and check progress
			await checkpoint.load();
			const progress2 = checkpoint.getProgress();
			expect(progress2.completed).toBe(3);
			expect(progress2.total).toBe(10);
			expect(progress2.percent).toBe(30);

			// Complete all
			for (let index = 4; index <= 10; index++) {
				await checkpoint.saveIncremental(createTestResult(`run${index}`));
			}

			await checkpoint.load();
			const progress3 = checkpoint.getProgress();
			expect(progress3.completed).toBe(10);
			expect(progress3.total).toBe(10);
			expect(progress3.percent).toBe(100);

			// Clean up
			cleanupCheckpointFile(checkpointPath);
		});
	});

	describe("Filter remaining runs", () => {
		it("should filter out completed runs", async () => {
			const checkpointPath = join(TEST_DIR, "filter-checkpoint.json");
			const storage = new FileStorage(checkpointPath);
			const lock = new InMemoryLock();
			const checkpoint = new CheckpointManager({ storage, lock });

			// Save some results
			await checkpoint.saveIncremental(createTestResult("run1"));
			await checkpoint.saveIncremental(createTestResult("run2"));
			await checkpoint.saveIncremental(createTestResult("run3"));

			// Reload
			await checkpoint.load();

			// Filter remaining
			const allRuns = [
				{ runId: "run1", sutId: "sut", caseId: "case", repetition: 0, seed: 1 },
				{ runId: "run2", sutId: "sut", caseId: "case", repetition: 0, seed: 2 },
				{ runId: "run3", sutId: "sut", caseId: "case", repetition: 0, seed: 3 },
				{ runId: "run4", sutId: "sut", caseId: "case", repetition: 0, seed: 4 },
				{ runId: "run5", sutId: "sut", caseId: "case", repetition: 0, seed: 5 },
			];

			const remaining = checkpoint.filterRemaining(allRuns);
			expect(remaining).toHaveLength(2);
			expect(remaining.map((r) => r.runId)).toEqual(["run4", "run5"]);

			// Clean up
			cleanupCheckpointFile(checkpointPath);
		});
	});
});
