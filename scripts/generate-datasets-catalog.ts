#!/usr/bin/env npx tsx
/**
 * Generate datasets catalog from existing JSON files.
 *
 * Extracts metadata, statistics, and characteristics from all datasets
 * and writes to src/data/datasets.json.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.join(import.meta.dirname, "../data");
const OUTPUT_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");

interface Source {
	/** Human-readable name */
	name: string;
	/** Canonical URL for the source */
	url: string;
	/** Description of the source */
	description: string;
	/** Default format of files from this source */
	format: string;
}

interface DatasetEntry {
	/** Unique identifier (filename without extension) */
	id: string;
	/** Human-readable name */
	name: string;
	/** Description of the dataset */
	description: string;
	/** Reference to source in sources object */
	source: string;
	/** Direct download URL */
	url: string;
	/** Citation information */
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
	/** Date retrieved */
	retrieved: string;
	/** Original creator comment from GML */
	creator?: string;

	// Statistics
	/** Raw download size in bytes (may be compressed) */
	rawBytes: number;
	/** Number of nodes */
	nodeCount: number;
	/** Number of edges */
	edgeCount: number;

	// Boolean characteristics
	/** Whether the graph is directed */
	directed: boolean;
	/** Whether edges have weight/value properties */
	weighted: boolean;
	/** Whether nodes have attributes beyond id */
	hasNodeAttributes: boolean;
	/** Whether edges have attributes beyond source/target */
	hasEdgeAttributes: boolean;
	/** Whether nodes have labels (string identifiers) */
	labeled: boolean;
}

interface DatasetsCatalog {
	/** Schema version */
	version: string;
	/** Generation timestamp */
	generated: string;
	/** Data sources */
	sources: Record<string, Source>;
	/** Total number of datasets */
	datasetCount: number;
	/** Datasets indexed by id */
	datasets: Record<string, DatasetEntry>;
}

// Known sources - maps source URLs to source keys
const SOURCE_URL_TO_KEY: Record<string, string> = {
	"https://websites.umich.edu/~mejn/netdata/": "newman",
	"https://snap.stanford.edu/data/": "snap",
	"http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm": "ucinet",
	"http://vlado.fmf.uni-lj.si/pub/networks/pajek/data/gphs.htm": "pajek",
	"http://vlado.fmf.uni-lj.si/pub/networks/data/": "pajek",
	"http://www.nd.edu/~networks/resources.htm": "barabasi",
	"http://deim.urv.cat/~aarenas/data/welcome.htm": "arenas",
	"http://konect.cc/": "konect",
	"https://networkrepository.com/": "nrep",
	"https://sparse.tamu.edu/": "suitesparse",
	"https://networkdata.ics.uci.edu/": "uci",
	"http://dimacs.rutgers.edu/programs/challenge/": "dimacs",
};

const SOURCES: Record<string, Source> = {
	newman: {
		name: "Mark Newman's Network Data",
		url: "https://websites.umich.edu/~mejn/netdata/",
		description: "Network datasets compiled by Mark Newman at the University of Michigan.",
		format: "gml",
	},
	snap: {
		name: "Stanford Large Network Dataset Collection",
		url: "https://snap.stanford.edu/data/",
		description: "Large-scale network datasets from Stanford Network Analysis Project.",
		format: "various",
	},
	ucinet: {
		name: "UCINet Datasets",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
		description: "Social network datasets released with UCINet software.",
		format: "ucinet",
	},
	pajek: {
		name: "Pajek Datasets",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/",
		description: "Example datasets released with Pajek network analysis software.",
		format: "pajek",
	},
	barabasi: {
		name: "Barabási Lab Datasets",
		url: "http://www.nd.edu/~networks/resources.htm",
		description: "Network datasets from Albert-László Barabási's research group.",
		format: "various",
	},
	arenas: {
		name: "Alex Arenas Datasets",
		url: "http://deim.urv.cat/~aarenas/data/welcome.htm",
		description: "Network datasets from Alexandre Arenas at Universitat Rovira i Virgili.",
		format: "various",
	},
	konect: {
		name: "KONECT - The Koblenz Network Collection",
		url: "http://konect.cc/",
		description: "Large collection of network datasets from the University of Koblenz-Landau.",
		format: "various",
	},
	nrep: {
		name: "Network Repository",
		url: "https://networkrepository.com/",
		description: "Interactive network data repository with graph analytics and visualization.",
		format: "various",
	},
	suitesparse: {
		name: "SuiteSparse Matrix Collection",
		url: "https://sparse.tamu.edu/",
		description: "Sparse matrix benchmarks from diverse applications, formerly the UF Sparse Matrix Collection.",
		format: "matrix-market",
	},
	uci: {
		name: "UCI Network Data Repository",
		url: "https://networkdata.ics.uci.edu/",
		description: "Network datasets from UC Irvine for scientific study of networks.",
		format: "various",
	},
	dimacs: {
		name: "DIMACS Implementation Challenges",
		url: "http://dimacs.rutgers.edu/programs/challenge/",
		description: "Benchmark graphs from DIMACS algorithm implementation challenges.",
		format: "dimacs",
	},
};

const getSourceKey = (sourceUrl: string): string => {
	return SOURCE_URL_TO_KEY[sourceUrl] ?? "unknown";
};

const hasWeightedEdges = (edges: Array<Record<string, unknown>>): boolean => {
	return edges.some(e => "weight" in e || "value" in e);
};

const hasNodeAttributes = (nodes: Array<Record<string, unknown>>): boolean => {
	return nodes.some(n => Object.keys(n).length > 1);
};

const hasEdgeAttributes = (edges: Array<Record<string, unknown>>): boolean => {
	return edges.some(e => {
		const keys = Object.keys(e).filter(k => k !== "source" && k !== "target");
		return keys.length > 0;
	});
};

const hasLabels = (nodes: Array<Record<string, unknown>>): boolean => {
	// Check if node IDs are meaningful strings (not just numbers)
	return nodes.some(n => {
		const id = n.id as string;
		return typeof id === "string" && !/^\d+$/.test(id);
	});
};

const main = (): void => {
	const jsonFiles = fs.readdirSync(DATA_DIR)
		.filter(f => f.endsWith(".json"))
		.sort();

	const datasets: Record<string, DatasetEntry> = {};

	for (const filename of jsonFiles) {
		const filepath = path.join(DATA_DIR, filename);
		const id = filename.replace(/\.json$/, "");

		console.log(`Processing ${filename}...`);

		const stat = fs.statSync(filepath);
		const content = fs.readFileSync(filepath, "utf-8");
		const data = JSON.parse(content) as {
			meta: Record<string, unknown>;
			nodes: Array<Record<string, unknown>>;
			edges: Array<Record<string, unknown>>;
		};

		const sourceUrl = data.meta.source as string;
		const sourceKey = getSourceKey(sourceUrl);

		const entry: DatasetEntry = {
			id,
			name: data.meta.name as string,
			description: data.meta.description as string,
			source: sourceKey,
			url: data.meta.url as string,
			citation: data.meta.citation as DatasetEntry["citation"],
			retrieved: data.meta.retrieved as string,
			creator: data.meta.creator as string | undefined,

			rawBytes: stat.size,
			nodeCount: data.nodes.length,
			edgeCount: data.edges.length,

			directed: data.meta.directed as boolean,
			weighted: hasWeightedEdges(data.edges),
			hasNodeAttributes: hasNodeAttributes(data.nodes),
			hasEdgeAttributes: hasEdgeAttributes(data.edges),
			labeled: hasLabels(data.nodes),
		};

		datasets[id] = entry;
	}

	// Ensure output directory exists
	const outputDir = path.dirname(OUTPUT_PATH);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Only include sources that have datasets
	const usedSources = new Set(Object.values(datasets).map(d => d.source));
	const includedSources: Record<string, Source> = {};
	for (const [key, source] of Object.entries(SOURCES)) {
		if (usedSources.has(key)) {
			includedSources[key] = source;
		}
	}

	const catalog: DatasetsCatalog = {
		version: "1.0.0",
		generated: new Date().toISOString(),
		sources: includedSources,
		datasetCount: Object.keys(datasets).length,
		datasets,
	};

	fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, "\t") + "\n");

	console.log(`\nGenerated ${OUTPUT_PATH}`);
	console.log(`Sources: ${Object.keys(includedSources).length}`);
	console.log(`Total datasets: ${catalog.datasetCount}`);
};

main();
