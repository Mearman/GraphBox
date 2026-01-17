#!/usr/bin/env npx tsx
/**
 * Update catalog.json with archived URLs from archived-urls.json.
 *
 * Adds archiveUrl field to each dataset and source using the Wayback Machine
 * id_ URL format for direct content access.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");
const ARCHIVE_PATH = path.join(import.meta.dirname, "../src/data/archived-urls.json");

interface ArchivedUrl {
	original: string;
	archived: string;
}

interface ArchiveData {
	generated: string;
	urls: Record<string, ArchivedUrl>;
}

interface Source {
	name: string;
	url: string;
	description: string;
	format: string;
	archiveUrl?: string;
}

interface Dataset {
	id: string;
	name: string;
	description: string;
	source: string;
	url: string;
	archiveUrl?: string;
	[key: string]: unknown;
}

interface Catalog {
	version: string;
	generated: string;
	sources: Record<string, Source>;
	datasetCount: number;
	datasets: Record<string, Dataset>;
}

const main = (): void => {
	// Load files
	const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as Catalog;
	const archives = JSON.parse(fs.readFileSync(ARCHIVE_PATH, "utf-8")) as ArchiveData;

	let sourcesUpdated = 0;
	let datasetsUpdated = 0;

	// Update source URLs
	for (const [key, source] of Object.entries(catalog.sources)) {
		const archived = archives.urls[source.url];
		if (archived) {
			source.archiveUrl = archived.archived;
			sourcesUpdated++;
			console.log(`Updated source ${key}`);
		}
	}

	// Update dataset URLs
	for (const dataset of Object.values(catalog.datasets)) {
		const archived = archives.urls[dataset.url];
		if (archived) {
			dataset.archiveUrl = archived.archived;
			datasetsUpdated++;
		}
	}

	// Update generation timestamp
	catalog.generated = new Date().toISOString();

	// Write updated catalog
	fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, "\t") + "\n");

	console.log(`\nDone!`);
	console.log(`  Sources updated: ${sourcesUpdated}`);
	console.log(`  Datasets updated: ${datasetsUpdated}`);
};

main();
