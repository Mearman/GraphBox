/**
 * Pajek dataset configurations.
 *
 * URLs use Wayback Machine archives since the original site may be unreliable.
 */

export interface PajekDatasetConfig {
	id: string;
	name: string;
	description: string;
	url: string;
	directed: boolean;
	citation: {
		authors: string[];
		title: string;
		venue?: string;
		year: number;
	};
	category: string;
}

const WAYBACK_BASE = "https://web.archive.org/web/20231217230109";

export const PAJEK_DATASETS: PajekDatasetConfig[] = [
	// Direct .net files
	{
		id: "usair97",
		name: "US Airlines 1997",
		description: "US airline routes network from 1997. Nodes are airports, edges are flight routes.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/mix/USAir97.net`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "transport",
	},
	{
		id: "divorce",
		name: "Divorce in US",
		description: "Two-mode network of US states and grounds for divorce.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/2mode/divorce.net`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "social",
	},
	{
		id: "erdos02",
		name: "Erdos Collaboration 2002",
		description: "Collaboration network centered on Paul Erdos. Nodes are mathematicians who collaborated with Erdos or his collaborators.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/Erdos/Erdos02.net`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "collaboration",
	},
	// ZIP archives
	{
		id: "yeast",
		name: "Yeast Protein Interactions",
		description: "Protein-protein interaction network in yeast (Saccharomyces cerevisiae).",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/bio/Yeast/Yeast.zip`,
		directed: false,
		citation: {
			authors: ["H. Jeong", "S. P. Mason", "A.-L. Barabási", "Z. N. Oltvai"],
			title: "Lethality and centrality in protein networks",
			venue: "Nature",
			year: 2001,
		},
		category: "biology",
	},
	{
		id: "cities",
		name: "Cities and Services",
		description: "Two-mode network of cities and the services they provide.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/2mode/cities.zip`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "infrastructure",
	},
	{
		id: "csphd",
		name: "CS PhD Genealogy",
		description: "Computer Science PhD advisor-student relationships.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/GED/CSphd.ZIP`,
		directed: true,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "genealogy",
	},
	{
		id: "geom",
		name: "Computational Geometry Collaboration",
		description: "Collaboration network of computational geometry researchers.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/collab/geom.zip`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "collaboration",
	},
	{
		id: "roget",
		name: "Roget's Thesaurus",
		description: "Network of cross-references in Roget's Thesaurus.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/dic/roget/Roget.zip`,
		directed: true,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "dictionary",
	},
	{
		id: "gd99-linden",
		name: "GD99 Lindenstrasse",
		description: "Social network from German TV series Lindenstrasse, from Graph Drawing 1999 contest.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/GD/a99m.zip`,
		directed: false,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "social",
	},
	{
		id: "gd01-citations",
		name: "GD01 Graph Drawing Citations",
		description: "Citation network from Graph Drawing proceedings, from GD 2001 contest.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/GD/a01.zip`,
		directed: true,
		citation: {
			authors: ["Vladimir Batagelj", "Andrej Mrvar"],
			title: "Pajek Datasets",
			year: 2006,
		},
		category: "citation",
	},
	{
		id: "dic28",
		name: "Words 2-8",
		description: "Network of English words of length 2-8, connected if they differ by one letter.",
		url: `${WAYBACK_BASE}/http://vlado.fmf.uni-lj.si/pub/networks/data/dic/knuth/dic28.zip`,
		directed: false,
		citation: {
			authors: ["Donald Knuth"],
			title: "The Stanford GraphBase",
			year: 1993,
		},
		category: "dictionary",
	},
];
