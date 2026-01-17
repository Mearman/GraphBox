#!/usr/bin/env npx tsx
/**
 * Submit all dataset URLs to Wayback Machine for archiving.
 *
 * Uses the Wayback Machine Save Page Now API to archive URLs,
 * then outputs the archived URLs in id_ format for direct access.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
	type ArchivedUrl,
	checkArchived,
	submitToArchive,
} from "../src/utils/wayback.js";

const CATALOG_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");
const OUTPUT_PATH = path.join(import.meta.dirname, "../src/data/archived-urls.json");

interface ArchiveResult {
	generated: string;
	urls: Record<string, ArchivedUrl>;
}

const main = async (): Promise<void> => {
	const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as {
		sources: Record<string, { url: string }>;
		datasets: Record<string, { url: string }>;
	};

	const urls = new Set<string>();

	for (const source of Object.values(catalog.sources)) {
		urls.add(source.url);
	}

	for (const dataset of Object.values(catalog.datasets)) {
		urls.add(dataset.url);
	}

	console.log(`Found ${urls.size} unique URLs to archive`);

	const result: ArchiveResult = {
		generated: new Date().toISOString(),
		urls: {},
	};

	let archived = 0;
	let alreadyArchived = 0;
	let failed = 0;

	for (const url of urls) {
		console.log(`Processing: ${url}`);

		// First check if already archived
		const existing = await checkArchived(url);
		if (existing) {
			console.log(`  Already archived`);
			result.urls[url] = existing;
			alreadyArchived++;
			continue;
		}

		// Submit for archiving
		console.log(`  Submitting to Wayback Machine...`);
		const archiveResult = await submitToArchive(url);

		if (archiveResult) {
			console.log(`  Archived`);
			result.urls[url] = archiveResult;
			archived++;
		} else {
			console.log(`  Failed to archive`);
			failed++;
		}
	}

	fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, "\t") + "\n");

	console.log(`\nDone!`);
	console.log(`  Newly archived: ${archived}`);
	console.log(`  Already archived: ${alreadyArchived}`);
	console.log(`  Failed: ${failed}`);
	console.log(`\nResults saved to: ${OUTPUT_PATH}`);
};

main().catch((error: unknown) => {
	console.error("Error:", error);
	process.exit(1);
});
