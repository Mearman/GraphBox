#!/usr/bin/env npx tsx
/**
 * Download all Pajek and GD4 datasets.
 *
 * Downloads and converts all configured datasets to the normalised JSON format.
 * Uses Wayback Machine archives for reliability.
 * Supports both Pajek (.net/.paj) and GD4 (.gd4) formats.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { fetchGd4Dataset } from "../src/formats/gd4/fetch";
import { fetchPajekDataset } from "../src/formats/pajek/fetch";
import type { PajekDatasetConfig } from "./pajek-datasets";
import { PAJEK_DATASETS } from "./pajek-datasets";

const DATA_DIR = path.join(import.meta.dirname, "../data");

/**
 * Strip Wayback Machine URL wrapper to get original URL.
 * @param url
 */
const stripWaybackUrl = (url: string): string =>
	url.replace(/https:\/\/web\.archive\.org\/web\/\d+(?:id_)?\//, "");

/**
 * Build common metadata for a dataset.
 * @param dataset
 */
const buildMeta = (dataset: PajekDatasetConfig) => ({
	name: dataset.name,
	description: dataset.description,
	source: "http://vlado.fmf.uni-lj.si/pub/networks/data/",
	url: stripWaybackUrl(dataset.url),
	citation: {
		authors: dataset.citation.authors,
		title: dataset.citation.title,
		journal: dataset.citation.venue,
		year: dataset.citation.year,
		type: "article" as const,
	},
	retrieved: new Date().toISOString().split("T")[0],
});

const main = async (): Promise<void> => {
	let downloaded = 0;
	let skipped = 0;
	let failed = 0;

	// Process datasets sequentially to avoid overwhelming the server
	for (const dataset of PAJEK_DATASETS) {
		const jsonPath = path.join(DATA_DIR, `${dataset.id}.json`);

		// Skip if already exists
		if (fs.existsSync(jsonPath)) {
			console.log(`Skipping ${dataset.id}: already exists`);
			skipped++;
			continue;
		}

		const format = dataset.format ?? "pajek";
		console.log(`Downloading ${dataset.id} [${format}] from ${dataset.url}...`);

		try {
			let result: { graph: { nodes: unknown[]; edges: unknown[] }; archiveSize: number; contentSize: number };

			result = await (format === "gd4" ? fetchGd4Dataset(dataset.url, {
				meta: buildMeta(dataset),
				entryName: dataset.entryName,
			}) : fetchPajekDataset(dataset.url, {
				meta: buildMeta(dataset),
				directed: dataset.directed,
			}));

			fs.writeFileSync(jsonPath, JSON.stringify(result.graph, null, "\t") + "\n");

			console.log(`  Nodes: ${result.graph.nodes.length}, Edges: ${result.graph.edges.length}`);
			console.log(`  Archive: ${(result.archiveSize / 1024).toFixed(1)} KB, Content: ${(result.contentSize / 1024).toFixed(1)} KB`);

			downloaded++;

			// Small delay to be polite to the server
			await new Promise(resolve => setTimeout(resolve, 1000));
		} catch (error) {
			console.error(`  Failed: ${error instanceof Error ? error.message : error}`);
			failed++;
		}
	}

	console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
};

main().catch((error: unknown) => {
	console.error("Error:", error);
	process.exit(1);
});
