#!/usr/bin/env tsx
/**
 * Framework-Based Experiment Runner
 *
 * Demonstrates the new evaluation framework with:
 * - Registry-based SUT and case management
 * - Deterministic run IDs
 * - Claim-driven evaluation
 * - Separated aggregation and rendering
 *
 * Usage:
 *   npx tsx src/experiments/framework/entry/run-framework-experiments.ts
 *   npx tsx src/experiments/framework/entry/run-framework-experiments.ts --output custom-metrics.json
 */

import { existsSync,mkdirSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getCoreClaims } from "../claims/registry.js";
import { CaseRegistry } from "../registry/case-registry.js";
import { registerCases } from "../registry/register-cases.js";
import { registerExpansionSuts } from "../registry/register-suts.js";
import { SUTRegistry } from "../registry/sut-registry.js";
import { TABLE_SPECS } from "../renderers/table-specs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../../..");

/**
 * Main experiment runner.
 */
const main = async (): Promise<void> => {
	console.log("╔════════════════════════════════════════════════════════════╗");
	console.log("║   GraphBox Evaluation Framework                            ║");
	console.log("║   Claim-Driven, Deterministic, Portable                    ║");
	console.log("╚════════════════════════════════════════════════════════════╝\n");

	// Parse arguments
	const arguments_ = process.argv.slice(2);
	const outputArgument = arguments_.find((a) => a.startsWith("--output="))?.split("=")[1];
	const outputDir = outputArgument ?? resolve(projectRoot, "src");

	// Ensure output directory exists
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	// Initialize registries
	console.log("1. Initializing registries...");
	const sutRegistry = registerExpansionSuts(new SUTRegistry());
	const caseRegistry = registerCases(new CaseRegistry());

	console.log(`   - ${sutRegistry.size} SUTs registered`);
	console.log(`   - ${caseRegistry.size} cases registered`);

	// List registered SUTs
	console.log("\n   SUTs:");
	for (const reg of sutRegistry.listRegistrations()) {
		console.log(`     - ${reg.id} (${reg.role})`);
	}

	console.log("\n2. Framework structure:");
	console.log("   - Types: EvaluationResult, AggregatedResult, EvaluationClaim");
	console.log("   - Registries: SUTRegistry, CaseRegistry");
	console.log("   - Executor: Deterministic run IDs, error isolation");
	console.log("   - Aggregation: computeSummaryStats, computeComparison");
	console.log("   - Claims: evaluateClaim, THESIS_CLAIMS");
	console.log("   - Rendering: LaTeXRenderer, TABLE_SPECS");

	// Show thesis claims
	console.log("\n3. Core thesis claims:");
	const coreClaims = getCoreClaims();
	for (const claim of coreClaims) {
		console.log(`   - ${claim.claimId}: ${claim.description}`);
	}

	// Show table specs
	console.log("\n4. Table specifications:");
	for (const spec of TABLE_SPECS) {
		console.log(`   - ${spec.id}: ${spec.filename}`);
	}

	console.log("\n5. Pipeline summary:");
	console.log("   Execute → Aggregate → Evaluate Claims → Render");
	console.log("   (Each stage produces serializable JSON artifacts)");

	console.log("\n✓ Framework initialization complete");
	console.log(`  Output directory: ${outputDir}`);
	console.log("\nTo run full experiments, use the legacy runner:");
	console.log("  npx tsx src/experiments/run-experiments.ts");
};

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
