#!/usr/bin/env npx tsx
/**
 * One-off migration: convert catalog.json from flat url/source/alternateUrls
 * schema to hierarchical sources-with-downloads schema.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");

/**
 * SuiteSparse Pajek mapping — maps catalog IDs to SuiteSparse names.
 * Used to generate proper download URLs for entries sourced from SuiteSparse/Pajek.
 */
const SUITESPARSE_PAJEK_MAP: Record<string, string> = {
	"csphd": "CSphd",
	"erdos02": "Erdos02",
	"geom": "geom",
	"roget": "Roget",
	"usair97": "USAir97",
	"yeast": "yeast",
	"pajek-california": "California",
	"pajek-eat": "EAT_RS",
	"pajek-epa": "EPA",
	"pajek-erdos-971": "Erdos971",
	"pajek-erdos-972": "Erdos972",
	"pajek-erdos-981": "Erdos981",
	"pajek-erdos-982": "Erdos982",
	"pajek-erdos-991": "Erdos991",
	"pajek-erdos-992": "Erdos992",
	"pajek-foldoc": "foldoc",
	"pajek-football": "football",
	"pajek-glosstg": "GlossGT",
	"pajek-hep-th": "HEP-th",
	"pajek-imdb": "IMDB",
	"pajek-journals": "Journals",
	"pajek-nd-actors": "NotreDame_actors",
	"pajek-nd-www": "NotreDame_www",
	"pajek-patents": "patents",
	"pajek-sandi": "Sandi_sandi",
	"pajek-sept11": "Reuters911",
	"pajek-uspowergrid": "USpowerGrid",
	"pajek-wordnet": "Wordnet3",
	"pajek-worldcities": "WorldCities",
	"pajek-gd02": "GD02_a",
	"pajek-gd03": "GD99_c",
	"pajek-hep-th-new": "HEP-th-new",
	"pajek-nd-yeast": "NotreDame_yeast",
	"gd01-citations": "GD01_a",
	"ss-pajek-cities": "Cities",
	"ss-pajek-dictionary28": "dictionary28",
	"ss-pajek-divorce": "divorce",
	"ss-pajek-eat-sr": "EAT_SR",
	"ss-pajek-eva": "EVA",
	"ss-pajek-fa": "FA",
	"ss-pajek-gd00-a": "GD00_a",
	"ss-pajek-gd00-c": "GD00_c",
	"ss-pajek-gd01-a": "GD01_a",
	"ss-pajek-gd01-acap": "GD01_Acap",
	"ss-pajek-gd01-b": "GD01_b",
	"ss-pajek-gd01-c": "GD01_c",
	"ss-pajek-gd02-a": "GD02_a",
	"ss-pajek-gd02-b": "GD02_b",
	"ss-pajek-gd06-java": "GD06_Java",
	"ss-pajek-gd06-theory": "GD06_theory",
	"ss-pajek-gd95-a": "GD95_a",
	"ss-pajek-gd95-b": "GD95_b",
	"ss-pajek-gd95-c": "GD95_c",
	"ss-pajek-gd96-a": "GD96_a",
	"ss-pajek-gd96-b": "GD96_b",
	"ss-pajek-gd96-c": "GD96_c",
	"ss-pajek-gd96-d": "GD96_d",
	"ss-pajek-gd97-a": "GD97_a",
	"ss-pajek-gd97-b": "GD97_b",
	"ss-pajek-gd97-c": "GD97_c",
	"ss-pajek-gd98-a": "GD98_a",
	"ss-pajek-gd98-b": "GD98_b",
	"ss-pajek-gd98-c": "GD98_c",
	"ss-pajek-gd99-b": "GD99_b",
	"ss-pajek-gd99-c": "GD99_c",
	"ss-pajek-hep-th-new": "HEP-th-new",
	"ss-pajek-internet": "internet",
	"ss-pajek-kohonen": "Kohonen",
	"ss-pajek-lederberg": "Lederberg",
	"ss-pajek-nd-yeast": "NotreDame_yeast",
	"ss-pajek-odlis": "ODLIS",
	"ss-pajek-patents-main": "patents_main",
	"ss-pajek-ragusa16": "Ragusa16",
	"ss-pajek-ragusa18": "Ragusa18",
	"ss-pajek-sandi-authors": "Sandi_authors",
	"ss-pajek-scimet": "SciMet",
	"ss-pajek-smagri": "SmaGri",
	"ss-pajek-smallw": "SmallW",
	"ss-pajek-stranke94": "Stranke94",
	"ss-pajek-tina-askcal": "Tina_AskCal",
	"ss-pajek-tina-askcog": "Tina_AskCog",
	"ss-pajek-tina-discal": "Tina_DisCal",
	"ss-pajek-tina-discog": "Tina_DisCog",
	"ss-pajek-zewail": "Zewail",
};

/** Default download format for each source. */
const SOURCE_DEFAULT_FORMAT: Record<string, string> = {
	newman: "gml",
	snap: "various",
	ucinet: "ucinet",
	pajek: "pajek",
	barabasi: "various",
	arenas: "various",
	konect: "various",
	nrep: "various",
	suitesparse: "matrix-market",
	uci: "various",
	dimacs: "dimacs",
};

const SS_BASE = "https://suitesparse-collection-website.herokuapp.com";

interface OldAlternateUrl {
	url: string;
	source: string;
	format: string;
	description?: string;
}

interface DatasetDownload {
	url: string;
	format: string;
	description?: string;
}

interface DatasetSource {
	source: string;
	downloads: DatasetDownload[];
}

const makeSuiteSparseDownloads = (group: string, name: string): DatasetDownload[] => [
	{ url: `${SS_BASE}/MM/${group}/${name}.tar.gz`, format: "matrix-market" },
	{ url: `${SS_BASE}/RB/${group}/${name}.tar.gz`, format: "rutherford-boeing" },
	{ url: `${SS_BASE}/mat/${group}/${name}.tar.gz`, format: "matlab" },
];

const main = (): void => {
	const raw = fs.readFileSync(CATALOG_PATH, "utf8");
	const catalog = JSON.parse(raw) as {
		version: string;
		generated: string;
		sources: Record<string, unknown>;
		datasetCount: number;
		datasets: Record<string, Record<string, unknown>>;
	};

	let migrated = 0;
	let enriched = 0;

	for (const [id, entry] of Object.entries(catalog.datasets)) {
		const oldSource = entry.source as string;
		const oldUrl = entry.url as string;
		const oldAlts = (entry.alternateUrls ?? []) as OldAlternateUrl[];

		// Build the new sources array
		const sourcesMap = new Map<string, DatasetDownload[]>();

		// Primary source entry
		if (oldSource === "suitesparse") {
			// These entries were sourced from SuiteSparse but have a generic Pajek URL.
			// They should get a pajek source with the generic URL AND a proper suitesparse source.
			const ssName = SUITESPARSE_PAJEK_MAP[id];
			if (ssName) {
				// Add pajek source with the generic URL (original provenance)
				const pajekDownloads: DatasetDownload[] = [{ url: oldUrl, format: "pajek" }];
				sourcesMap.set("pajek", pajekDownloads);
				// Add suitesparse source with all 3 format downloads
				sourcesMap.set("suitesparse", makeSuiteSparseDownloads("Pajek", ssName));
				enriched++;
			} else {
				// Fallback: no mapping known, keep as-is with generic URL
				sourcesMap.set("suitesparse", [{ url: oldUrl, format: "matrix-market" }]);
			}
		} else {
			// Normal source: determine format from source default
			const format = SOURCE_DEFAULT_FORMAT[oldSource] ?? "various";
			sourcesMap.set(oldSource, [{ url: oldUrl, format }]);

			// If there's a SuiteSparse Pajek mapping, add full 3-format downloads
			const ssName = SUITESPARSE_PAJEK_MAP[id];
			if (ssName) {
				sourcesMap.set("suitesparse", makeSuiteSparseDownloads("Pajek", ssName));
				enriched++;
			}
		}

		// Process alternateUrls — group by source key
		for (const alt of oldAlts) {
			const existing = sourcesMap.get(alt.source) ?? [];
			// If this alternate is a suitesparse MM URL and we already have full SS downloads, skip
			if (alt.source === "suitesparse" && sourcesMap.has("suitesparse")) {
				continue;
			}
			const download: DatasetDownload = { url: alt.url, format: alt.format };
			if (alt.description) download.description = alt.description;
			existing.push(download);
			sourcesMap.set(alt.source, existing);
		}

		// Convert map to array
		const sources: DatasetSource[] = [];
		for (const [sourceKey, downloads] of sourcesMap) {
			sources.push({ source: sourceKey, downloads });
		}

		// Replace old fields with new
		entry.sources = sources;
		delete entry.url;
		delete entry.source;
		delete entry.alternateUrls;

		migrated++;
	}

	// Update version
	catalog.version = "2.0.0";
	catalog.generated = new Date().toISOString();

	fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, "\t") + "\n");

	console.log(`Migrated ${migrated} entries`);
	console.log(`Enriched ${enriched} entries with full SuiteSparse 3-format downloads`);
	console.log(`Written to ${CATALOG_PATH}`);
};

main();
