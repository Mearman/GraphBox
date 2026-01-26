#!/usr/bin/env tsx
/**
 * Copy Worker-Compatible SUT Files
 *
 * Copies standalone SUT files to dist/suts/ for worker thread execution.
 * Called automatically after build via npm script.
 *
 * Usage:
 *   npx tsx scripts/copy-worker-suts.ts
 *   pnpm build:suts
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

/**
 * SUT files that need to be available for worker threads.
 */
const SUT_FILES = [
	"src/suts/path-salience-v1.0.0.ts",
	"src/suts/random-ranking-v1.0.0.ts",
	"src/suts/shortest-ranking-v1.0.0.ts",
];

/**
 * Import path mappings for worker compatibility.
 * Worker threads load files from dist/ with relative imports.
 */
const IMPORT_REPLACEMENTS: Record<string, string> = {
	"../algorithms/graph/graph.js": "../../dist/algorithms/graph/graph.js",
	"../algorithms/pathfinding/path-ranking.js": "../../dist/algorithms/pathfinding/path-ranking.js",
	"../algorithms/pathfinding/random-path-sampling.js": "../../dist/algorithms/pathfinding/random-path-sampling.js",
	"../algorithms/pathfinding/shortest-path-ranking.js": "../../dist/algorithms/pathfinding/shortest-path-ranking.js",
	"../algorithms/types/graph.js": "../../dist/algorithms/types/graph.js",
	"../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js": "../../dist/experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js",
	"../experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js": "../../dist/experiments/evaluation/__tests__/validation/common/path-ranking-helpers.js",
};

/**
 * Copy and transform a SUT file for worker compatibility.
 */
function copySutFile(sourcePath: string, destPath: string): void {
	let content = readFileSync(sourcePath, "utf-8");

	// Transform imports for worker compatibility
	for (const [oldImport, newImport] of Object.entries(IMPORT_REPLACEMENTS)) {
		content = content.replace(`from "${oldImport}"`, `from "${newImport}"`);
		content = content.replace(`from '${oldImport}'`, `from '${newImport}'`);
	}

	// Remove PPEF type imports (workers don't need them, they're loaded dynamically)
	content = content.replace(/import type \{ SUT \} from "ppef\/types\/sut";\n/g, "");
	content = content.replace(/import type \{ SutRegistration \} from "ppef\/types\/sut";\n/g, "");

	// Add JSDoc comments for worker clarity
	const sutName = sourcePath.split("/").pop()!.replace(".ts", "");
	const header = `/**
 * ${sutName} - Worker-Compatible SUT
 *
 * Auto-generated from ${sourcePath}
 * Run scripts/copy-worker-suts.ts to regenerate.
 */

`;

	writeFileSync(destPath, header + content);
	console.log(`✓ Copied: ${sourcePath} -> ${destPath}`);
}

/**
 * Main function
 */
function main(): void {
	const sutsDir = join(projectRoot, "dist/suts");

	// Create output directory
	if (!existsSync(sutsDir)) {
		mkdirSync(sutsDir, { recursive: true });
	}

	// Copy each SUT file
	for (const sutFile of SUT_FILES) {
		const sourcePath = join(projectRoot, sutFile);
		const fileName = sutFile.split("/").pop()!.replace(".ts", ".js");
		const destPath = join(sutsDir, fileName);

		if (!existsSync(sourcePath)) {
			console.warn(`⊘ Skipped: ${sourcePath} (not found)`);
			continue;
		}

		copySutFile(sourcePath, destPath);
	}

	console.log(`\nWorker SUTs ready in: ${sutsDir}`);
	console.log("\nAvailable SUTs:");
	for (const sutFile of SUT_FILES) {
		const sutName = sutFile.split("/").pop()!.replace(".ts", "");
		console.log(`  - ${sutName.replace(".ts", "")}`);
	}
}

main();
