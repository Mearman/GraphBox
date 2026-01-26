#!/usr/bin/env tsx
/**
 * Build-Time Registry Serialization Generator (Option 2)
 *
 * Generates worker-compatible SUT files from the registry at build time.
 * Reads SUT metadata and wrapper classes from register-ranking-suts.ts,
 * then outputs standalone files in dist/suts/ with createSut() exports.
 *
 * Usage:
 *   npx tsx scripts/generate-worker-suts-from-registry.ts
 *   pnpm build:registry-suts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

/**
 * SUT metadata extracted from registry.
 */
interface SutMetadata {
	id: string;
	name: string;
	version: string;
	role: string;
	config: Record<string, unknown>;
	tags: string[];
	description?: string;
}

/**
 * Worker SUT template.
 */
function generateWorkerSutCode(meta: SutMetadata, algorithmName: string): string {
	return `/**
 * ${meta.name} (Auto-Generated from Registry)
 *
 * Generated from register-ranking-suts.ts by:
 *   scripts/generate-worker-suts-from-registry.ts
 *
 * SUT ID: ${meta.id}
 * Role: ${meta.role}
 * Version: ${meta.version}
 */

import { ${algorithmName} } from "../experiments/suts/${algorithmName}.js";
import type { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import type { SUT } from "ppef/types/sut";
import type { SutRegistration } from "ppef/types/sut";

/**
 * SUT configuration (matches registry defaults).
 */
export interface ${meta.id.replace(/-/g, "")}Config {
	// Configuration options (if any)
	[key: string]: unknown;
}

/**
 * SUT inputs for this algorithm.
 */
export interface RankingInputs {
	input: BenchmarkGraphExpander;
	source: string;
	target: string;
}

/**
 * SUT result type (algorithm-specific).
 */
export interface ${meta.id.replace(/-/g, "")}Result {
	pathsFound: number;
	meanMI: number;
	stdMI: number;
	pathDiversity: number;
	hubAvoidance: number;
	nodeCoverage: number;
	meanScore: number;
	stdScore: number;
	paths: Array<{ id: string; nodes: string[]; mi: number }>;
}

/**
 * SUT registration metadata.
 */
export const registration: SutRegistration = {
	id: "${meta.id}",
	name: "${meta.name}",
	version: "${meta.version}",
	role: "${meta.role}",
	config: ${JSON.stringify(meta.config)},
	tags: ${JSON.stringify(meta.tags)},
	description: "${meta.description || ""}",
};

/**
 * Create a SUT instance from registry metadata.
 *
 * Factory function for PPEF worker thread execution.
 * Wraps the registry's ${algorithmName} class in a PPEF-compatible interface.
 *
 * @param config - Optional configuration overrides
 * @returns PPEF-compatible SUT object
 */
export function createSut(config?: Record<string, unknown>): SUT<RankingInputs, ${meta.id.replace(/-/g, "")}Result> {
	return {
		id: registration.id,
		get config() {
			return config ?? {};
		},

		async run(inputs: RankingInputs): Promise<${meta.id.replace(/-/g, "")}Result> {
			// Reconstruct SUT from registry
			const { input: expander, source, target } = inputs;
			const sut = new ${algorithmName}(expander, [source, target], config as ${meta.id.replace(/-/g, "")}Config);
			const result = await sut.run();

			if (!result.ok) {
				throw result.error;
			}

			return result.value;
		},
	};
}
`;
}

/**
 * SUTs to generate (extracted from register-ranking-suts.ts).
 */
const REGISTRY_SUTS: Array<{ meta: SutMetadata; algorithmName: string }> = [
	{
		meta: {
			id: "path-salience-v1.0.0",
			name: "Path Salience Ranking",
			version: "1.0.0",
			role: "primary",
			config: {},
			tags: ["ranking", "information-theoretic"],
			description: "Information-theoretic path ranking using mutual information",
		},
		algorithmName: "PathSalienceSUT",
	},
	{
		meta: {
			id: "random-ranking-v1.0.0",
			name: "Random Path Ranking",
			version: "1.0.0",
			role: "baseline",
			config: {},
			tags: ["ranking", "baseline", "null-hypothesis"],
			description: "Random path ranking (statistical null hypothesis)",
		},
		algorithmName: "RandomRankingSUT",
	},
	{
		meta: {
			id: "shortest-ranking-v1.0.0",
			name: "Shortest Path Ranking",
			version: "1.0.0",
			role: "baseline",
			config: {},
			tags: ["ranking", "baseline", "conventional"],
			description: "Shortest-path-first ranking (conventional baseline)",
		},
		algorithmName: "ShortestRankingSUT",
	},
];

/**
 * Main function
 */
function main(): void {
	const sutsDir = join(projectRoot, "dist/suts");

	// Create output directory
	mkdirSync(sutsDir, { recursive: true });

	// Generate each SUT file
	for (const { meta, algorithmName } of REGISTRY_SUTS) {
		const code = generateWorkerSutCode(meta, algorithmName);
		const fileName = `${meta.id}.js`;
		const outputPath = join(sutsDir, fileName);

		writeFileSync(outputPath, code);
		console.log(`✓ Generated: ${fileName}`);
	}

	// Generate index file for easier imports
	const indexCode = `/**
 * Worker SUT Index (Auto-Generated)
 *
 * Export all worker-compatible SUTs for dynamic loading.
 * Generated by scripts/generate-worker-suts-from-registry.ts
 */

${REGISTRY_SUTS.map(({ meta }) => `export { createSut, registration } from "./${meta.id}.js";`).join("\n")}
`;

	writeFileSync(join(sutsDir, "index.js"), indexCode);
	console.log(`✓ Generated: index.js`);

	console.log(`\nWorker SUTs generated in: ${sutsDir}`);
	console.log(`Total: ${REGISTRY_SUTS.length} SUT files`);
}

main();
