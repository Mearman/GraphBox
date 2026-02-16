#!/usr/bin/env npx tsx
/**
 * Add SuiteSparse Matrix Collection graph-related datasets to catalog.json.
 *
 * Reads suitesparse-stats.csv, filters to graph/network kinds, deduplicates
 * against existing catalog entries, and adds new entries with 3-format downloads.
 * For overlapping entries, adds SuiteSparse as an additional source.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");
const STATS_PATH = path.join(import.meta.dirname, "suitesparse-stats.csv");

const SS_BASE = "https://suitesparse-collection-website.herokuapp.com";

/** Kinds that represent graph/network data. */
const GRAPH_KIND_RE = /graph|^power network|^subsequent power network|^biochemical network/i;

interface DatasetDownload {
	url: string;
	format: string;
	description?: string;
}

interface DatasetSource {
	source: string;
	downloads: DatasetDownload[];
}

interface CatalogEntry {
	id: string;
	name: string;
	description: string;
	sources: DatasetSource[];
	citation: {
		authors: string[];
		title: string;
		journal?: string;
		volume?: number;
		pages?: string;
		year: number;
		type: string;
		publisher?: string;
		location?: string;
	};
	retrieved: string;
	creator?: string;
	rawBytes: number;
	nodeCount: number;
	edgeCount: number;
	directed: boolean;
	weighted: boolean;
	hasNodeAttributes: boolean;
	hasEdgeAttributes: boolean;
	labeled: boolean;
}

interface SsRow {
	group: string;
	name: string;
	nrows: number;
	ncols: number;
	nnz: number;
	isReal: boolean;
	isBinary: boolean;
	isND: boolean;
	posdef: boolean;
	patternSym: number;
	numericalSym: number;
	kind: string;
	nnzdiag: number;
}

const parseSsRow = (line: string): SsRow | undefined => {
	// CSV format: group,name,nrows,ncols,nnz,isReal,isBinary,isND,posdef,patternSym,numericalSym,kind,nnzdiag
	// Note: kind can contain commas when it has multiple descriptors, but in practice
	// the SuiteSparse stats file uses single-value kinds. The 13 columns are fixed.
	// However, some kinds DO have commas. We need to handle this carefully.
	// The first 11 fields are always non-comma values. The kind field is second-to-last
	// and nnzdiag is last (always numeric). So we can extract from both ends.
	const parts = line.split(",");
	if (parts.length < 13) return undefined;

	const group = parts[0];
	const name = parts[1];
	const nrows = Number(parts[2]);
	const ncols = Number(parts[3]);
	const nnz = Number(parts[4]);
	const isReal = parts[5] === "1";
	const isBinary = parts[6] === "1";
	const isND = parts[7] === "1";
	const posdef = parts[8] === "1";
	const patternSym = Number(parts[9]);
	const numericalSym = Number(parts[10]);
	// Kind may contain commas, nnzdiag is always last
	const nnzdiag = Number(parts.at(-1));
	const kind = parts.slice(11, - 1).join(",");

	if (Number.isNaN(nrows) || Number.isNaN(nnz)) return undefined;

	return { group, name, nrows, ncols, nnz, isReal, isBinary, isND, posdef, patternSym, numericalSym, kind, nnzdiag };
};

const makeSsDownloads = (group: string, name: string): DatasetDownload[] => [
	{ url: `${SS_BASE}/MM/${group}/${name}.tar.gz`, format: "matrix-market" },
	{ url: `${SS_BASE}/RB/${group}/${name}.tar.gz`, format: "rutherford-boeing" },
	{ url: `${SS_BASE}/mat/${group}/${name}.tar.gz`, format: "matlab" },
];

const toId = (group: string, name: string): string =>
	`ss-${group}-${name}`.toLowerCase().replaceAll("_", "-");

const isDirected = (kind: string, patternSym: number): boolean => {
	const lower = kind.toLowerCase();
	if (lower.includes("directed")) return true;
	if (lower.includes("undirected")) return false;
	return patternSym < 1;
};

const main = (): void => {
	// Read catalog
	const catalogRaw = fs.readFileSync(CATALOG_PATH, "utf8");
	const catalog = JSON.parse(catalogRaw) as {
		version: string;
		generated: string;
		sources: Record<string, unknown>;
		datasetCount: number;
		datasets: Record<string, CatalogEntry>;
	};

	// Read and parse ssstats.csv (skip first 2 lines: count + timestamp)
	const statsLines = fs.readFileSync(STATS_PATH, "utf8").split("\n").slice(2).filter(Boolean);
	const allRows = statsLines.map(parseSsRow).filter((r): r is SsRow => r !== undefined);
	const graphRows = allRows.filter(r => GRAPH_KIND_RE.test(r.kind));
	console.log(`Parsed ${allRows.length} SuiteSparse entries, ${graphRows.length} are graph-related`);

	// Build set of existing SuiteSparse group/name pairs from catalog
	const existingSsPairs = new Set<string>();
	for (const entry of Object.values(catalog.datasets)) {
		for (const src of entry.sources) {
			if (src.source !== "suitesparse") continue;
			for (const dl of src.downloads) {
				const match = dl.url.match(/\/MM\/([^/]+)\/([^/]+)\.tar\.gz/);
				if (match) existingSsPairs.add(`${match[1]}/${match[2]}`);
			}
		}
	}

	// Build set of lowercase catalog IDs for name-matching
	const existingIds = new Set(Object.keys(catalog.datasets).map(id => id.toLowerCase()));

	// Build reverse map: lowercase name → catalog entry ID (for name-match deduplication)
	const nameToId = new Map<string, string>();
	for (const [id, entry] of Object.entries(catalog.datasets)) {
		nameToId.set(id.toLowerCase(), id);
		// Also index by the last component of the dataset name (lowercased)
		const nameLower = entry.name.toLowerCase();
		if (!nameToId.has(nameLower)) nameToId.set(nameLower, id);
	}

	const today = new Date().toISOString().slice(0, 10);
	let added = 0;
	let enriched = 0;
	let skipped = 0;

	for (const row of graphRows) {
		const ssPair = `${row.group}/${row.name}`;
		const candidateId = toId(row.group, row.name);

		// Check if this SuiteSparse pair is already represented
		if (existingSsPairs.has(ssPair)) {
			skipped++;
			continue;
		}

		// Check if a catalog entry exists with a matching name (case-insensitive)
		const nameLower = row.name.toLowerCase();
		const matchedId = nameToId.get(nameLower) ?? (existingIds.has(candidateId) ? candidateId : undefined);

		if (matchedId && catalog.datasets[matchedId]) {
			// Add SuiteSparse as additional source to existing entry
			const entry = catalog.datasets[matchedId];
			const hasSs = entry.sources.some(s => s.source === "suitesparse");
			if (hasSs) {
				skipped++;
			} else {
				entry.sources.push({
					source: "suitesparse",
					downloads: makeSsDownloads(row.group, row.name),
				});
				enriched++;
			}
			existingSsPairs.add(ssPair);
			continue;
		}

		// New entry
		const newEntry: CatalogEntry = {
			id: candidateId,
			name: `${row.group}/${row.name}`,
			description: `${row.kind} (${row.nrows.toLocaleString("en-GB")} nodes, ${row.nnz.toLocaleString("en-GB")} non-zeros)`,
			sources: [{
				source: "suitesparse",
				downloads: makeSsDownloads(row.group, row.name),
			}],
			citation: {
				authors: ["T. A. Davis", "Y. Hu"],
				title: "The University of Florida Sparse Matrix Collection",
				journal: "ACM Transactions on Mathematical Software",
				volume: 38,
				pages: "1:1-1:25",
				year: 2011,
				type: "article",
			},
			retrieved: today,
			rawBytes: 0,
			nodeCount: row.nrows,
			edgeCount: row.nnz,
			directed: isDirected(row.kind, row.patternSym),
			weighted: !row.isBinary,
			hasNodeAttributes: false,
			hasEdgeAttributes: !row.isBinary,
			labeled: false,
		};

		catalog.datasets[candidateId] = newEntry;
		existingSsPairs.add(ssPair);
		existingIds.add(candidateId);
		added++;
	}

	catalog.datasetCount = Object.keys(catalog.datasets).length;
	catalog.generated = new Date().toISOString();

	fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, "\t") + "\n");

	console.log("\nResults:");
	console.log(`  Added: ${added} new entries`);
	console.log(`  Enriched: ${enriched} existing entries with SuiteSparse source`);
	console.log(`  Skipped: ${skipped} (already represented)`);
	console.log(`  Total datasets: ${catalog.datasetCount}`);
	console.log(`Written to ${CATALOG_PATH}`);
};

main();
