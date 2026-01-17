#!/usr/bin/env npx tsx
/**
 * Download and parse external datasets from Wayback Machine archives.
 *
 * Converts various formats (edge lists, adjacency matrices, UCINET DAT)
 * to the standard JSON format used by graph-box.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

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
 */
const parseEdgeList = (content: string, directed: boolean): { nodes: Node[]; edges: Edge[] } => {
	const nodeSet = new Set<string>();
	const edges: Edge[] = [];

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("%")) continue;

		const parts = trimmed.split(/\s+/);
		if (parts.length >= 2) {
			const source = parts[0];
			const target = parts[1];
			const weight = parts.length > 2 ? parseFloat(parts[2]) : undefined;

			nodeSet.add(source);
			nodeSet.add(target);

			const edge: Edge = { source, target };
			if (weight !== undefined && !isNaN(weight)) {
				edge.weight = weight;
			}
			edges.push(edge);
		}
	}

	const nodes = Array.from(nodeSet).map(id => ({ id }));
	return { nodes, edges };
};

/**
 * Parse UCINET DAT format
 */
const parseUcinetDat = (content: string): { nodes: Node[]; edges: Edge[]; matrices: string[] } => {
	const lines = content.split("\n");
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const matrices: string[] = [];

	let inData = false;
	let inLabels = false;
	let currentMatrix: number[][] = [];
	let labels: string[] = [];
	let n = 0;
	let matrixName = "";

	for (const line of lines) {
		const trimmed = line.trim();
		const upper = trimmed.toUpperCase();

		if (upper.startsWith("DL")) continue;
		if (upper.startsWith("N=")) {
			n = parseInt(trimmed.split("=")[1], 10);
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
			const labelMatch = trimmed.match(/"([^"]+)"|(\S+)/g);
			if (labelMatch) {
				for (const l of labelMatch) {
					labels.push(l.replace(/"/g, ""));
				}
			}
		}

		if (inData && trimmed) {
			const values = trimmed.split(/\s+/).map(v => parseFloat(v));
			if (values.length > 0 && !values.some(isNaN)) {
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
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf-8");

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
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf-8");

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
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf-8");

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
	const content = fs.readFileSync(path.join(dir, edgeFile || files[0]), "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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
	const content = fs.readFileSync(datPath, "utf-8");

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

	// UCINet datasets
	await processUcinetZachary();
	await processUcinetPadgett();
	await processUcinetGama();
	await processUcinetTaro();
	await processUcinetPrison();
	await processUcinetWiring();

	console.log("\nDone! Run 'npx tsx scripts/generate-datasets-catalog.ts' to update the catalog.");
};

main().catch(console.error);
