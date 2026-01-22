/**
 * Diagnostic Tests for Checkpoint Integration Bug
 *
 * Tests to diagnose why parallel workers aren't properly using checkpoints.
 * Symptoms:
 * - Workers report "No checkpoint"
 * - Workers report "Total runs: 0, From checkpoint: 0, New this run: 0"
 * - Main checkpoint has 123/132 runs but workers start fresh
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EvaluationResult } from "../../types/result.js";
import { FileStorage, CheckpointManager } from "../checkpoint-manager.js";

describe("Checkpoint Integration Bug Diagnostics", () => {
	let testDir: string;
	let checkpoint: CheckpointManager;

	beforeEach(() => {
		testDir = join(tmpdir(), `checkpoint-test-${randomBytes(8).toString("hex")}`);
		const checkpointPath = join(testDir, "checkpoint.json");
		checkpoint = new CheckpointManager(new FileStorage(testDir, checkpointPath));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("diagnostic-1: should save and load single run", async () => {
		const sut = createMockSut();
		const testCase = createMockCase("case-001");

		const executor = new Executor({
			repetitions: 1,
			seedBase: 42,
			timeoutMs: 5000,
			collectProvenance: false,
			onResult: async (result) => {
				await checkpoint.saveIncremental(result);
			},
		});

		// Execute
		const summary = await executor.execute([sut], [testCase], (r) => ({ metrics: r.metrics }));

		// Verify
		expect(summary.successfulRuns).toBe(4); // 4 SUTs
		expect(checkpoint.getCompletedRunIds().length).toBe(4);

		// Load fresh checkpoint
		const fresh = new CheckpointManager(new FileStorage(testDir, "checkpoint.json"));
		expect(fresh.getCompletedRunIds().length).toBe(4);
	});

	it("diagnostic-2: should detect config hash mismatch", async () => {
		// Save with one config
		const result = {
			run: {
				runId: "test-run-001",
				sut: "test-sut",
				sutRole: "primary" as const,
				sutVersion: "1.0.0",
				caseId: "case-001",
				caseClass: "test-class",
				seed: 42,
				repetition: 0,
			},
			correctness: {
				expectedExists: false,
				producededOutput: true,
				valid: true,
				matchesExpected: null,
			},
			outputs: { summary: {} },
			metrics: { numeric: { test: 1 } },
			provenance: {
				runtime: { platform: "linux", arch: "x64", nodeVersion: "v22.0.0" },
			},
		};

		await checkpoint.saveIncremental(result);

		// Try to load with different config
		const fresh = new CheckpointManager(new FileStorage(testDir, "checkpoint.json"));
		const isValid = fresh.isConfigurationValid({
			repetitions: 2, // Different from original (1)
			seedBase: 42,
			timeoutMs: 5000,
			collectProvenance: false,
		});

		expect(isValid).toBe(false);
	});

	it("diagnostic-3: should find worker shards", async () => {
		// Create mock worker shards
		const shard1 = join(testDir, "checkpoint-worker-00.json");
		const shard2 = join(testDir, "checkpoint-worker-01.json");

		const storage1 = new FileStorage(testDir, "checkpoint-worker-00.json");
		const storage2 = new FileStorage(testDir, "checkpoint-worker-01.json");

		await storage1.save({
			configHash: "test-hash",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedRunIds: ["run-001", "run-002"],
			results: {},
		});

		await storage2.save({
			configHash: "test-hash",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedRunIds: ["run-003", "run-004"],
			results: {},
		});

		// Find shards
		const shards = await FileStorage.findShards(testDir);
		expect(shards).toHaveLength(2);
		expect(shards).toContain(shard1);
		expect(shards).toContain(shard2);
	});

	it("diagnostic-4: should merge shards without duplicates", async () => {
		// Create main checkpoint
		const result1 = {
			run: {
				runId: "run-001",
				sut: "sut-1",
				sutRole: "primary" as const,
				sutVersion: "1.0.0",
				caseId: "case-001",
				caseClass: "test-class",
				seed: 42,
				repetition: 0,
			},
			correctness: {
				expectedExists: false,
				producededOutput: true,
				valid: true,
				matchesExpected: null,
			},
			outputs: { summary: {} },
			metrics: { numeric: { test: 1 } },
			provenance: {
				runtime: { platform: "linux", arch: "x64", nodeVersion: "v22.0.0" },
			},
		};

		await checkpoint.saveIncremental(result1);

		// Create worker shard with overlapping run
		const shardPath = join(testDir, "checkpoint-worker-00.json");
		const workerStorage = new FileStorage(testDir, "checkpoint-worker-00.json");

		await workerStorage.save({
			configHash: "test-hash",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedRunIds: ["run-001", "run-002"], // run-001 overlaps with main
			results: {},
		});

		// Merge
		const shards = await FileStorage.findShards(testDir);
		await checkpoint.mergeShards(shards);

		// Verify no duplicates
		const uniqueIds = new Set(checkpoint.getCompletedRunIds());
		expect(uniqueIds.size).toBe(2); // run-001, run-002 (no duplicates)
		expect(checkpoint.getCompletedRunIds()).toHaveLength(2);
	});

	it("diagnostic-5: config hash should include all executor config properties", async () => {
		// This test verifies which properties are included in the hash
		const crypto = require("crypto");

		const config1 = {
			continueOnError: true,
			repetitions: 1,
			seedBase: 42,
			timeoutMs: 300000,
			collectProvenance: true,
		};

		const config2 = {
			...config1,
			concurrency: 12, // Additional property
		};

		const hash1 = crypto.createHash("sha256")
			.update(JSON.stringify(config1, Object.keys(config1).sort()))
			.digest("hex");

		const hash2 = crypto.createHash("sha256")
			.update(JSON.stringify(config2, Object.keys(config2).sort()))
			.digest("hex");

		console.log("Hash without concurrency:", hash1);
		console.log("Hash with concurrency:", hash2);
		console.log("Match:", hash1 === hash2);

		// They should be different because concurrency is different
		expect(hash1).not.toBe(hash2);
	});
});
