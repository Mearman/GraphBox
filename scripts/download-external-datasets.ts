#!/usr/bin/env npx tsx
/**
 * Download and parse external datasets from Wayback Machine archives.
 *
 * Converts various formats (edge lists, adjacency matrices, UCINET DAT)
 * to the standard JSON format used by graph-box.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.join(import.meta.dirname, "../data");
const TEMP_DIR = "/tmp/graph-box-download";

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

interface DatasetMeta {
	name: string;
	description: string;
	source: string;
	url: string;
	citation: Citation;
	retrieved: string;
	directed: boolean;
	creator?: string;
}

interface Node {
	id: string;
	[key: string]: unknown;
}

interface Edge {
	source: string;
	target: string;
	[key: string]: unknown;
}

interface Dataset {
	meta: DatasetMeta;
	nodes: Node[];
	edges: Edge[];
}

// Ensure directories exist
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const download = (url: string, filename: string): string => {
	const filepath = path.join(TEMP_DIR, filename);
	console.log(`  Downloading ${url}...`);
	execSync(`/usr/bin/curl -sL "${url}" -o "${filepath}"`, { stdio: "inherit" });
	return filepath;
};

const unzip = (zipPath: string): string => {
	const dir = zipPath.replace(/\.zip$/, "");
	fs.mkdirSync(dir, { recursive: true });
	execSync(`/usr/bin/unzip -o -q "${zipPath}" -d "${dir}"`, { stdio: "inherit" });
	return dir;
};

const gunzip = (gzPath: string): string => {
	const outPath = gzPath.replace(/\.gz$/, "");
	execSync(`/usr/bin/gunzip -f -k "${gzPath}"`, { stdio: "inherit" });
	return outPath;
};

const writeDataset = (id: string, dataset: Dataset): void => {
	const filepath = path.join(DATA_DIR, `${id}.json`);
	fs.writeFileSync(filepath, JSON.stringify(dataset, null, "\t") + "\n");
	console.log(`  Written ${filepath} (${dataset.nodes.length} nodes, ${dataset.edges.length} edges)`);
};

/**
 * Parse edge list format: "source target [weight]" per line
 * @param content
 * @param _directed
 */
const parseEdgeList = (content: string, _directed: boolean): { nodes: Node[]; edges: Edge[] } => {
	const nodeSet = new Set<string>();
	const edges: Edge[] = [];

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("%")) continue;

		const parts = trimmed.split(/\s+/);
		if (parts.length >= 2) {
			const source = parts[0];
			const target = parts[1];
			const weight = parts.length > 2 ? Number.parseFloat(parts[2]) : undefined;

			nodeSet.add(source);
			nodeSet.add(target);

			const edge: Edge = { source, target };
			if (weight !== undefined && !Number.isNaN(weight)) {
				edge.weight = weight;
			}
			edges.push(edge);
		}
	}

	const nodes = [...nodeSet].map(id => ({ id }));
	return { nodes, edges };
};

/**
 * Parse UCINET DAT format
 * @param content
 */
const parseUcinetDat = (content: string): { nodes: Node[]; edges: Edge[]; matrices: string[] } => {
	const lines = content.split("\n");
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const matrices: string[] = [];

	let inData = false;
	let inLabels = false;
	let currentMatrix: number[][] = [];
	const labels: string[] = [];
	let n = 0;
	let matrixName = "";

	for (const line of lines) {
		const trimmed = line.trim();
		const upper = trimmed.toUpperCase();

		if (upper.startsWith("DL")) continue;
		if (upper.startsWith("N=")) {
			n = Number.parseInt(trimmed.split("=")[1], 10);
			continue;
		}
		if (upper.startsWith("NR=") || upper.startsWith("NC=")) continue;
		if (upper.startsWith("FORMAT")) continue;
		if (upper.startsWith("LEVEL LABELS")) continue;

		if (upper.startsWith("ROW LABELS:") || upper.startsWith("COLUMN LABELS:") || upper.startsWith("LABELS:")) {
			inLabels = true;
			inData = false;
			continue;
		}

		if (upper.startsWith("DATA:")) {
			inData = true;
			inLabels = false;
			// Check if there's a matrix name
			const match = trimmed.match(/DATA:\s*(\w+)/i);
			if (match) {
				matrixName = match[1];
				matrices.push(matrixName);
			}
			currentMatrix = [];
			continue;
		}

		if (inLabels && trimmed) {
			// Labels can be quoted or unquoted
			const labelMatch = trimmed.match(/"[^"]+"|\S+/g);
			if (labelMatch) {
				for (const l of labelMatch) {
					labels.push(l.replaceAll('"', ""));
				}
			}
		}

		if (inData && trimmed) {
			const values = trimmed.split(/\s+/).map(v => Number.parseFloat(v));
			if (values.length > 0 && !values.some(Number.isNaN)) {
				currentMatrix.push(values);
			}
		}
	}

	// Generate node labels if not provided
	if (labels.length === 0) {
		for (let i = 0; i < n; i++) {
			labels.push(String(i + 1));
		}
	}

	// Create nodes
	for (const label of labels.slice(0, n)) {
		nodes.push({ id: label });
	}

	// Create edges from matrix
	for (let i = 0; i < currentMatrix.length && i < n; i++) {
		for (let j = 0; j < currentMatrix[i].length && j < n; j++) {
			const value = currentMatrix[i][j];
			if (value !== 0) {
				const edge: Edge = {
					source: labels[i],
					target: labels[j],
				};
				if (value !== 1) {
					edge.weight = value;
				}
				edges.push(edge);
			}
		}
	}

	return { nodes, edges, matrices };
};

// ============ ARENAS DATASETS ============

const processArenasEmail = async (): Promise<void> => {
	console.log("\nProcessing: arenas-email");
	const zipPath = download(
		"https://web.archive.org/web/20131030150048id_/http://deim.urv.cat/~aarenas/data/xarxes/email.zip",
		"email.zip"
	);
	const dir = unzip(zipPath);

	// Find the edge list file
	const files = fs.readdirSync(dir);
	const edgeFile = files.find(f => f.endsWith(".txt") || f.endsWith(".edges") || !f.includes("."));
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf8");

	const { nodes, edges } = parseEdgeList(content, true);

	const dataset: Dataset = {
		meta: {
			name: "Email Network URV",
			description: "E-mail interchanges between members of the University Rovira i Virgili (Tarragona).",
			source: "http://deim.urv.cat/~aarenas/data/welcome.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	};

	writeDataset("arenas-email", dataset);
};

const processArenasJazz = async (): Promise<void> => {
	console.log("\nProcessing: arenas-jazz");
	const zipPath = download(
		"https://web.archive.org/web/20131030150048id_/http://deim.urv.cat/~aarenas/data/xarxes/jazz.zip",
		"jazz.zip"
	);
	const dir = unzip(zipPath);

	const files = fs.readdirSync(dir);
	const edgeFile = files.find(f => f.endsWith(".net") || f.endsWith(".txt") || f.endsWith(".edges"));
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf8");

	const { nodes, edges } = parseEdgeList(content, false);

	const dataset: Dataset = {
		meta: {
			name: "Jazz Musicians Network",
			description: "Collaboration network of jazz musicians. Nodes are musicians and edges represent playing together in a band.",
			source: "http://deim.urv.cat/~aarenas/data/welcome.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("arenas-jazz", dataset);
};

const processArenasPGP = async (): Promise<void> => {
	console.log("\nProcessing: arenas-pgp");
	const zipPath = download(
		"https://web.archive.org/web/20131030150048id_/http://deim.urv.cat/~aarenas/data/xarxes/PGP.zip",
		"PGP.zip"
	);
	const dir = unzip(zipPath);

	const files = fs.readdirSync(dir);
	const edgeFile = files.find(f => f.endsWith(".net") || f.endsWith(".txt") || f.endsWith(".edges"));
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf8");

	const { nodes, edges } = parseEdgeList(content, false);

	const dataset: Dataset = {
		meta: {
			name: "PGP Network",
			description: "Giant component of the network of users of the Pretty-Good-Privacy algorithm for secure information interchange.",
			source: "http://deim.urv.cat/~aarenas/data/welcome.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("arenas-pgp", dataset);
};

const processArenasCelegans = async (): Promise<void> => {
	console.log("\nProcessing: arenas-celegans-metabolic");
	const zipPath = download(
		"https://web.archive.org/web/20131030150048id_/http://deim.urv.cat/~aarenas/data/xarxes/celegans_metabolic.zip",
		"celegans_metabolic.zip"
	);
	const dir = unzip(zipPath);

	const files = fs.readdirSync(dir);
	const edgeFile = files.find(f => f.endsWith(".net") || f.endsWith(".txt") || f.endsWith(".edges"));
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf8");

	const { nodes, edges } = parseEdgeList(content, true);

	const dataset: Dataset = {
		meta: {
			name: "C. elegans Metabolic Network",
			description: "Metabolic network of the nematode C. elegans.",
			source: "http://deim.urv.cat/~aarenas/data/welcome.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	};

	writeDataset("arenas-celegans-metabolic", dataset);
};

// ============ BARABASI DATASETS ============

const processBarabasiWWW = async (): Promise<void> => {
	console.log("\nProcessing: barabasi-www");
	const gzPath = download(
		"https://web.archive.org/web/20090307224103id_/http://nd.edu/~networks/resources/www/www.dat.gz",
		"www.dat.gz"
	);
	const datPath = gunzip(gzPath);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseEdgeList(content, true);

	const dataset: Dataset = {
		meta: {
			name: "World-Wide-Web",
			description: "Hyperlink network of web pages from a 1999 crawl of the nd.edu domain.",
			source: "http://www.nd.edu/~networks/resources.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	};

	writeDataset("barabasi-www", dataset);
};

const processBarabasiActor = async (): Promise<void> => {
	console.log("\nProcessing: barabasi-actor");
	const gzPath = download(
		"https://web.archive.org/web/20090307224103id_/http://nd.edu/~networks/resources/actor/actor.dat.gz",
		"actor.dat.gz"
	);
	const datPath = gunzip(gzPath);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseEdgeList(content, false);

	const dataset: Dataset = {
		meta: {
			name: "Actor Collaboration Network",
			description: "Collaboration network of film actors from IMDB. Nodes are actors, edges connect actors who appeared in the same movie.",
			source: "http://www.nd.edu/~networks/resources.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("barabasi-actor", dataset);
};

const processBarabasiProtein = async (): Promise<void> => {
	console.log("\nProcessing: barabasi-protein-yeast");
	const gzPath = download(
		"https://web.archive.org/web/20090307224103id_/http://nd.edu/~networks/resources/protein/bo.dat.gz",
		"protein.dat.gz"
	);
	const datPath = gunzip(gzPath);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseEdgeList(content, false);

	const dataset: Dataset = {
		meta: {
			name: "Yeast Protein Interaction Network",
			description: "Protein-protein interaction network for Saccharomyces cerevisiae (yeast).",
			source: "http://www.nd.edu/~networks/resources.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("barabasi-protein-yeast", dataset);
};

// ============ UCINET DATASETS ============

const processUcinetZachary = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-zachary");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/zachary.dat",
		"zachary.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Zachary Karate Club",
			description: "Social network of a university karate club. Famous for the split following disputes between members.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-zachary", dataset);
};

const processUcinetPadgett = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-padgett");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/padgett.dat",
		"padgett.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Padgett Florentine Families",
			description: "Business and marriage ties among Renaissance Florentine families. The Medici vs Strozzi conflict.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-padgett", dataset);
};

const processUcinetGama = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-gama");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/gama.dat",
		"gama.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Gahuku-Gama Highland Tribes",
			description: "Alliance and antagonism relations among 16 tribes in the Eastern Central Highlands of New Guinea.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-gama", dataset);
};

const processUcinetTaro = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-taro");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/taro.dat",
		"taro.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Schwimmer Taro Exchange",
			description: "Gift-giving (taro exchange) among 22 households in a Papuan village.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/taro.dat",
			citation: {
				authors: ["E. Schwimmer"],
				title: "Exchange in the social structure of the Orokaiva",
				publisher: "St Martins",
				year: 1973,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-taro", dataset);
};

const processUcinetPrison = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-prison");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/prison.dat",
		"prison.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Gagnon Prison",
			description: "Friendship choices among 67 prison inmates in a 1950s study.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
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
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-prison", dataset);
};

const processUcinetWiring = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-wiring");
	const datPath = download(
		"https://web.archive.org/web/20240908121535id_/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/wiring.dat",
		"wiring.dat"
	);
	const content = fs.readFileSync(datPath, "utf8");

	const { nodes, edges } = parseUcinetDat(content);

	const dataset: Dataset = {
		meta: {
			name: "Hawthorne Bank Wiring Room",
			description: "Observational data on 14 Western Electric employees from the famous Hawthorne studies.",
			source: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm",
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/wiring.dat",
			citation: {
				authors: ["F. Roethlisberger", "W. Dickson"],
				title: "Management and the worker",
				publisher: "Cambridge University Press",
				year: 1939,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	};

	writeDataset("ucinet-wiring", dataset);
};

// ============ NEW UCINET DATASETS ============

const WB_UCINET = "20240908121535id_";
const UCINET_BASE = `https://web.archive.org/web/${WB_UCINET}/http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet`;
const UCINET_SOURCE = "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/UciData.htm";

const processUcinetBkfrat = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-bkfrat");
	const datPath = download(`${UCINET_BASE}/bkfrat.dat`, "bkfrat.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-bkfrat", {
		meta: {
			name: "Bernard & Killworth Fraternity",
			description: "Interaction data from 58 students in a West Virginia fraternity. Includes observed conversation frequency and recalled interaction rankings.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/bkfrat.dat",
			citation: {
				authors: ["H. Bernard", "P. Killworth", "L. Sailer"],
				title: "Informant accuracy in social network data IV",
				journal: "Social Networks",
				volume: 2,
				pages: "191-218",
				year: 1980,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetBkham = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-bkham");
	const datPath = download(`${UCINET_BASE}/bkham.dat`, "bkham.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-bkham", {
		meta: {
			name: "Bernard & Killworth Ham Radio",
			description: "HAM radio calls among 44 operators over one month, with recalled frequency rankings.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/bkham.dat",
			citation: {
				authors: ["B. Killworth", "H. Bernard"],
				title: "Informant accuracy in social network data",
				journal: "Human Organization",
				volume: 35,
				pages: "269-286",
				year: 1976,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetBkoff = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-bkoff");
	const datPath = download(`${UCINET_BASE}/bkoff.dat`, "bkoff.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-bkoff", {
		meta: {
			name: "Bernard & Killworth Office",
			description: "Interactions in a small business office among 40 employees, observed over two four-day periods.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/bkoff.dat",
			citation: {
				authors: ["H. Bernard", "P. Killworth", "L. Sailer"],
				title: "Informant accuracy in social network data IV",
				journal: "Social Networks",
				volume: 2,
				pages: "191-218",
				year: 1980,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetBktec = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-bktec");
	const datPath = download(`${UCINET_BASE}/bktec.dat`, "bktec.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-bktec", {
		meta: {
			name: "Bernard & Killworth Technical",
			description: "Interactions in a technical research group of 34 members at a West Virginia university.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/bktec.dat",
			citation: {
				authors: ["H. Bernard", "P. Killworth", "L. Sailer"],
				title: "Informant accuracy in social network data IV",
				journal: "Social Networks",
				volume: 2,
				pages: "191-218",
				year: 1980,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetDavis = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-davis");
	const datPath = download(`${UCINET_BASE}/davis.dat`, "davis.dat");
	const content = fs.readFileSync(datPath, "utf8");

	// Custom parser for rectangular bipartite matrix (NR=18 NC=14)
	const lines = content.split("\n");
	const rowLabels: string[] = [];
	const colLabels: string[] = [];
	const matrix: number[][] = [];
	let section: "none" | "rowLabels" | "colLabels" | "data" = "none";

	for (const line of lines) {
		const trimmed = line.trim();
		const upper = trimmed.toUpperCase();
		if (upper.startsWith("DL") || upper.startsWith("NR=") || upper.startsWith("FORMAT")) continue;
		if (upper === "ROW LABELS:") { section = "rowLabels"; continue; }
		if (upper === "COLUMN LABELS:") { section = "colLabels"; continue; }
		if (upper === "DATA:") { section = "data"; continue; }

		if (section === "rowLabels" && trimmed) rowLabels.push(trimmed);
		if (section === "colLabels" && trimmed) colLabels.push(trimmed);
		if (section === "data" && trimmed) {
			matrix.push(trimmed.split(/\s+/).map(v => Number.parseInt(v, 10)));
		}
	}

	const nodes: Node[] = [
		...rowLabels.map(id => ({ id })),
		...colLabels.map(id => ({ id })),
	];
	const edges: Edge[] = [];
	for (const [i, element] of matrix.entries()) {
		for (const [j, element_] of element.entries()) {
			if (element_ !== 0) {
				edges.push({ source: rowLabels[i], target: colLabels[j] });
			}
		}
	}

	writeDataset("ucinet-davis", {
		meta: {
			name: "Davis Southern Club Women",
			description: "Attendance at 14 social events by 18 Southern women in the 1930s. A classic bipartite (two-mode) network.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/davis.dat",
			citation: {
				authors: ["A. Davis", "B. Gardner", "M. Gardner"],
				title: "Deep South",
				publisher: "University of Chicago Press",
				year: 1941,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetKapmine = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-kapmine");
	const datPath = download(`${UCINET_BASE}/kapmine.dat`, "kapmine.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-kapmine", {
		meta: {
			name: "Kapferer Mine",
			description: "Multiplex and uniplex ties among 15 workers in a Zambian mining operation.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/kapmine.dat",
			citation: {
				authors: ["B. Kapferer"],
				title: "Norms and the manipulation of relationships in a work context",
				publisher: "Manchester University Press",
				year: 1969,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetKaptail = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-kaptail");
	const datPath = download(`${UCINET_BASE}/kaptail.dat`, "kaptail.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-kaptail", {
		meta: {
			name: "Kapferer Tailor Shop",
			description: "Instrumental and sociational interactions among 39 workers in a Zambian tailor shop, observed at two time points.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/kaptail.dat",
			citation: {
				authors: ["B. Kapferer"],
				title: "Strategy and transaction in an African factory",
				publisher: "Manchester University Press",
				year: 1972,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetKnokbur = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-knokbur");
	const datPath = download(`${UCINET_BASE}/knokbur.dat`, "knokbur.dat");
	const content = fs.readFileSync(datPath, "utf8");

	// Custom parser — non-standard format with multiple relation matrices.
	// Uses the "information" relation (first matrix) as the primary network.
	const lines = content.split("\n");
	let labels: string[] = [];
	const matrix: number[][] = [];
	let inFirstMatrix = false;
	let pastFirstLabel = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// First line is a comment
		if (trimmed.startsWith("has to be")) continue;

		// "information" signals the first relation
		if (trimmed === "information") { inFirstMatrix = true; continue; }
		// "money" signals the second relation — stop
		if (trimmed === "money") break;

		if (!inFirstMatrix) continue;

		// Header line like "4, 10, 10, N, NB" — skip
		if (/^\d+\s*,/.test(trimmed)) continue;

		// Labels line (comma-separated)
		if (!pastFirstLabel && trimmed.includes(",")) {
			labels = trimmed.split(",").map(s => s.trim());
			pastFirstLabel = true;
			continue;
		}

		// Matrix rows (space-separated integers)
		const values = trimmed.split(/\s+/).map(v => Number.parseInt(v, 10));
		if (values.length > 0 && !values.some(Number.isNaN)) {
			matrix.push(values);
		}
	}

	const nodes: Node[] = labels.map(id => ({ id }));
	const edges: Edge[] = [];
	for (let i = 0; i < matrix.length && i < labels.length; i++) {
		for (let j = 0; j < matrix[i].length && j < labels.length; j++) {
			if (matrix[i][j] !== 0) {
				const edge: Edge = { source: labels[i], target: labels[j] };
				if (matrix[i][j] !== 1) edge.weight = matrix[i][j];
				edges.push(edge);
			}
		}
	}

	writeDataset("ucinet-knokbur", {
		meta: {
			name: "Knoke Bureaucracies",
			description: "Information exchange among 10 organizations in Indianapolis.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/knokbur.dat",
			citation: {
				authors: ["D. Knoke", "J. Kuklinski"],
				title: "Network analysis",
				publisher: "Sage",
				year: 1982,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetKrackad = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-krackad");
	const datPath = download(`${UCINET_BASE}/krackad.dat`, "krackad.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-krackad", {
		meta: {
			name: "Krackhardt Office Advice",
			description: "Cognitive social structure data: 21 managers' perceptions of advice-seeking relationships.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/krackad.dat",
			citation: {
				authors: ["D. Krackhardt"],
				title: "Cognitive social structures",
				journal: "Social Networks",
				volume: 9,
				pages: "104-134",
				year: 1987,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetKrackfr = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-krackfr");
	const datPath = download(`${UCINET_BASE}/krackfr.dat`, "krackfr.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-krackfr", {
		meta: {
			name: "Krackhardt Office Friendship",
			description: "Cognitive social structure data: 21 managers' perceptions of friendship relationships.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/krackfr.dat",
			citation: {
				authors: ["D. Krackhardt"],
				title: "Cognitive social structures",
				journal: "Social Networks",
				volume: 9,
				pages: "104-134",
				year: 1987,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetNewfrat = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-newfrat");
	const datPath = download(`${UCINET_BASE}/newfrat.dat`, "newfrat.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-newfrat", {
		meta: {
			name: "Newcomb Fraternity",
			description: "Weekly sociometric preference rankings from 17 men over 15 weeks in a University of Michigan fraternity.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/newfrat.dat",
			citation: {
				authors: ["T. Newcomb"],
				title: "The acquaintance process",
				publisher: "Holt, Reinhard & Winston",
				year: 1961,
				type: "book",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetSampson = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-sampson");
	const datPath = download(`${UCINET_BASE}/sampson.dat`, "sampson.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-sampson", {
		meta: {
			name: "Sampson Monastery",
			description: "Social interactions among 18 monks including liking, esteem, influence, and praise, at three time points.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/sampson.dat",
			citation: {
				authors: ["S. Sampson"],
				title: "Crisis in a cloister",
				year: 1969,
				type: "thesis",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetSzcid = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-szcid");
	const datPath = download(`${UCINET_BASE}/szcid.dat`, "szcid.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-szcid", {
		meta: {
			name: "Stokman-Ziegler Netherlands Interlocks",
			description: "Corporate interlocks among 16 major Dutch business entities.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/szcid.dat",
			citation: {
				authors: ["F. Stokman", "F. Wasseur", "D. Elsas"],
				title: "The Dutch network: Types of interlocks and network structure",
				publisher: "Polity Press",
				year: 1985,
				type: "incollection",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetSzcig = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-szcig");
	const datPath = download(`${UCINET_BASE}/szcig.dat`, "szcig.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-szcig", {
		meta: {
			name: "Stokman-Ziegler German Interlocks",
			description: "Corporate interlocks among 15 major West German business entities.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/szcig.dat",
			citation: {
				authors: ["R. Ziegler", "R. Bender", "H. Biehler"],
				title: "Industry and banking in the German corporate network",
				publisher: "Polity Press",
				year: 1985,
				type: "incollection",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: false,
		},
		nodes,
		edges,
	});
};

const processUcinetThuroff = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-thuroff");
	const datPath = download(`${UCINET_BASE}/thuroff.dat`, "thuroff.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-thuroff", {
		meta: {
			name: "Thurman Office",
			description: "Formal and informal ties among 15 employees in an overseas branch office of a large multinational corporation.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/thuroff.dat",
			citation: {
				authors: ["B. Thurman"],
				title: "In the office: Networks and coalitions",
				journal: "Social Networks",
				volume: 2,
				pages: "47-63",
				year: 1979,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

const processUcinetWolf = async (): Promise<void> => {
	console.log("\nProcessing: ucinet-wolf");
	const datPath = download(`${UCINET_BASE}/wolf.dat`, "wolf.dat");
	const content = fs.readFileSync(datPath, "utf8");
	const { nodes, edges } = parseUcinetDat(content);

	writeDataset("ucinet-wolf", {
		meta: {
			name: "Wolfe Primates",
			description: "Interactions and kin relationships among 20 monkeys observed in Ocala, Florida.",
			source: UCINET_SOURCE,
			url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/wolf.dat",
			citation: {
				authors: ["L. Wolfe"],
				title: "Japanese macaques at the Arashiyama West and Silver Springs troops",
				year: 1984,
				type: "article",
			},
			retrieved: new Date().toISOString().split("T")[0],
			directed: true,
		},
		nodes,
		edges,
	});
};

// ============ MAIN ============

const main = async (): Promise<void> => {
	console.log("Downloading and parsing external datasets...\n");

	// Arenas datasets
	await processArenasEmail();
	await processArenasJazz();
	await processArenasPGP();
	await processArenasCelegans();

	// Barabasi datasets
	await processBarabasiWWW();
	await processBarabasiActor();
	await processBarabasiProtein();

	// UCINet datasets (existing)
	await processUcinetZachary();
	await processUcinetPadgett();
	await processUcinetGama();
	await processUcinetTaro();
	await processUcinetPrison();
	await processUcinetWiring();

	// UCINet datasets (new)
	await processUcinetBkfrat();
	await processUcinetBkham();
	await processUcinetBkoff();
	await processUcinetBktec();
	await processUcinetDavis();
	await processUcinetKapmine();
	await processUcinetKaptail();
	await processUcinetKnokbur();
	await processUcinetKrackad();
	await processUcinetKrackfr();
	await processUcinetNewfrat();
	await processUcinetSampson();
	await processUcinetSzcid();
	await processUcinetSzcig();
	await processUcinetThuroff();
	await processUcinetWolf();

	console.log("\nDone! Run 'npx tsx scripts/generate-datasets-catalog.ts' to update the catalog.");
};

main().catch(console.error);
