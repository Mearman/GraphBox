#!/usr/bin/env tsx
/**
 * Investigation: Salience Coverage 0% Root Cause
 *
 * Reproduces the karate club experiment (seeds 1 & 34) to demonstrate
 * the difference between:
 * 1. Paths discovered during expansion (frontier intersection)
 * 2. Paths enumerated retroactively through the sampled subgraph
 *
 * This script validates that the 0% coverage was methodological, not algorithmic.
 */

import { DegreePrioritisedExpansion } from "../src/algorithms/traversal/degree-prioritised-expansion.js";
import { BenchmarkGraphExpander } from "../src/experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../src/experiments/evaluation/fixtures/index.js";
import {
	computeSalienceCoverage,
	computeSalienceGroundTruth,
	pathSignature,
} from "../src/experiments/evaluation/metrics/salience-coverage.js";
import { retroactivePathEnumeration } from "../src/experiments/baselines/retroactive-path-enum.js";

/**
 * Run the investigation on Karate Club network
 */
const investigate = async () => {
	console.log("=".repeat(80));
	console.log("SALIENCE MISMATCH INVESTIGATION");
	console.log("=".repeat(80));
	console.log();

	// Load the Karate Club network
	console.log("Loading Karate Club network...");
	const benchmark = await loadBenchmarkByIdFromUrl("karate");
	const { graph, meta } = benchmark;
	const seeds = ["1", "34"]; // Opposite factions
	const topK = 10;

	console.log(`  Nodes: ${graph.getAllNodes().length}`);
	console.log(`  Edges: ${graph.getAllEdges().length}`);
	console.log(`  Seeds: ${seeds.join(", ")}`);
	console.log();

	// Step 1: Compute ground truth (top-K salient paths)
	console.log("Step 1: Computing ground truth salient paths...");
	const groundTruth = computeSalienceGroundTruth(graph, seeds, {
		topK,
		lambda: 0,
		traversalMode: meta.directed ? "directed" : "undirected",
	});

	console.log(`  Ground truth size: ${groundTruth.size} paths`);
	console.log(`  Top-K salient paths:`);
	for (const pathSig of Array.from(groundTruth).slice(0, 10)) {
		console.log(`    ${pathSig}`);
	}
	console.log();

	// Step 2: Run expansion method
	console.log("Step 2: Running Degree-Prioritised Expansion...");
	const expander = new BenchmarkGraphExpander(graph, meta.directed);
	const algo = new DegreePrioritisedExpansion(expander, seeds);
	const result = await algo.run();

	console.log(`  Nodes expanded: ${result.sampledNodes.size}`);
	console.log(`  Paths discovered: ${result.paths.length}`);
	console.log();

	// Step 3: Show discovered paths
	console.log("Step 3: Discovered paths:");
	for (const p of result.paths.slice(0, 10)) {
		const sig = pathSignature(p.nodes);
		console.log(`    ${sig}`);
	}
	console.log();

	// Step 4: Compute overlap
	console.log("Step 4: Computing overlap...");
	const coverage = computeSalienceCoverage(result.paths, groundTruth);

	console.log(`  Salience coverage: ${(coverage["salience-coverage"] * 100).toFixed(1)}%`);
	console.log(`  Found/Total: ${coverage["top-k-found"]}/${coverage["top-k-total"]}`);
	console.log(`  Precision: ${(coverage["salience-precision"] * 100).toFixed(1)}%`);
	console.log();

	// Step 5: Analyze why they don't overlap
	console.log("Step 5: Analysis - Why don't they overlap?");
	console.log();

	// Convert discovered paths to signatures for comparison
	const discoveredSigs = new Set(result.paths.map((p) => pathSignature(p.nodes)));

	console.log("Checking each ground truth path:");
	for (const truthSig of Array.from(groundTruth).slice(0, 10)) {
		const found = discoveredSigs.has(truthSig);
		const nodes = truthSig.split("->");
		console.log(`  ${found ? "✓" : "✗"} ${truthSig} (length: ${nodes.length})`);

		if (!found) {
			// Check if all nodes in the path are in the expanded subgraph
			const allNodesExpanded = nodes.every((nodeId) => result.sampledNodes.has(nodeId));
			console.log(`    - All nodes in subgraph: ${allNodesExpanded}`);

			if (allNodesExpanded) {
				console.log(`    - PROBLEM: Path nodes exist but path wasn't enumerated`);
			} else {
				const missingNodes = nodes.filter((nodeId) => !result.sampledNodes.has(nodeId));
				console.log(`    - Missing nodes: ${missingNodes.join(", ")}`);
			}
		}
	}
	console.log();

	// Step 6: Apply retroactive path enumeration (THE FIX)
	console.log("Step 6: Applying retroactive path enumeration...");
	const { paths: enumeratedPaths } = await retroactivePathEnumeration(
		result,
		expander,
		seeds,
		10, // maxLength
	);
	console.log(`  Enumerated ${enumeratedPaths.length} paths through sampled subgraph`);
	console.log();

	// Step 7: Compute coverage AFTER retroactive enumeration
	console.log("Step 7: Computing coverage AFTER retroactive enumeration...");
	const coverageAfter = computeSalienceCoverage(enumeratedPaths, groundTruth);

	console.log(
		`  Salience coverage: ${(coverageAfter["salience-coverage"] * 100).toFixed(1)}%`,
	);
	console.log(
		`  Found/Total: ${coverageAfter["top-k-found"]}/${coverageAfter["top-k-total"]}`,
	);
	console.log(
		`  Precision: ${(coverageAfter["salience-precision"] * 100).toFixed(1)}%`,
	);
	console.log();

	// Step 8: Path length distribution comparison
	console.log("Step 8: Path length distribution:");
	const groundTruthLengths = Array.from(groundTruth).map(
		(sig) => sig.split("->").length,
	);
	const discoveredLengths = result.paths.map((p) => p.nodes.length);
	const enumeratedLengths = enumeratedPaths.map((p) => p.nodes.length);

	console.log(
		`  Ground truth: min=${Math.min(...groundTruthLengths)}, max=${Math.max(...groundTruthLengths)}, avg=${(groundTruthLengths.reduce((a, b) => a + b, 0) / groundTruthLengths.length).toFixed(1)}`,
	);
	if (discoveredLengths.length > 0) {
		console.log(
			`  Discovered:   min=${Math.min(...discoveredLengths)}, max=${Math.max(...discoveredLengths)}, avg=${(discoveredLengths.reduce((a, b) => a + b, 0) / discoveredLengths.length).toFixed(1)}`,
		);
	} else {
		console.log("  Discovered:   (none)");
	}
	console.log(
		`  Enumerated:   min=${Math.min(...enumeratedLengths)}, max=${Math.max(...enumeratedLengths)}, avg=${(enumeratedLengths.reduce((a, b) => a + b, 0) / enumeratedLengths.length).toFixed(1)}`,
	);
	console.log();

	console.log("=".repeat(80));
	console.log("SUMMARY");
	console.log("=".repeat(80));
	console.log(
		`Coverage BEFORE fix: ${(coverage["salience-coverage"] * 100).toFixed(1)}%`,
	);
	console.log(
		`Coverage AFTER fix:  ${(coverageAfter["salience-coverage"] * 100).toFixed(1)}%`,
	);
	console.log();

	if (coverage["salience-coverage"] === 0 && coverageAfter["salience-coverage"] > 0) {
		console.log("✓ FIX VALIDATED: Retroactive enumeration resolves 0% coverage");
		console.log(
			"  The 0% coverage was due to methodological error, not algorithm failure",
		);
	} else if (
		coverage["salience-coverage"] === 0 &&
		coverageAfter["salience-coverage"] === 0
	) {
		console.log(
			"WARNING: Issue persists - Even retroactive enumeration finds 0% coverage",
		);
		console.log(
			"  This suggests expansion doesn't sample nodes on high-salience paths",
		);
	} else {
		console.log("SUCCESS: No issue detected (coverage was already >0%)");
	}

	console.log("=".repeat(80));
};

// Run the investigation
investigate().catch(console.error);
