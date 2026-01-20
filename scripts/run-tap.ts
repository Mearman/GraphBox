#!/usr/bin/env tsx
/**
 * TAP Test Runner for Vitest
 *
 * Runs experimental tests and outputs TAP format.
 *
 * Usage:
 *   pnpm run:tap
 *   npx tsx scripts/run-tap.ts
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Helper to collect all tests from test results
function collectTests(results: any): any[] {
	const tests: any[] = [];

	for (const suite of results.testResults || []) {
		for (const test of suite.assertionResults || []) {
			tests.push({
				name: test.title,
				status: test.status,
				duration: test.duration,
				suite: suite.name,
				ancestorTitles: test.ancestorTitles,
			});
		}
	}

	return tests;
}

// Main
async function main() {
	const args = process.argv.slice(2);
	const outputFile = args.find((a) => a.startsWith("--output="))?.split("=")[1] || null;

	// Run vitest with JSON reporter
	const vitest = spawn("npx", ["vitest", "run", "--project=exp", "--reporter=json"], {
		cwd: projectRoot,
		stdio: ["ignore", "pipe", "inherit"],
	});

	let jsonOutput = "";

	for await (const chunk of vitest.stdout) {
		jsonOutput += chunk.toString();
	}

	const exitCode = await new Promise<number>((resolve) => {
		vitest.on("close", resolve);
	});

	// Parse JSON output
	const lines = jsonOutput.split("\n").filter((line) => line.trim().startsWith("{"));
	const results = JSON.parse(lines[lines.length - 1] || "{}");

	// Generate TAP output
	const tests = collectTests(results);

	const tapLines: string[] = [];
	tapLines.push("TAP version 13");
	tapLines.push(`1..${tests.length}`);

	for (let i = 0; i < tests.length; i++) {
		const test = tests[i];
		const isOk = test.status === "passed" || test.status === "skipped";
		const directive =
			test.status === "skipped" ? " # SKIP" : test.status === "pending" ? " # TODO" : "";
		tapLines.push(`${isOk ? "ok" : "not ok"} ${i + 1} - ${test.name}${directive}`);
	}

	const passed = tests.filter((t) => t.status === "passed").length;
	const failed = tests.filter((t) => t.status === "failed").length;
	const skipped = tests.filter((t) => t.status === "skipped" || t.status === "pending").length;

	tapLines.push("");
	tapLines.push(`# Summary: ${passed} passed, ${failed} failed, ${skipped} skipped`);

	// Output TAP
	const tapOutput = tapLines.join("\n");
	console.log(tapOutput);

	// Write to file if requested
	if (outputFile) {
		const dir = dirname(outputFile);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(outputFile, tapOutput);
		console.error(`\nTAP output written to: ${outputFile}`);
	}

	process.exit(exitCode ?? (results.success ? 0 : 1));
}

main();
