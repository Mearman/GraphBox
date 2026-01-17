#!/usr/bin/env npx tsx
/**
 * CLI tool for Wayback Machine operations.
 *
 * Usage:
 *   npx tsx scripts/wayback.ts check <url>      Check if URL is archived
 *   npx tsx scripts/wayback.ts submit <url>     Submit URL for archiving
 *   npx tsx scripts/wayback.ts list <url> [n]   List last n snapshots (default: 10)
 *
 * Options:
 *   --no-raw    Exclude id_ suffix (includes Wayback toolbar)
 */

import {
	checkArchived,
	formatAge,
	formatTimestamp,
	getSnapshots,
	parseTimestamp,
	submitToArchive,
} from "../src/utils/wayback.js";

const printUsage = (): void => {
	console.log(`Usage:
  npx tsx scripts/wayback.ts check <url>      Check if URL is archived
  npx tsx scripts/wayback.ts submit <url>     Submit URL for archiving
  npx tsx scripts/wayback.ts list <url> [n]   List last n snapshots (default: 10)

Options:
  --no-raw    Exclude id_ suffix (includes Wayback toolbar in archived pages)

Examples:
  npx tsx scripts/wayback.ts check https://example.com
  npx tsx scripts/wayback.ts submit https://example.com
  npx tsx scripts/wayback.ts list https://example.com 5
  npx tsx scripts/wayback.ts check https://example.com --no-raw`);
};

const main = async (): Promise<void> => {
	const args = process.argv.slice(2);
	const noRaw = args.includes("--no-raw");
	const filteredArgs = args.filter(arg => arg !== "--no-raw");
	const [command, url, arg] = filteredArgs;
	const raw = !noRaw;

	if (!command || !url) {
		printUsage();
		process.exit(1);
	}

	switch (command) {
		case "check": {
			console.log(`Checking: ${url}`);
			const result = await checkArchived(url, { raw });
			if (result) {
				const timestamp = parseTimestamp(result.archived);
				console.log(`✓ Archived`);
				console.log(`  Timestamp: ${timestamp ? formatTimestamp(timestamp) : "unknown"} (${timestamp ? formatAge(timestamp) : "unknown"})`);
				console.log(`  URL: ${result.archived}`);
			} else {
				console.log(`✗ Not archived`);
			}
			break;
		}

		case "submit": {
			console.log(`Submitting: ${url}`);
			const result = await submitToArchive(url, { raw });
			if (result) {
				const timestamp = parseTimestamp(result.archived);
				console.log(`✓ Archived`);
				console.log(`  Timestamp: ${timestamp ? formatTimestamp(timestamp) : "unknown"} (${timestamp ? formatAge(timestamp) : "unknown"})`);
				console.log(`  URL: ${result.archived}`);
			} else {
				console.log(`✗ Failed to archive`);
				process.exit(1);
			}
			break;
		}

		case "list": {
			const limit = arg ? parseInt(arg, 10) : 10;
			console.log(`Fetching last ${limit} snapshots for: ${url}\n`);
			const snapshots = await getSnapshots(url, { limit, raw });
			if (snapshots.length === 0) {
				console.log("No snapshots found");
			} else {
				for (const snapshot of snapshots) {
					const timestamp = parseTimestamp(snapshot.archived);
					console.log(`${timestamp ? formatTimestamp(timestamp) : "unknown"} (${timestamp ? formatAge(timestamp) : "unknown"})`);
					console.log(`  ${snapshot.archived}\n`);
				}
				console.log(`Total: ${snapshots.length} snapshot(s)`);
			}
			break;
		}

		default:
			console.error(`Unknown command: ${command}`);
			printUsage();
			process.exit(1);
	}
};

main().catch((error: unknown) => {
	console.error("Error:", error);
	process.exit(1);
});
