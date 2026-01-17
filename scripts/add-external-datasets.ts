#!/usr/bin/env npx tsx
/**
 * Add dataset entries from external sources to the catalog.
 *
 * These datasets are discovered from various network data repositories
 * but haven't been downloaded/parsed yet. They are added with placeholder
 * statistics that will be populated when the data is processed.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_PATH = path.join(import.meta.dirname, "../src/data/catalog.json");

interface Citation {
	authors: string[];
	title: string;
	journal?: string;
	volume?: number;
	pages?: string;
	year: number;
	type: string;
	publisher?: string;
}

interface DatasetEntry {
	id: string;
	name: string;
	description: string;
	source: string;
	url: string;
	citation: Citation;
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
	/** Indicates data hasn't been downloaded/parsed yet */
	stub?: boolean;
}

interface Catalog {
	version: string;
	generated: string;
	sources: Record<string, unknown>;
	datasetCount: number;
	datasets: Record<string, DatasetEntry>;
}

// Arenas datasets (from 2013 archive)
const arenasDatasets: DatasetEntry[] = [
	{
		id: "arenas-email",
		name: "Email Network URV",
		description: "E-mail interchanges between members of the University Rovira i Virgili (Tarragona).",
		source: "arenas",
		url: "http://deim.urv.cat/~aarenas/data/xarxes/email.zip",
		citation: {
			authors: ["R. Guimera", "L. Danon", "A. Diaz-Guilera", "F. Giralt", "A. Arenas"],
			title: "Self-similar community structure in a network of human interactions",
			journal: "Physical Review E",
			volume: 68,
			pages: "065103(R)",
			year: 2003,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 1133,
		edgeCount: 5451,
		directed: true,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: false,
		stub: true,
	},
	{
		id: "arenas-jazz",
		name: "Jazz Musicians Network",
		description: "Collaboration network of jazz musicians. Nodes are musicians and edges represent playing together in a band.",
		source: "arenas",
		url: "http://deim.urv.cat/~aarenas/data/xarxes/jazz.zip",
		citation: {
			authors: ["P. Gleiser", "L. Danon"],
			title: "Community Structure in Jazz",
			journal: "Advances in Complex Systems",
			volume: 6,
			pages: "565",
			year: 2003,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 198,
		edgeCount: 2742,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
	{
		id: "arenas-pgp",
		name: "PGP Network",
		description: "Giant component of the network of users of the Pretty-Good-Privacy algorithm for secure information interchange.",
		source: "arenas",
		url: "http://deim.urv.cat/~aarenas/data/xarxes/PGP.zip",
		citation: {
			authors: ["M. Boguña", "R. Pastor-Satorras", "A. Diaz-Guilera", "A. Arenas"],
			title: "Models of social networks based on social distance attachment",
			journal: "Physical Review E",
			volume: 70,
			pages: "056122",
			year: 2004,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 10680,
		edgeCount: 24316,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: false,
		stub: true,
	},
	{
		id: "arenas-celegans-metabolic",
		name: "C. elegans Metabolic Network",
		description: "Metabolic network of the nematode C. elegans.",
		source: "arenas",
		url: "http://deim.urv.cat/~aarenas/data/xarxes/celegans_metabolic.zip",
		citation: {
			authors: ["J. Duch", "A. Arenas"],
			title: "Community identification using Extremal Optimization",
			journal: "Physical Review E",
			volume: 72,
			pages: "027104",
			year: 2005,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 453,
		edgeCount: 2025,
		directed: true,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
];

// Barabási Lab datasets (from 2009 archive)
const barabasiDatasets: DatasetEntry[] = [
	{
		id: "barabasi-www",
		name: "World-Wide-Web",
		description: "Hyperlink network of web pages from a 1999 crawl of the nd.edu domain.",
		source: "barabasi",
		url: "http://www.nd.edu/~networks/resources/www/www.dat.gz",
		citation: {
			authors: ["R. Albert", "H. Jeong", "A.-L. Barabási"],
			title: "Diameter of the World Wide Web",
			journal: "Nature",
			volume: 401,
			pages: "130-131",
			year: 1999,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 325729,
		edgeCount: 1497134,
		directed: true,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: false,
		stub: true,
	},
	{
		id: "barabasi-actor",
		name: "Actor Collaboration Network",
		description: "Collaboration network of film actors from IMDB. Nodes are actors, edges connect actors who appeared in the same movie.",
		source: "barabasi",
		url: "http://www.nd.edu/~networks/resources/actor/actor.dat.gz",
		citation: {
			authors: ["A.-L. Barabási", "R. Albert"],
			title: "Emergence of scaling in random networks",
			journal: "Science",
			volume: 286,
			pages: "509-512",
			year: 1999,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 392340,
		edgeCount: 15038083,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
	{
		id: "barabasi-protein-yeast",
		name: "Yeast Protein Interaction Network",
		description: "Protein-protein interaction network for Saccharomyces cerevisiae (yeast).",
		source: "barabasi",
		url: "http://www.nd.edu/~networks/resources/protein/bo.dat.gz",
		citation: {
			authors: ["H. Jeong", "S. Mason", "A.-L. Barabási", "Z. N. Oltvai"],
			title: "Centrality and lethality of protein networks",
			journal: "Nature",
			volume: 411,
			pages: "41-42",
			year: 2001,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 2114,
		edgeCount: 2277,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
];

// UCI Network Data Repository datasets
const uciDatasets: DatasetEntry[] = [
	{
		id: "uci-bkfrat",
		name: "Bernard & Killworth Fraternity",
		description: "Social interactions among students living in a fraternity at a West Virginia college.",
		source: "uci",
		url: "https://networkdata.ics.uci.edu/netdata/data/bkfrat.zip",
		citation: {
			authors: ["H. Bernard", "P. Killworth", "L. Sailer"],
			title: "Informant accuracy in social network data IV",
			journal: "Social Networks",
			volume: 2,
			pages: "191-218",
			year: 1980,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 58,
		edgeCount: 0,
		directed: false,
		weighted: true,
		hasNodeAttributes: false,
		hasEdgeAttributes: true,
		labeled: false,
		stub: true,
	},
	{
		id: "uci-davis",
		name: "Davis Southern Women",
		description: "Bipartite network of 18 Southern women and 14 social events they attended in the 1930s.",
		source: "uci",
		url: "https://networkdata.ics.uci.edu/netdata/data/davis.zip",
		citation: {
			authors: ["A. Davis", "B. B. Gardner", "M. R. Gardner"],
			title: "Deep South",
			publisher: "University of Chicago Press",
			year: 1941,
			type: "book",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 32,
		edgeCount: 89,
		directed: false,
		weighted: false,
		hasNodeAttributes: true,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
	{
		id: "uci-sampson",
		name: "Sampson Monastery",
		description: "Social relations (liking, esteem, influence, praise) among novices in a New England monastery.",
		source: "uci",
		url: "https://networkdata.ics.uci.edu/netdata/data/sampson.zip",
		citation: {
			authors: ["S. Sampson"],
			title: "Crisis in a cloister",
			publisher: "Cornell University",
			year: 1969,
			type: "thesis",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 18,
		edgeCount: 0,
		directed: true,
		weighted: true,
		hasNodeAttributes: true,
		hasEdgeAttributes: true,
		labeled: true,
		stub: true,
	},
	{
		id: "uci-florentine",
		name: "Florentine Families",
		description: "Marriage and business ties among Renaissance Florentine families, including the Medicis.",
		source: "uci",
		url: "https://networkdata.ics.uci.edu/netdata/data/florentine.zip",
		citation: {
			authors: ["J. F. Padgett", "C. K. Ansell"],
			title: "Robust Action and the Rise of the Medici, 1400-1434",
			journal: "American Journal of Sociology",
			volume: 98,
			pages: "1259-1319",
			year: 1993,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 16,
		edgeCount: 35,
		directed: false,
		weighted: false,
		hasNodeAttributes: true,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
];

// UCINet datasets
const ucinetDatasets: DatasetEntry[] = [
	{
		id: "ucinet-zachary",
		name: "Zachary Karate Club",
		description: "Social network of a university karate club. Famous for the split following disputes between members.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/zachary.dat",
		citation: {
			authors: ["W. Zachary"],
			title: "An information flow model for conflict and fission in small groups",
			journal: "Journal of Anthropological Research",
			volume: 33,
			pages: "452-473",
			year: 1977,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 34,
		edgeCount: 78,
		directed: false,
		weighted: true,
		hasNodeAttributes: false,
		hasEdgeAttributes: true,
		labeled: false,
		stub: true,
	},
	{
		id: "ucinet-padgett",
		name: "Padgett Florentine Families",
		description: "Business and marriage ties among Renaissance Florentine families. The Medici vs Strozzi conflict.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/padgett.dat",
		citation: {
			authors: ["R. Breiger", "P. Pattison"],
			title: "Cumulated social roles: The duality of persons and their algebras",
			journal: "Social Networks",
			volume: 8,
			pages: "215-256",
			year: 1986,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 16,
		edgeCount: 35,
		directed: false,
		weighted: false,
		hasNodeAttributes: true,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
	{
		id: "ucinet-gama",
		name: "Gahuku-Gama Highland Tribes",
		description: "Alliance and antagonism relations among 16 tribes in the Eastern Central Highlands of New Guinea.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/gama.dat",
		citation: {
			authors: ["K. Read"],
			title: "Cultures of the central highlands, New Guinea",
			journal: "Southwestern Journal of Anthropology",
			volume: 10,
			pages: "1-43",
			year: 1954,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 16,
		edgeCount: 58,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: true,
		labeled: true,
		stub: true,
	},
	{
		id: "ucinet-taro",
		name: "Schwimmer Taro Exchange",
		description: "Gift-giving (taro exchange) among 22 households in a Papuan village.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/taro.dat",
		citation: {
			authors: ["E. Schwimmer"],
			title: "Exchange in the social structure of the Orokaiva",
			publisher: "St Martins",
			year: 1973,
			type: "book",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 22,
		edgeCount: 39,
		directed: false,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: true,
		stub: true,
	},
	{
		id: "ucinet-prison",
		name: "Gagnon Prison",
		description: "Friendship choices among 67 prison inmates in a 1950s study.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/prison.dat",
		citation: {
			authors: ["J. MacRae"],
			title: "Direct factor analysis of sociometric data",
			journal: "Sociometry",
			volume: 23,
			pages: "360-371",
			year: 1960,
			type: "article",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 67,
		edgeCount: 182,
		directed: true,
		weighted: false,
		hasNodeAttributes: false,
		hasEdgeAttributes: false,
		labeled: false,
		stub: true,
	},
	{
		id: "ucinet-wiring",
		name: "Hawthorne Bank Wiring Room",
		description: "Observational data on 14 Western Electric employees from the famous Hawthorne studies.",
		source: "ucinet",
		url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/wiring.dat",
		citation: {
			authors: ["F. Roethlisberger", "W. Dickson"],
			title: "Management and the worker",
			publisher: "Cambridge University Press",
			year: 1939,
			type: "book",
		},
		retrieved: "2026-01-17",
		rawBytes: 0,
		nodeCount: 14,
		edgeCount: 0,
		directed: false,
		weighted: false,
		hasNodeAttributes: true,
		hasEdgeAttributes: true,
		labeled: true,
		stub: true,
	},
];

const main = (): void => {
	const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as Catalog;

	const allNewDatasets = [
		...arenasDatasets,
		...barabasiDatasets,
		...uciDatasets,
		...ucinetDatasets,
	];

	let added = 0;
	let skipped = 0;

	for (const dataset of allNewDatasets) {
		if (catalog.datasets[dataset.id]) {
			console.log(`Skipping ${dataset.id} (already exists)`);
			skipped++;
			continue;
		}

		catalog.datasets[dataset.id] = dataset;
		console.log(`Added ${dataset.id} (${dataset.source})`);
		added++;
	}

	// Update counts
	catalog.datasetCount = Object.keys(catalog.datasets).length;
	catalog.generated = new Date().toISOString();

	// Write updated catalog
	fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, "\t") + "\n");

	console.log(`\nDone!`);
	console.log(`  Added: ${added}`);
	console.log(`  Skipped: ${skipped}`);
	console.log(`  Total datasets: ${catalog.datasetCount}`);
};

main();
