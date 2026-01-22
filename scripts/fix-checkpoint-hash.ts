#!/usr/bin/env tsx
/**
 * Compute correct checkpoint hash from actual SUT and case definitions
 */

import { createHash } from "node:crypto";

// SUT definitions from the evaluation framework
const suts = [
	{ id: "degree-prioritised", version: "v1.0.0" },
	{ id: "standard-bfs", version: "v1.0.0" },
	{ id: "frontier-balanced", version: "v1.0.0" },
	{ id: "random-priority", version: "v1.0.0" },
];

// Case definitions from the evaluation framework (33 cases)
const cases = [
	{ id: "karate-club-ego-graph", version: "1.0.0" },
	{ id: "karate-club-bidirectional", version: "1.0.0" },
	{ id: "karate-club-multi-seed-3", version: "1.0.0" },
	{ id: "les-miserables-ego-graph", version: "1.0.0" },
	{ id: "les-miserables-bidirectional", version: "1.0.0" },
	{ id: "les-miserables-multi-seed-3", version: "1.0.0" },
	{ id: "facebook-ego-graph", version: "1.0.0" },
	{ id: "facebook-bidirectional", version: "1.0.0" },
	{ id: "facebook-multi-seed-3", version: "1.0.0" },
	{ id: "cora-ego-graph", version: "1.0.0" },
	{ id: "cora-bidirectional", version: "1.0.0" },
	{ id: "cora-multi-seed-3", version: "1.0.0" },
	{ id: "citeseer-ego-graph", version: "1.0.0" },
	{ id: "citeseer-bidirectional", version: "1.0.0" },
	{ id: "citeseer-multi-seed-3", version: "1.0.0" },
	{ id: "ca-astroph-ego-graph", version: "1.0.0" },
	{ id: "ca-astroph-bidirectional", version: "1.0.0" },
	{ id: "ca-astroph-multi-seed-3", version: "1.0.0" },
	{ id: "ca-condmat-ego-graph", version: "1.0.0" },
	{ id: "ca-condmat-bidirectional", version: "1.0.0" },
	{ id: "ca-condmat-multi-seed-3", version: "1.0.0" },
	{ id: "ca-hepph-ego-graph", version: "1.0.0" },
	{ id: "ca-hepph-bidirectional", version: "1.0.0" },
	{ id: "ca-hepph-multi-seed-3", version: "1.0.0" },
	{ id: "cit-hepph-ego-graph", version: "1.0.0" },
	{ id: "cit-hepph-bidirectional", version: "1.0.0" },
	{ id: "cit-hepph-multi-seed-3", version: "1.0.0" },
	{ id: "cit-hepth-ego-graph", version: "1.0.0" },
	{ id: "cit-hepth-bidirectional", version: "1.0.0" },
	{ id: "cit-hepth-multi-seed-3", version: "1.0.0" },
	{ id: "dblp-ego-graph", version: "1.0.0" },
	{ id: "dblp-bidirectional", version: "1.0.0" },
	{ id: "dblp-multi-seed-3", version: "1.0.0" },
];

// Executor config from the evaluation framework
const executorConfig = {
	repetitions: 1,
	seedBase: 42,
	timeoutMs: 300000,
};

// Total runs = 4 SUTs × 33 cases × 1 repetition
const totalRuns = 132;

// Compute the hash using the same algorithm as CheckpointManager.computeConfigHash
const signature = {
	suts: suts.map((s) => ({
		id: s.id,
		version: s.version,
	})),
	cases: cases.map((c) => ({
		id: c.id,
		version: c.version,
	})),
	executorConfig,
	totalRuns,
};

const hash = createHash("sha256")
	.update(JSON.stringify(signature))
	.digest("hex")
	.slice(0, 16);

console.log("Computed checkpoint hash:", hash);
console.log("Current stored hash:   4b97b40a7f6bd4d5");
console.log("\nSignature:");
console.log(JSON.stringify(signature, null, 2));
