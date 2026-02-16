#!/usr/bin/env npx tsx
/**
 * Download Pajek datasets from the SuiteSparse Matrix Collection.
 *
 * Each dataset is a .tar.gz archive containing a Matrix Market (.mtx)
 * file and optional node labels (_nodename.txt).
 *
 * Source: https://sparse.tamu.edu/Pajek
 *
 * Usage:
 *   npx tsx scripts/suitesparse-pajek-datasets.ts
 *   npx tsx scripts/suitesparse-pajek-datasets.ts --only California EPA
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { GraphMeta } from "../src/formats/gml/types";
import { fetchMtxDataset } from "../src/formats/mtx/fetch";

const DATA_DIR = path.join(import.meta.dirname, "../data");

fs.mkdirSync(DATA_DIR, { recursive: true });

const SS_BASE =
	"https://suitesparse-collection-website.herokuapp.com/MM/Pajek";

interface SuiteSparseEntry {
	/** SuiteSparse dataset name */
	name: string;
	/** Catalog ID (pajek-* or ss-pajek-* for new datasets) */
	catalogId: string;
	/** Description */
	description: string;
	/** Whether the graph is directed */
	directed: boolean;
	/** Whether the graph is bipartite */
	bipartite?: boolean;
	/** Citation info */
	citation: Omit<GraphMeta, "directed">["citation"];
	/** Skip download (too large, etc.) */
	skip?: string;
}

// Default citation for Pajek/Batagelj networks
const pajekCitation = (
	title: string,
	authors: string[] = ["V. Batagelj", "A. Mrvar"],
	year = 2006,
): SuiteSparseEntry["citation"] => ({
	authors,
	title,
	year,
	type: "dataset" as const,
});

const gdCitation = (year: number): SuiteSparseEntry["citation"] => ({
	authors: ["Graph Drawing"],
	title: `Graph Drawing Contest ${year}`,
	year,
	type: "dataset" as const,
});

/**
 * All 76 datasets from sparse.tamu.edu/Pajek.
 *
 * Each entry maps a SuiteSparse name to a catalog ID and metadata.
 * Datasets already downloaded from Wayback use their existing catalog ID.
 * New datasets use ss-pajek-* prefix.
 */
const DATASETS: SuiteSparseEntry[] = [
	// ---- Already in catalog (resolved from Wayback) ----
	{
		name: "California",
		catalogId: "pajek-california",
		description:
			"Pages matching the query 'California'. Constructed by expanding a 200-page search engine response set.",
		directed: true,
		citation: pajekCitation("Kleinberg web search: California", [
			"J. Kleinberg",
		], 2002),
	},
	{
		name: "CSphd",
		catalogId: "csphd",
		description:
			"PhD student-advisor relationships in computer science departments.",
		directed: true,
		citation: pajekCitation("Computer science PhD advisor-student network"),
	},
	{
		name: "EAT_RS",
		catalogId: "pajek-eat",
		description:
			"Edinburgh Associative Thesaurus. Stimulus-response word associations.",
		directed: true,
		citation: pajekCitation(
			"Edinburgh Associative Thesaurus",
			["G. Kiss", "C. Armstrong", "R. Milroy", "J. Piper"],
			1973,
		),
	},
	{
		name: "EPA",
		catalogId: "pajek-epa",
		description:
			"Web pages from the US Environmental Protection Agency site.",
		directed: true,
		citation: pajekCitation("EPA web graph"),
	},
	{
		name: "Erdos02",
		catalogId: "erdos02",
		description:
			"Erdos collaboration network (2002 version). Nodes are authors, edges are coauthorships.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 2002", [
			"V. Batagelj",
			"A. Mrvar",
		]),
	},
	{
		name: "Erdos971",
		catalogId: "pajek-erdos-971",
		description:
			"Erdos collaboration network, 1997, Erdos number ≤ 1.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1997 (≤1)"),
	},
	{
		name: "Erdos972",
		catalogId: "pajek-erdos-972",
		description:
			"Erdos collaboration network, 1997, Erdos number ≤ 2.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1997 (≤2)"),
	},
	{
		name: "Erdos981",
		catalogId: "pajek-erdos-981",
		description:
			"Erdos collaboration network, 1998, Erdos number ≤ 1.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1998 (≤1)"),
	},
	{
		name: "Erdos982",
		catalogId: "pajek-erdos-982",
		description:
			"Erdos collaboration network, 1998, Erdos number ≤ 2.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1998 (≤2)"),
	},
	{
		name: "Erdos991",
		catalogId: "pajek-erdos-991",
		description:
			"Erdos collaboration network, 1999, Erdos number ≤ 1.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1999 (≤1)"),
	},
	{
		name: "Erdos992",
		catalogId: "pajek-erdos-992",
		description:
			"Erdos collaboration network, 1999, Erdos number ≤ 2.",
		directed: false,
		citation: pajekCitation("Erdos collaboration network 1999 (≤2)"),
	},
	{
		name: "foldoc",
		catalogId: "pajek-foldoc",
		description:
			"Free On-Line Dictionary of Computing. Hyperlinks between entries.",
		directed: true,
		citation: pajekCitation("FOLDOC hyperlink network", [
			"D. Howe",
		], 2003),
	},
	{
		name: "football",
		catalogId: "pajek-football",
		description:
			"Matches between South American football teams in the Liberators Cup 2003.",
		directed: true,
		citation: pajekCitation("Football Liberators Cup 2003"),
	},
	{
		name: "geom",
		catalogId: "geom",
		description:
			"Collaboration network of computational geometers.",
		directed: false,
		citation: pajekCitation("Computational geometry collaboration network"),
	},
	{
		name: "GlossGT",
		catalogId: "pajek-glosstg",
		description:
			"Glossary of graph theory terms and their cross-references.",
		directed: true,
		citation: pajekCitation("Graph theory glossary network"),
	},
	{
		name: "HEP-th",
		catalogId: "pajek-hep-th",
		description:
			"Citation network from high-energy physics theory papers on arXiv (hep-th section).",
		directed: true,
		citation: pajekCitation("hep-th citation network", [
			"KDD Cup",
		], 2003),
	},
	{
		name: "Journals",
		catalogId: "pajek-journals",
		description:
			"Citation network between 124 computational journals.",
		directed: false,
		citation: pajekCitation("Computational journal citation network"),
	},
	{
		name: "NotreDame_actors",
		catalogId: "pajek-nd-actors",
		description:
			"IMDB actor-movie bipartite network from Notre Dame.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("IMDB actor-movie network", [
			"A.-L. Barabási",
		], 1999),
		skip: "Bipartite; 520K nodes — download separately if needed",
	},
	{
		name: "NotreDame_www",
		catalogId: "pajek-nd-www",
		description:
			"Notre Dame web graph. Hyperlinks between pages on nd.edu.",
		directed: true,
		citation: pajekCitation("Notre Dame web graph", [
			"R. Albert",
			"H. Jeong",
			"A.-L. Barabási",
		], 1999),
		skip: "326K nodes — download separately if needed",
	},
	{
		name: "patents",
		catalogId: "pajek-patents",
		description:
			"US patent citation network from NBER.",
		directed: true,
		citation: pajekCitation("NBER US patent citation network", [
			"B. Hall",
			"A. Jaffe",
			"M. Trajtenberg",
		], 2001),
		skip: "3.7M nodes — too large",
	},
	{
		name: "Reuters911",
		catalogId: "pajek-sept11",
		description:
			"Reuters news network around 11 September 2001 events.",
		directed: false,
		citation: pajekCitation("Reuters 9/11 event network"),
	},
	{
		name: "Roget",
		catalogId: "roget",
		description:
			"Roget's Thesaurus cross-reference network.",
		directed: true,
		citation: pajekCitation("Roget's Thesaurus network", [
			"D. Knuth",
		], 1993),
	},
	{
		name: "Sandi_sandi",
		catalogId: "pajek-sandi",
		description:
			"Two-mode network of authors and papers from the Sandi conference.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("Sandi author-paper network"),
	},
	{
		name: "USAir97",
		catalogId: "usair97",
		description:
			"US air transportation network. Flights between airports in 1997.",
		directed: false,
		citation: pajekCitation("US air transportation 1997"),
	},
	{
		name: "USpowerGrid",
		catalogId: "pajek-uspowergrid",
		description:
			"Western US power grid topology.",
		directed: false,
		citation: pajekCitation("US power grid network", [
			"D. Watts",
			"S. Strogatz",
		], 1998),
	},
	{
		name: "Wordnet3",
		catalogId: "pajek-wordnet",
		description:
			"WordNet 3.0 semantic network. Lexical relationships between word senses.",
		directed: true,
		citation: pajekCitation("WordNet 3.0", ["Princeton University"], 2006),
	},
	{
		name: "WorldCities",
		catalogId: "pajek-worldcities",
		description:
			"Two-mode network of world cities and their attributes.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("World cities network"),
	},
	{
		name: "yeast",
		catalogId: "yeast",
		description:
			"Yeast protein interaction network (Bu et al.).",
		directed: false,
		citation: pajekCitation("Yeast protein interaction network", [
			"D. Bu",
		], 2003),
	},
	{
		name: "IMDB",
		catalogId: "pajek-imdb",
		description:
			"IMDB actor-movie bipartite network.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("IMDB bipartite network"),
		skip: "1.3M nodes — too large for catalog",
	},

	// ---- New datasets (not previously in catalog) ----
	{
		name: "Cities",
		catalogId: "ss-pajek-cities",
		description:
			"Two-mode network of cities and their features.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("Cities feature network"),
	},
	{
		name: "dictionary28",
		catalogId: "ss-pajek-dictionary28",
		description:
			"Word adjacency network from a dictionary. Edges connect words differing by one letter.",
		directed: false,
		citation: pajekCitation("Dictionary word adjacency network"),
	},
	{
		name: "divorce",
		catalogId: "ss-pajek-divorce",
		description:
			"Two-mode network of 50 divorce cases and 9 predictor variables.",
		directed: false,
		bipartite: true,
		citation: pajekCitation("Divorce predictor network"),
	},
	{
		name: "EAT_SR",
		catalogId: "ss-pajek-eat-sr",
		description:
			"Edinburgh Associative Thesaurus, response-stimulus direction.",
		directed: true,
		citation: pajekCitation(
			"Edinburgh Associative Thesaurus (reverse)",
			["G. Kiss", "C. Armstrong", "R. Milroy", "J. Piper"],
			1973,
		),
	},
	{
		name: "EVA",
		catalogId: "ss-pajek-eva",
		description:
			"Citation network from EVA (Electronic Visualisation and the Arts) conference proceedings.",
		directed: true,
		citation: pajekCitation("EVA conference citations"),
	},
	{
		name: "FA",
		catalogId: "ss-pajek-fa",
		description:
			"Web graph of Slovenian research agency (ARRS) pages.",
		directed: true,
		citation: pajekCitation("Slovenian research agency web graph"),
	},
	{
		name: "GD00_a",
		catalogId: "ss-pajek-gd00-a",
		description: "Graph Drawing Contest 2000, graph A.",
		directed: true,
		citation: gdCitation(2000),
	},
	{
		name: "GD00_c",
		catalogId: "ss-pajek-gd00-c",
		description: "Graph Drawing Contest 2000, graph C.",
		directed: true,
		citation: gdCitation(2000),
	},
	{
		name: "GD01_a",
		catalogId: "ss-pajek-gd01-a",
		description: "Graph Drawing Contest 2001, graph A.",
		directed: true,
		citation: gdCitation(2001),
	},
	{
		name: "GD01_Acap",
		catalogId: "ss-pajek-gd01-acap",
		description: "Graph Drawing Contest 2001, graph A capacities.",
		directed: true,
		citation: gdCitation(2001),
	},
	{
		name: "GD01_b",
		catalogId: "ss-pajek-gd01-b",
		description: "Graph Drawing Contest 2001, graph B.",
		directed: true,
		citation: gdCitation(2001),
	},
	{
		name: "GD01_c",
		catalogId: "ss-pajek-gd01-c",
		description: "Graph Drawing Contest 2001, graph C.",
		directed: true,
		citation: gdCitation(2001),
	},
	{
		name: "GD02_a",
		catalogId: "ss-pajek-gd02-a",
		description: "Graph Drawing Contest 2002, graph A.",
		directed: true,
		citation: gdCitation(2002),
	},
	{
		name: "GD02_b",
		catalogId: "ss-pajek-gd02-b",
		description: "Graph Drawing Contest 2002, graph B.",
		directed: true,
		citation: gdCitation(2002),
	},
	{
		name: "GD06_Java",
		catalogId: "ss-pajek-gd06-java",
		description: "Graph Drawing Contest 2006, Java class dependency graph.",
		directed: true,
		citation: gdCitation(2006),
	},
	{
		name: "GD06_theory",
		catalogId: "ss-pajek-gd06-theory",
		description: "Graph Drawing Contest 2006, theory graph.",
		directed: false,
		citation: gdCitation(2006),
	},
	{
		name: "GD95_a",
		catalogId: "ss-pajek-gd95-a",
		description: "Graph Drawing Contest 1995, graph A.",
		directed: true,
		citation: gdCitation(1995),
	},
	{
		name: "GD95_b",
		catalogId: "ss-pajek-gd95-b",
		description: "Graph Drawing Contest 1995, graph B.",
		directed: true,
		citation: gdCitation(1995),
	},
	{
		name: "GD95_c",
		catalogId: "ss-pajek-gd95-c",
		description: "Graph Drawing Contest 1995, graph C.",
		directed: true,
		citation: gdCitation(1995),
	},
	{
		name: "GD96_a",
		catalogId: "ss-pajek-gd96-a",
		description: "Graph Drawing Contest 1996, graph A.",
		directed: true,
		citation: gdCitation(1996),
	},
	{
		name: "GD96_b",
		catalogId: "ss-pajek-gd96-b",
		description: "Graph Drawing Contest 1996, graph B.",
		directed: true,
		citation: gdCitation(1996),
	},
	{
		name: "GD96_c",
		catalogId: "ss-pajek-gd96-c",
		description: "Graph Drawing Contest 1996, graph C.",
		directed: false,
		citation: gdCitation(1996),
	},
	{
		name: "GD96_d",
		catalogId: "ss-pajek-gd96-d",
		description: "Graph Drawing Contest 1996, graph D.",
		directed: true,
		citation: gdCitation(1996),
	},
	{
		name: "GD97_a",
		catalogId: "ss-pajek-gd97-a",
		description: "Graph Drawing Contest 1997, graph A.",
		directed: true,
		citation: gdCitation(1997),
	},
	{
		name: "GD97_b",
		catalogId: "ss-pajek-gd97-b",
		description: "Graph Drawing Contest 1997, graph B.",
		directed: false,
		citation: gdCitation(1997),
	},
	{
		name: "GD97_c",
		catalogId: "ss-pajek-gd97-c",
		description: "Graph Drawing Contest 1997, graph C.",
		directed: true,
		citation: gdCitation(1997),
	},
	{
		name: "GD98_a",
		catalogId: "ss-pajek-gd98-a",
		description: "Graph Drawing Contest 1998, graph A.",
		directed: true,
		citation: gdCitation(1998),
	},
	{
		name: "GD98_b",
		catalogId: "ss-pajek-gd98-b",
		description: "Graph Drawing Contest 1998, graph B.",
		directed: true,
		citation: gdCitation(1998),
	},
	{
		name: "GD98_c",
		catalogId: "ss-pajek-gd98-c",
		description: "Graph Drawing Contest 1998, graph C.",
		directed: false,
		citation: gdCitation(1998),
	},
	{
		name: "GD99_b",
		catalogId: "ss-pajek-gd99-b",
		description: "Graph Drawing Contest 1999, graph B.",
		directed: false,
		citation: gdCitation(1999),
	},
	{
		name: "GD99_c",
		catalogId: "ss-pajek-gd99-c",
		description: "Graph Drawing Contest 1999, graph C.",
		directed: true,
		citation: gdCitation(1999),
	},
	{
		name: "HEP-th-new",
		catalogId: "ss-pajek-hep-th-new",
		description:
			"Updated citation network from high-energy physics theory papers on arXiv.",
		directed: true,
		citation: pajekCitation("hep-th citation network (updated)", [
			"KDD Cup",
		], 2003),
	},
	{
		name: "internet",
		catalogId: "ss-pajek-internet",
		description:
			"Internet autonomous systems topology.",
		directed: true,
		citation: pajekCitation("Internet AS topology"),
		skip: "125K nodes — download separately if needed",
	},
	{
		name: "Kohonen",
		catalogId: "ss-pajek-kohonen",
		description:
			"Citation network related to Kohonen self-organising map publications.",
		directed: true,
		citation: pajekCitation("Kohonen SOM citation network"),
	},
	{
		name: "Lederberg",
		catalogId: "ss-pajek-lederberg",
		description:
			"Citation network from Lederberg's Roget thesaurus analysis.",
		directed: true,
		citation: pajekCitation("Lederberg citation network"),
	},
	{
		name: "NotreDame_yeast",
		catalogId: "ss-pajek-nd-yeast",
		description:
			"Yeast protein interaction network from Notre Dame.",
		directed: false,
		citation: pajekCitation("Notre Dame yeast protein network", [
			"H. Jeong",
		], 2001),
	},
	{
		name: "ODLIS",
		catalogId: "ss-pajek-odlis",
		description:
			"Online Dictionary for Library and Information Science hyperlink network.",
		directed: true,
		citation: pajekCitation("ODLIS hyperlink network"),
	},
	{
		name: "patents_main",
		catalogId: "ss-pajek-patents-main",
		description:
			"Main component of US patent citation network.",
		directed: true,
		citation: pajekCitation("US patent citation network (main component)", [
			"B. Hall",
			"A. Jaffe",
			"M. Trajtenberg",
		], 2001),
		skip: "241K nodes — download separately if needed",
	},
	{
		name: "Ragusa16",
		catalogId: "ss-pajek-ragusa16",
		description:
			"Social network from Ragusa study with 16 individuals.",
		directed: true,
		citation: pajekCitation("Ragusa social network (16)"),
	},
	{
		name: "Ragusa18",
		catalogId: "ss-pajek-ragusa18",
		description:
			"Social network from Ragusa study with 18 individuals.",
		directed: true,
		citation: pajekCitation("Ragusa social network (18)"),
	},
	{
		name: "Sandi_authors",
		catalogId: "ss-pajek-sandi-authors",
		description:
			"Collaboration network among Sandi conference authors.",
		directed: false,
		citation: pajekCitation("Sandi author collaboration network"),
	},
	{
		name: "SciMet",
		catalogId: "ss-pajek-scimet",
		description:
			"Scientometric citation network.",
		directed: true,
		citation: pajekCitation("Scientometric citation network"),
	},
	{
		name: "SmaGri",
		catalogId: "ss-pajek-smagri",
		description:
			"Small graph drawing contest network.",
		directed: true,
		citation: pajekCitation("SmaGri network"),
	},
	{
		name: "SmallW",
		catalogId: "ss-pajek-smallw",
		description:
			"Small-world network dataset.",
		directed: true,
		citation: pajekCitation("Small-world network"),
	},
	{
		name: "Stranke94",
		catalogId: "ss-pajek-stranke94",
		description:
			"Social network from Stranke's 1994 study.",
		directed: false,
		citation: pajekCitation("Stranke social network 1994"),
	},
	{
		name: "Tina_AskCal",
		catalogId: "ss-pajek-tina-askcal",
		description:
			"Tina's network: ask/calendar interactions.",
		directed: true,
		citation: pajekCitation("Tina network (AskCal)"),
	},
	{
		name: "Tina_AskCog",
		catalogId: "ss-pajek-tina-askcog",
		description:
			"Tina's network: ask/cognitive interactions.",
		directed: true,
		citation: pajekCitation("Tina network (AskCog)"),
	},
	{
		name: "Tina_DisCal",
		catalogId: "ss-pajek-tina-discal",
		description:
			"Tina's network: discuss/calendar interactions.",
		directed: true,
		citation: pajekCitation("Tina network (DisCal)"),
	},
	{
		name: "Tina_DisCog",
		catalogId: "ss-pajek-tina-discog",
		description:
			"Tina's network: discuss/cognitive interactions.",
		directed: true,
		citation: pajekCitation("Tina network (DisCog)"),
	},
	{
		name: "Zewail",
		catalogId: "ss-pajek-zewail",
		description:
			"Citation network related to Ahmed Zewail's Nobel Prize publications.",
		directed: true,
		citation: pajekCitation("Zewail citation network"),
	},
];

const main = async (): Promise<void> => {
	const onlyFilter = process.argv.includes("--only")
		? process.argv.slice(process.argv.indexOf("--only") + 1)
		: null;

	let downloaded = 0;
	let skipped = 0;
	let failed = 0;

	for (const entry of DATASETS) {
		if (onlyFilter && !onlyFilter.includes(entry.name)) continue;

		const outputPath = path.join(DATA_DIR, `${entry.catalogId}.json`);

		if (entry.skip && !onlyFilter) {
			console.log(`SKIP ${entry.name} (${entry.catalogId}): ${entry.skip}`);
			skipped++;
			continue;
		}

		if (fs.existsSync(outputPath) && !onlyFilter) {
			console.log(`EXISTS ${entry.name} (${entry.catalogId})`);
			skipped++;
			continue;
		}

		const url = `${SS_BASE}/${entry.name}.tar.gz`;
		console.log(`\nDownloading ${entry.name} from ${url}...`);

		try {
			const result = await fetchMtxDataset(url, {
				meta: {
					name: entry.description.split(".")[0],
					description: entry.description,
					source: `https://sparse.tamu.edu/Pajek/${entry.name}`,
					url: "http://vlado.fmf.uni-lj.si/pub/networks/data/",
					citation: entry.citation,
					retrieved: new Date().toISOString().split("T")[0],
				},
				directed: entry.directed,
			});

			fs.writeFileSync(
				outputPath,
				JSON.stringify(result.graph, null, "\t") + "\n",
			);
			console.log(
				`  Written ${entry.catalogId}.json (${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges)`,
			);
			downloaded++;
		} catch (error) {
			console.error(
				`  FAILED ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
			);
			failed++;
		}
	}

	console.log(
		`\nDone: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`,
	);
};

main().catch(console.error);
