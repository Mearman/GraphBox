/**
 * Pajek dataset configurations.
 *
 * URLs use Wayback Machine archives since the original site (vlado.fmf.uni-lj.si) is offline.
 * Each entry specifies a Wayback timestamp appropriate for that file.
 *
 * Datasets may have multiple source URLs (e.g., Wayback + SuiteSparse).
 * The `format` field indicates which parser to use: "pajek" (.net/.paj) or "gd4".
 */

export interface DatasetSourceUrl {
	/** Download URL */
	url: string;
	/** Source name (e.g., "wayback", "suitesparse") */
	source: string;
	/** File format at this URL if different from the dataset default */
	format?: "pajek" | "gd4" | "matrix-market";
}

export interface PajekDatasetConfig {
	id: string;
	name: string;
	description: string;
	/** Primary download URL */
	url: string;
	/** Alternative source URLs */
	alternateUrls?: DatasetSourceUrl[];
	/** File format: "pajek" for .net/.paj (default), "gd4" for Graph Drawing 2004 format */
	format?: "pajek" | "gd4";
	/** For GD4 ZIPs: specific .gd4 entry to extract (e.g., "challenge/prob1.gd4") */
	entryName?: string;
	directed: boolean;
	citation: {
		authors: string[];
		title: string;
		venue?: string;
		year: number;
	};
	category: string;
}

const wb = (timestamp: string, path: string): string =>
	`https://web.archive.org/web/${timestamp}/http://vlado.fmf.uni-lj.si/pub/networks/data/${path}`;

/** Default timestamp used by older entries. */
const TS_DEFAULT = "20231217230109";

export const PAJEK_DATASETS: PajekDatasetConfig[] = [
	// ─── Existing entries ─────────────────────────────────────────────

	{
		id: "usair97",
		name: "US Airlines 1997",
		description: "US airline routes network from 1997. Nodes are airports, edges are flight routes.",
		url: wb(TS_DEFAULT, "mix/USAir97.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "transport",
	},
	{
		id: "divorce",
		name: "Divorce in US",
		description: "Two-mode network of US states and grounds for divorce.",
		url: wb(TS_DEFAULT, "2mode/divorce.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "social",
	},
	{
		id: "erdos02",
		name: "Erdos Collaboration 2002",
		description: "Collaboration network centred on Paul Erdos, 2002 version.",
		url: wb(TS_DEFAULT, "Erdos/Erdos02.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "yeast",
		name: "Yeast Protein Interactions",
		description: "Protein-protein interaction network in yeast (Saccharomyces cerevisiae).",
		url: wb(TS_DEFAULT, "bio/Yeast/Yeast.zip"),
		directed: false,
		citation: {
			authors: ["H. Jeong", "S. P. Mason", "A.-L. Barabasi", "Z. N. Oltvai"],
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
		url: wb(TS_DEFAULT, "2mode/cities.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "infrastructure",
	},
	{
		id: "csphd",
		name: "CS PhD Genealogy",
		description: "Computer Science PhD advisor-student relationships.",
		url: wb(TS_DEFAULT, "GED/CSphd.ZIP"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "genealogy",
	},
	{
		id: "geom",
		name: "Computational Geometry Collaboration",
		description: "Collaboration network of computational geometry researchers.",
		url: wb(TS_DEFAULT, "collab/geom.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "roget",
		name: "Roget's Thesaurus",
		description: "Network of cross-references in Roget's Thesaurus.",
		url: wb(TS_DEFAULT, "dic/roget/Roget.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "dictionary",
	},
	{
		id: "gd99-linden",
		name: "GD99 Lindenstrasse",
		description: "Social network from German TV series Lindenstrasse, from Graph Drawing 1999 contest.",
		url: wb(TS_DEFAULT, "GD/a99m.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "social",
	},
	{
		id: "gd01-citations",
		name: "GD01 Graph Drawing Citations",
		description: "Citation network from Graph Drawing proceedings, from GD 2001 contest.",
		url: wb(TS_DEFAULT, "GD/a01.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "dic28",
		name: "Words 2-8",
		description: "Network of English words of length 2-8, connected if they differ by one letter.",
		url: wb(TS_DEFAULT, "dic/knuth/dic28.zip"),
		directed: false,
		citation: { authors: ["Donald Knuth"], title: "The Stanford GraphBase", year: 1993 },
		category: "dictionary",
	},

	// ─── Erdos collaboration variants ─────────────────────────────────

	{
		id: "pajek-erdos-971",
		name: "Erdos Collaboration 1997 (Core)",
		description: "Core Erdos collaboration network, 1997 version. Direct collaborators only.",
		url: wb("20041222053441", "erdos/ERDOS971.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "pajek-erdos-972",
		name: "Erdos Collaboration 1997 (Extended)",
		description: "Extended Erdos collaboration network, 1997 version. Includes second-order collaborators.",
		url: wb("20041222053333", "erdos/ERDOS972.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "pajek-erdos-981",
		name: "Erdos Collaboration 1998 (Core)",
		description: "Core Erdos collaboration network, 1998 version.",
		url: wb("20041222053334", "erdos/ERDOS981.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "pajek-erdos-982",
		name: "Erdos Collaboration 1998 (Extended)",
		description: "Extended Erdos collaboration network, 1998 version.",
		url: wb("20041222053233", "erdos/ERDOS982.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "pajek-erdos-991",
		name: "Erdos Collaboration 1999 (Core)",
		description: "Core Erdos collaboration network, 1999 version.",
		url: wb("20041222053056", "erdos/ERDOS991.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	{
		id: "pajek-erdos-992",
		name: "Erdos Collaboration 1999 (Extended)",
		description: "Extended Erdos collaboration network, 1999 version.",
		url: wb("20041222053448", "erdos/ERDOS992.NET"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},

	// ─── Citation networks ────────────────────────────────────────────

	{
		id: "pajek-smallw",
		name: "Small World Citations",
		description: "Citation network around small-world research papers.",
		url: wb("20051030090325", "cite/SmallW.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-smagri",
		name: "Scientometrics Citations",
		description: "Citation network from Scientometrics literature.",
		url: wb("20051030090258", "cite/SmaGri.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-scimet",
		name: "Science of Science Citations",
		description: "Citation network from science of science research.",
		url: wb("20051030090232", "cite/SciMet.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-kohonen",
		name: "Kohonen Citations",
		description: "Citation network around self-organising maps research (Teuvo Kohonen).",
		url: wb("20051030091159", "cite/Kohonen.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-zewail",
		name: "Zewail Citations",
		description: "Citation network around Ahmed Zewail's femtochemistry research.",
		url: wb("20051030090354", "cite/Zewail.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-lederberg",
		name: "Lederberg Citations",
		description: "Citation network around Joshua Lederberg's genetics research.",
		url: wb("20051030093229", "cite/Lederberg.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-hep-th",
		name: "HEP-TH Citations",
		description: "High-energy physics theory citation network (KDD Cup 2003). 27,770 papers, 352,807 citations.",
		url: wb("20130507082812", "hep-th/hep-th.zip"),
		directed: true,
		citation: { authors: ["J. Gehrke", "P. Ginsparg", "J. Kleinberg"], title: "KDD Cup 2003", year: 2003 },
		category: "citation",
	},

	// ─── Dictionary/thesaurus networks ────────────────────────────────

	{
		id: "pajek-eat",
		name: "Edinburgh Associative Thesaurus",
		description: "Word association network from the Edinburgh Associative Thesaurus. 23,219 words, 325,624 associations.",
		url: wb("20150930233249", "dic/eat/EATnew.zip"),
		directed: true,
		citation: { authors: ["G. R. Kiss", "C. Armstrong", "R. Milroy", "J. Piper"], title: "An associative thesaurus of English", year: 1973 },
		category: "dictionary",
	},
	{
		id: "pajek-odlis",
		name: "ODLIS Dictionary",
		description: "Cross-reference network from the Online Dictionary for Library and Information Science.",
		url: wb("20130507085610", "dic/odlis/odlis.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "dictionary",
	},
	{
		id: "pajek-foldoc",
		name: "FOLDOC Dictionary",
		description: "Cross-reference network from the Free On-Line Dictionary of Computing.",
		url: wb("20201118122652", "dic/foldoc/foldoc.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "dictionary",
	},
	{
		id: "pajek-wordnet",
		name: "WordNet",
		description: "Lexical reference network from Princeton WordNet. 82,670 synsets, 133,445 relations.",
		url: wb("20130429125300", "dic/Wordnet/wordNet.zip"),
		directed: true,
		citation: { authors: ["G. A. Miller"], title: "WordNet: A Lexical Database for English", venue: "CACM", year: 1995 },
		category: "dictionary",
	},
	{
		id: "pajek-freeassoc",
		name: "USF Free Association Norms",
		description: "Word association network from the University of South Florida Free Association Norms.",
		url: wb("20130507104108", "dic/fa/Pairs.zip"),
		directed: true,
		citation: {
			authors: ["D. L. Nelson", "C. L. McEvoy", "T. A. Schreiber"],
			title: "The University of South Florida word association, rhyme, and word fragment norms",
			year: 1998,
		},
		category: "dictionary",
	},

	// ─── Two-mode / bipartite networks ────────────────────────────────

	{
		id: "pajek-sandi",
		name: "Graph Products Collaboration",
		description: "Two-mode network of authors and papers on graph products. 674 authors, 314 papers.",
		url: wb("20041223165353", "2mode/Sandi/sandi.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "collaboration",
	},
	// ─── Social networks ──────────────────────────────────────────────

	{
		id: "pajek-stranke94",
		name: "Slovene Political Parties 1994",
		description: "Perceived closeness between Slovenian political parties, 1994.",
		url: wb("20041223164743", "soc/Samo/Stranke94.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "social",
	},
	{
		id: "pajek-tina",
		name: "Tina Social Network",
		description: "Multi-relational social network study (discussion/cognitive agreement).",
		url: wb("20060824164209", "soc/Tina/tina.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "social",
	},
	{
		id: "pajek-football",
		name: "World Soccer 1998",
		description: "World Cup 1998 match network. 35 teams, 118 matches.",
		url: wb("20070317031902", "sport/football.net"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "sport",
	},

	// ─── Economics ─────────────────────────────────────────────────────

	{
		id: "pajek-eva",
		name: "EVA Ownership Network",
		description: "Corporate ownership network from EVA database. 8,343 entities, 6,726 ownership links.",
		url: wb("20130507094755", "econ/Eva/EVA.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "economics",
	},

	// ─── Terrorism ─────────────────────────────────────────────────────

	{
		id: "pajek-sept11",
		name: "September 11 News Network",
		description: "Daily network of September 11 news connections. 13,332 nodes, 243,447 links.",
		url: wb("20070105133418", "CRA/Days.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "communication",
	},

	// ─── Political events ──────────────────────────────────────────────

	{
		id: "pajek-keds",
		name: "KEDS Gulf War Political Events",
		description: "Political event network from the Kansas Event Data System (Gulf War, daily aggregation).",
		url: wb("20070105075919", "KEDS/GulfLDays.zip"),
		directed: true,
		citation: { authors: ["Philip Schrodt"], title: "Kansas Event Data System", year: 2001 },
		category: "political",
	},

	// ─── Large networks ────────────────────────────────────────────────

	{
		id: "pajek-nd-www",
		name: "Notre Dame WWW",
		description: "Web graph of the University of Notre Dame domain. 325,729 pages, 1,497,135 hyperlinks.",
		url: wb("20130507100020", "ND/NDwww.zip"),
		directed: true,
		citation: {
			authors: ["R. Albert", "H. Jeong", "A.-L. Barabasi"],
			title: "Diameter of the World-Wide Web",
			venue: "Nature",
			year: 1999,
		},
		category: "web",
	},
	{
		id: "pajek-nd-actors",
		name: "Notre Dame Actors",
		description: "Two-mode network of actors and films. 392,400 actors, 127,823 films, 1,470,418 appearances.",
		url: wb("20130507091047", "ND/NDactors.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "social",
	},
	{
		id: "pajek-netscience",
		name: "Network Science Collaboration",
		description: "Collaboration network of network science researchers. 1,589 authors.",
		url: wb("20130507102014", "collab/NetScience.zip"),
		directed: false,
		citation: { authors: ["M. E. J. Newman"], title: "Finding community structure in very large networks", year: 2004 },
		category: "collaboration",
	},

	// ─── Graph Drawing contests ────────────────────────────────────────

	{
		id: "pajek-gd95",
		name: "GD95 Contest Graph A",
		description: "Graph Drawing 1995 contest, Problem A. 36 vertices, 57 arcs.",
		url: wb("20040920012353", "GD/gd95/A95.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd96",
		name: "GD96 Contest Graph A",
		description: "Graph Drawing 1996 contest, Problem A. 1,096 vertices, 1,691 arcs.",
		url: wb("20040920012611", "GD/gd96/A96.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd97",
		name: "GD97 Contest Graph A",
		description: "Graph Drawing 1997 contest, Problem A. 84 vertices, 332 arcs.",
		url: wb("20040920012507", "GD/gd97/A97.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd98",
		name: "GD98 Contest Graph A",
		description: "Graph Drawing 1998 contest, Problem A. 38 vertices, 50 arcs.",
		url: wb("20040920012932", "GD/gd98/A98.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd00",
		name: "GD00 Contest Graph A",
		description: "Graph Drawing 2000 contest, Problem A. 352 vertices, 458 arcs.",
		url: wb("20040920012906", "GD/gd00/A00.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd02",
		name: "GD02 Contest Graph A",
		description: "Graph Drawing 2002 contest, Problem A. 23 vertices, 87 arcs.",
		url: wb("20130507074322", "GD/gd02/A02.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd03",
		name: "GD03 Contest Graph A",
		description: "Graph Drawing 2003 contest, Problem A. 423 vertices, 578 arcs.",
		url: wb("20130507072417", "GD/gd03/A03.net"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd06",
		name: "GD06 World Cup Network",
		description: "World Cup network from Graph Drawing 2006 contest. 79 vertices, 1,460 arcs.",
		url: wb("20130507072520", "GD/GD06/WC.net.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "graph-drawing",
	},

	// ─── .paj format datasets ─────────────────────────────────────────

	{
		id: "pajek-dutch-elite",
		name: "Dutch Elite Network",
		description: "Interlocking directorates of the top 200 Dutch companies. Two-mode network of directors and boards.",
		url: wb("20130507085455", "2mode/dutchelite.zip"),
		directed: false,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "economics",
	},
	{
		id: "pajek-journals",
		name: "Slovenian Journals Citation",
		description: "Citation network between Slovenian scientific journals (Revije).",
		url: wb("20130507053929", "2mode/revije.zip"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "citation",
	},
	{
		id: "pajek-glosstg",
		name: "Graph Theory Glossary",
		description: "Cross-reference network from a graph theory glossary. 72 terms, 122 references.",
		url: wb("20041222052810", "DIC/TG/glossTG.paj"),
		directed: true,
		citation: { authors: ["Vladimir Batagelj", "Andrej Mrvar"], title: "Pajek Datasets", year: 2006 },
		category: "dictionary",
	},

	// ─── GD 2004 contest (.gd4 format) ────────────────────────────────

	{
		id: "pajek-gd04-prob1",
		name: "GD04 Contest Problem 1",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 1. 69 nodes, 151 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob1.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob2",
		name: "GD04 Contest Problem 2",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 2. 96 nodes, 214 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob2.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob3",
		name: "GD04 Contest Problem 3",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 3. 102 nodes, 224 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob3.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob4",
		name: "GD04 Contest Problem 4",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 4. 20 nodes, 36 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob4.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob5",
		name: "GD04 Contest Problem 5",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 5. 40 nodes, 115 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob5.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob6",
		name: "GD04 Contest Problem 6",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 6. 80 nodes, 312 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob6.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob7",
		name: "GD04 Contest Problem 7",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 7. 40 nodes, 143 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob7.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob8",
		name: "GD04 Contest Problem 8",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 8. 100 nodes, 477 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob8.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob9",
		name: "GD04 Contest Problem 9",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 9. 112 nodes, 168 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob9.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
	{
		id: "pajek-gd04-prob10",
		name: "GD04 Contest Problem 10",
		description: "Graph Drawing 2004 crossing minimisation contest, Problem 10. 64 nodes, 125 edges.",
		url: wb("20130507072305", "GD/gd04/gd04.zip"),
		format: "gd4",
		entryName: "challenge/prob10.gd4",
		directed: false,
		citation: { authors: ["S. Kobourov"], title: "GD 2004 Graph Drawing Contest", year: 2004 },
		category: "graph-drawing",
	},
];
