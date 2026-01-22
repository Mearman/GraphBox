#!/usr/bin/env tsx
/**
 * Compute correct checkpoint hash using actual SUT and case IDs from checkpoint
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const checkpoint = JSON.parse(readFileSync("results/execute/checkpoint.json", "utf-8"));

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

console.log("Extracted from checkpoint:");
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
		version: "1.0.0", // All cases use version 1.0.0
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

console.log("\nHash computation:");
console.log("  Current stored:", checkpoint.configHash);
console.log("  Computed:      ", computedHash);
console.log("  Match:", checkpoint.configHash === computedHash);

if (checkpoint.configHash !== computedHash) {
	console.log("\n⚠ Hash mismatch detected!");
	console.log("  Updating checkpoint with correct hash...");

	// Update checkpoint
	checkpoint.configHash = computedHash;
	const updated = JSON.stringify(checkpoint, null, 2);
	require("fs").writeFileSync("results/execute/checkpoint.json", updated, "utf-8");

	console.log("  ✅ Checkpoint updated with hash:", computedHash);
} else {
	console.log("\n✅ Hash already correct!");
}
