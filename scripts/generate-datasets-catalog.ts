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

/** An alternate download URL for a dataset. */
interface AlternateUrl {
	/** Download URL */
	url: string;
	/** Source key (references sources object) */
	source: string;
	/** File format at this URL */
	format: string;
	/** Brief description */
	description?: string;
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
	/** Alternative download URLs (other mirrors/formats) */
	alternateUrls?: AlternateUrl[];
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
	// Exact match first
	if (sourceUrl in SOURCE_URL_TO_KEY) return SOURCE_URL_TO_KEY[sourceUrl];
	// Prefix match (e.g. "https://sparse.tamu.edu/Pajek/California" → "suitesparse")
	for (const [prefix, key] of Object.entries(SOURCE_URL_TO_KEY)) {
		if (sourceUrl.startsWith(prefix)) return key;
	}
	return "unknown";
};

/**
 * SuiteSparse Matrix Collection alternate URLs for Pajek datasets.
 * Maps dataset ID → SuiteSparse name (group is always "Pajek").
 * Covers all 76 datasets from https://sparse.tamu.edu/Pajek
 */
const SUITESPARSE_PAJEK_MAP: Record<string, string> = {
	// Non-prefixed Wayback datasets also on SuiteSparse
	"csphd": "CSphd",
	"erdos02": "Erdos02",
	"geom": "geom",
	"roget": "Roget",
	"usair97": "USAir97",
	"yeast": "yeast",
	// Prefixed pajek-* datasets (downloaded from Wayback or SuiteSparse)
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
	// Cross-references for Wayback datasets with different catalog IDs
	"pajek-gd02": "GD02_a",
	"pajek-gd03": "GD99_c",
	"pajek-hep-th-new": "HEP-th-new",
	"pajek-nd-yeast": "NotreDame_yeast",
	"gd01-citations": "GD01_a",
	// ss-pajek-* datasets (from SuiteSparse only)
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

/**
 * Wayback Machine URLs for datasets primarily sourced from SuiteSparse.
 * These are original Pajek download URLs archived on the Wayback Machine.
 */
const WAYBACK_PAJEK_MAP: Record<string, { url: string; format: string }> = {
	"pajek-glosstg": {
		url: "https://web.archive.org/web/20041222052810/http://vlado.fmf.uni-lj.si/pub/networks/data/DIC/TG/glossTG.paj",
		format: "pajek",
	},
	"pajek-journals": {
		url: "https://web.archive.org/web/20130507053929/http://vlado.fmf.uni-lj.si/pub/networks/data/2mode/revije.zip",
		format: "pajek",
	},
};

const getWaybackUrl = (datasetId: string): AlternateUrl | undefined => {
	const entry = WAYBACK_PAJEK_MAP[datasetId];
	if (!entry) return undefined;
	return {
		url: entry.url,
		source: "pajek",
		format: entry.format,
		description: "Wayback Machine archive of original Pajek dataset",
	};
};

const getSuiteSparseUrl = (datasetId: string): AlternateUrl | undefined => {
	const name = SUITESPARSE_PAJEK_MAP[datasetId];
	if (!name) return undefined;
	return {
		url: `https://suitesparse-collection-website.herokuapp.com/MM/Pajek/${name}.tar.gz`,
		source: "suitesparse",
		format: "matrix-market",
		description: `SuiteSparse Matrix Collection (Pajek/${name})`,
	};
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
		const content = fs.readFileSync(filepath, "utf8");
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

		// Add alternate URLs (SuiteSparse mirror, Wayback archive)
		const alternateUrls: AlternateUrl[] = [];
		if (sourceKey !== "suitesparse") {
			const ssUrl = getSuiteSparseUrl(id);
			if (ssUrl) {
				alternateUrls.push(ssUrl);
			}
		}
		const wbUrl = getWaybackUrl(id);
		if (wbUrl) {
			alternateUrls.push(wbUrl);
		}
		if (alternateUrls.length > 0) {
			entry.alternateUrls = alternateUrls;
		}

		datasets[id] = entry;
	}

	// Ensure output directory exists
	const outputDir = path.dirname(OUTPUT_PATH);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Include sources referenced by datasets or alternate URLs
	const usedSources = new Set(Object.values(datasets).map(d => d.source));
	for (const dataset of Object.values(datasets)) {
		if (dataset.alternateUrls) {
			for (const alt of dataset.alternateUrls) {
				usedSources.add(alt.source);
			}
		}
	}
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
