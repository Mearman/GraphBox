#!/usr/bin/env tsx
/**
 * Verify checkpoint hash is correct by extracting actual SUT/case IDs
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const checkpoint = JSON.parse(readFileSync("results/execute/checkpoint.json", "utf-8"));

console.log("✓ Checkpoint loaded");
console.log("  Config hash:", checkpoint.configHash);
console.log("  Completed runs:", checkpoint.completedRunIds.length);
console.log("  Total planned:", checkpoint.totalPlanned);

// Extract unique case IDs and SUT IDs from completed runs
const caseIds = new Set<string>();
const sutIds = new Set<string>();

for (const runId of checkpoint.completedRunIds) {
	const result = checkpoint.results[runId];
	if (result && result.run) {
		if (result.run.caseId) caseIds.add(result.run.caseId);
		if (result.run.sut) sutIds.add(result.run.sut);
	}
}

// Sort for consistent hashing
const sortedCases = Array.from(caseIds).sort();
const sortedSuts = Array.from(sutIds).sort();

console.log("\nExtracted from checkpoint:");
console.log("  SUTs:", sortedSuts.length);
console.log("  Cases:", sortedCases.length);

// Compute hash using actual SUT and case IDs
const signature = {
	suts: sortedSuts.map((id) => {
		const [name, version] = id.split("-v");
		return { id: name, version: `v${version}` };
	}),
	cases: sortedCases.map((id) => ({
		id,
		version: "1.0.0",
	})),
	executorConfig: {
		repetitions: 1,
		seedBase: 42,
		timeoutMs: 300000,
	},
	totalRuns: 132,
};

const computedHash = createHash("sha256")
	.update(JSON.stringify(signature))
	.digest("hex")
	.slice(0, 16);

console.log("\nHash verification:");
console.log("  Stored hash:   ", checkpoint.configHash);
console.log("  Computed hash: ", computedHash);

if (checkpoint.configHash === computedHash) {
	console.log("\n✅ Checkpoint is VALID - hash matches!");
	console.log("  Workers will now use the existing checkpoint");
} else {
	console.error("\n❌ Checkpoint hash MISMATCH");
	console.error("  Workers will invalidate the checkpoint");
	process.exit(1);
}
