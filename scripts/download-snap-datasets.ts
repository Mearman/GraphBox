#!/usr/bin/env npx tsx
/**
 * Download all SNAP datasets.
 *
 * Downloads and converts all configured SNAP datasets to the normalized JSON format.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { fetchSnapDataset } from "../src/formats/snap/fetch";
import { SNAP_DATASETS } from "./snap-datasets";

const DATA_DIR = path.join(import.meta.dirname, "../data");
const SOURCE = "snap";

const main = async (): Promise<void> => {
	let downloaded = 0;
	let skipped = 0;
	let failed = 0;

	// Process datasets sequentially to avoid overwhelming the server
	for (const dataset of SNAP_DATASETS) {
		const jsonPath = path.join(DATA_DIR, `${dataset.id}.json`);

		// Skip if already exists
		if (fs.existsSync(jsonPath)) {
			console.log(`Skipping ${dataset.id}: already exists`);
			skipped++;
			continue;
		}

		console.log(`Downloading ${dataset.id} from ${dataset.url}...`);

		try {
			const result = await fetchSnapDataset(dataset.url, {
				meta: {
					name: dataset.name,
					description: dataset.description,
					source: `https://${SOURCE}.stanford.edu/data/`,
					url: dataset.url,
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
			await new Promise(resolve => setTimeout(resolve, 500));
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
