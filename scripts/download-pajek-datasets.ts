#!/usr/bin/env npx tsx
/**
 * Download all Pajek datasets.
 *
 * Downloads and converts all configured Pajek datasets to the normalized JSON format.
 * Uses Wayback Machine archives for reliability.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { fetchPajekDataset } from "../src/formats/pajek/fetch";
import { PAJEK_DATASETS } from "./pajek-datasets";

const DATA_DIR = path.join(import.meta.dirname, "../data");

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

		console.log(`Downloading ${dataset.id} from ${dataset.url}...`);

		try {
			const result = await fetchPajekDataset(dataset.url, {
				meta: {
					name: dataset.name,
					description: dataset.description,
					source: "http://vlado.fmf.uni-lj.si/pub/networks/data/",
					url: dataset.url.replace(/https:\/\/web\.archive\.org\/web\/\d+\//, ""),
					citation: {
						authors: dataset.citation.authors,
						title: dataset.citation.title,
						journal: dataset.citation.venue,
						year: dataset.citation.year,
						type: "article",
					},
					retrieved: new Date().toISOString().split("T")[0],
				},
				directed: dataset.directed,
			});

			fs.writeFileSync(jsonPath, JSON.stringify(result.graph, null, "\t") + "\n");

			console.log(`  Nodes: ${result.graph.nodes.length}, Edges: ${result.graph.edges.length}`);
			console.log(`  Archive: ${(result.archiveSize / 1024).toFixed(1)} KB, Content: ${(result.contentSize / 1024).toFixed(1)} KB`);

			downloaded++;

			// Small delay to be nice to the server
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
