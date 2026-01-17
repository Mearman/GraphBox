#!/usr/bin/env npx tsx
/**
 * Convert benchmark GML datasets to normalized JSON format.
 *
 * This script converts standard network analysis datasets from GML format
 * to the normalized JSON format used by graphbox, with proper metadata
 * and citations.
 *
 * All datasets are from Mark Newman's network data repository:
 * https://websites.umich.edu/~mejn/netdata/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseGml, gmlToJson } from "../src/formats/gml/index";
import type { GraphMeta } from "../src/formats/gml/types";

const DATA_DIR = path.join(import.meta.dirname, "../data");

// Newman's network data repository - canonical source for all datasets
const NEWMAN_SOURCE = "https://websites.umich.edu/~mejn/netdata/";

interface DatasetConfig {
	gmlFile: string;
	jsonFile: string;
	meta: Omit<GraphMeta, "directed" | "creator">;
}

const datasets: DatasetConfig[] = [
	// =========================================================================
	// Small benchmark networks (< 500 nodes)
	// =========================================================================
	{
		gmlFile: "karate.gml",
		jsonFile: "karate.json",
		meta: {
			name: "Zachary's Karate Club",
			description: "Social network of friendships between 34 members of a karate club at a US university in the 1970s.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/karate.zip",
			citation: {
				authors: ["W. W. Zachary"],
				title: "An information flow model for conflict and fission in small groups",
				journal: "Journal of Anthropological Research",
				volume: 33,
				pages: "452-473",
				year: 1977,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "lesmis.gml",
		jsonFile: "lesmiserables.json",
		meta: {
			name: "Les Miserables",
			description: "Co-appearance network of characters in Victor Hugo's novel Les Miserables. Edges connect characters that appear in the same chapter.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/lesmis.zip",
			citation: {
				authors: ["D. E. Knuth"],
				title: "The Stanford GraphBase: A Platform for Combinatorial Computing",
				publisher: "Addison-Wesley",
				location: "Reading, MA",
				year: 1993,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "adjnoun.gml",
		jsonFile: "adjnoun.json",
		meta: {
			name: "Word Adjacencies",
			description: "Adjacency network of common adjectives and nouns in the novel David Copperfield by Charles Dickens. Nodes represent words and edges connect words that appear adjacent to each other. The 'value' property indicates word type: 0 for adjective, 1 for noun.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/adjnoun.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "Finding community structure in very large networks",
				journal: "Physical Review E",
				volume: 74,
				pages: "036104",
				year: 2006,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "football.gml",
		jsonFile: "football.json",
		meta: {
			name: "American College Football",
			description: "Network of American football games between Division IA colleges during regular season Fall 2000. Nodes represent teams and edges connect teams that played each other. The 'value' property indicates conference membership.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/football.zip",
			citation: {
				authors: ["M. Girvan", "M. E. J. Newman"],
				title: "Community structure in social and biological networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 99,
				pages: "7821-7826",
				year: 2002,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "dolphins.gml",
		jsonFile: "dolphins.json",
		meta: {
			name: "Dolphin Social Network",
			description: "Undirected social network of frequent associations between 62 dolphins in a community living off Doubtful Sound, New Zealand.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/dolphins.zip",
			citation: {
				authors: ["D. Lusseau", "K. Schneider", "O. J. Boisseau", "P. Haase", "E. Slooten", "S. M. Dawson"],
				title: "The bottlenose dolphin community of Doubtful Sound features a large proportion of long-lasting associations",
				journal: "Behavioral Ecology and Sociobiology",
				volume: 54,
				pages: "396-405",
				year: 2003,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "polbooks.gml",
		jsonFile: "polbooks.json",
		meta: {
			name: "Books about US Politics",
			description: "Network of books about US politics published around the time of the 2004 presidential election, sold by Amazon.com. Edges connect books frequently co-purchased by the same buyers. The 'value' property indicates political alignment: 'l' for liberal, 'n' for neutral, 'c' for conservative.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/polbooks.zip",
			citation: {
				authors: ["V. Krebs"],
				title: "Books about US Politics",
				year: 2004,
				type: "other",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "celegansneural.gml",
		jsonFile: "celegans.json",
		meta: {
			name: "C. Elegans Neural Network",
			description: "Directed, weighted network representing the neural network of the nematode C. Elegans. Nodes are neurons and edges represent synaptic connections.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/celegansneural.zip",
			citation: {
				authors: ["D. J. Watts", "S. H. Strogatz"],
				title: "Collective dynamics of 'small-world' networks",
				journal: "Nature",
				volume: 393,
				pages: "440-442",
				year: 1998,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},

	// =========================================================================
	// Medium networks (500 - 5000 nodes)
	// =========================================================================
	{
		gmlFile: "polblogs.gml",
		jsonFile: "polblogs.json",
		meta: {
			name: "Political Blogs",
			description: "Directed network of hyperlinks between weblogs on US politics, recorded in 2005. The 'value' property indicates political leaning: 0 for left/liberal, 1 for right/conservative.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/polblogs.zip",
			citation: {
				authors: ["L. A. Adamic", "N. Glance"],
				title: "The political blogosphere and the 2004 US Election: Divided they blog",
				journal: "Proceedings of the 3rd International Workshop on Link Discovery",
				pages: "36-43",
				year: 2005,
				type: "conference",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "netscience.gml",
		jsonFile: "netscience.json",
		meta: {
			name: "Network Science Coauthorships",
			description: "Coauthorship network of scientists working on network theory and experiment, compiled by M. Newman in May 2006.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/netscience.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "Finding community structure in very large networks",
				journal: "Physical Review E",
				volume: 74,
				pages: "036104",
				year: 2006,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "power.gml",
		jsonFile: "power.json",
		meta: {
			name: "Western States Power Grid",
			description: "Undirected, unweighted network representing the topology of the Western States Power Grid of the United States. Nodes represent generators, transformers, and substations.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/power.zip",
			citation: {
				authors: ["D. J. Watts", "S. H. Strogatz"],
				title: "Collective dynamics of 'small-world' networks",
				journal: "Nature",
				volume: 393,
				pages: "440-442",
				year: 1998,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},

	// =========================================================================
	// Large collaboration networks (> 5000 nodes)
	// =========================================================================
	{
		gmlFile: "hep-th.gml",
		jsonFile: "hep-th.json",
		meta: {
			name: "High-Energy Theory Collaborations",
			description: "Weighted network of coauthorships between scientists posting preprints on the High-Energy Theory E-Print Archive between Jan 1, 1995 and December 31, 1999.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/hep-th.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "The structure of scientific collaboration networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 98,
				pages: "404-409",
				year: 2001,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "astro-ph.gml",
		jsonFile: "astro-ph.json",
		meta: {
			name: "Astrophysics Collaborations",
			description: "Weighted network of coauthorships between scientists posting preprints on the Astrophysics E-Print Archive between Jan 1, 1995 and December 31, 1999.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/astro-ph.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "The structure of scientific collaboration networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 98,
				pages: "404-409",
				year: 2001,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "cond-mat.gml",
		jsonFile: "cond-mat.json",
		meta: {
			name: "Condensed Matter Collaborations 1999",
			description: "Weighted network of coauthorships between scientists posting preprints on the Condensed Matter E-Print Archive between Jan 1, 1995 and December 31, 1999.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/cond-mat.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "The structure of scientific collaboration networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 98,
				pages: "404-409",
				year: 2001,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "cond-mat-2003.gml",
		jsonFile: "cond-mat-2003.json",
		meta: {
			name: "Condensed Matter Collaborations 2003",
			description: "Weighted network of coauthorships between scientists posting preprints on the Condensed Matter E-Print Archive between Jan 1, 1995 and June 30, 2003.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/cond-mat-2003.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "The structure of scientific collaboration networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 98,
				pages: "404-409",
				year: 2001,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "cond-mat-2005.gml",
		jsonFile: "cond-mat-2005.json",
		meta: {
			name: "Condensed Matter Collaborations 2005",
			description: "Weighted network of coauthorships between scientists posting preprints on the Condensed Matter E-Print Archive between Jan 1, 1995 and March 31, 2005.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/cond-mat-2005.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "The structure of scientific collaboration networks",
				journal: "Proceedings of the National Academy of Sciences",
				volume: 98,
				pages: "404-409",
				year: 2001,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
	{
		gmlFile: "as-22july06.gml",
		jsonFile: "internet.json",
		meta: {
			name: "Internet Autonomous Systems",
			description: "Symmetrized snapshot of the structure of the Internet at the level of autonomous systems, reconstructed from BGP tables posted by the University of Oregon Route Views Project. Snapshot from July 22, 2006.",
			source: NEWMAN_SOURCE,
			url: "https://websites.umich.edu/~mejn/netdata/as-22july06.zip",
			citation: {
				authors: ["M. E. J. Newman"],
				title: "Internet Autonomous Systems snapshot",
				year: 2006,
				type: "other",
			},
			retrieved: new Date().toISOString().split("T")[0],
		},
	},
];

const main = (): void => {
	let converted = 0;
	let skipped = 0;

	for (const dataset of datasets) {
		const gmlPath = path.join(DATA_DIR, dataset.gmlFile);
		const jsonPath = path.join(DATA_DIR, dataset.jsonFile);

		if (!fs.existsSync(gmlPath)) {
			console.error(`Skipping ${dataset.gmlFile}: file not found`);
			skipped++;
			continue;
		}

		console.log(`Converting ${dataset.gmlFile} -> ${dataset.jsonFile}`);

		const gmlContent = fs.readFileSync(gmlPath, "utf-8");
		const doc = parseGml(gmlContent);
		const json = gmlToJson(doc, { meta: dataset.meta });

		fs.writeFileSync(jsonPath, JSON.stringify(json, null, "\t") + "\n");
		console.log(`  Nodes: ${json.nodes.length}, Edges: ${json.edges.length}, Directed: ${json.meta.directed}`);
		converted++;
	}

	console.log(`\nDone! Converted: ${converted}, Skipped: ${skipped}`);
};

main();
