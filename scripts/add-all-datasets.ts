/**
 * Add all datasets from all sources to the catalog
 * This includes datasets we haven't downloaded yet (stub: true)
 */

import { readFileSync, writeFileSync } from "fs";

interface Dataset {
  id: string;
  name: string;
  description: string;
  source: string;
  url: string;
  archiveUrl?: string;
  citation?: {
    authors: string[];
    title: string;
    journal?: string;
    publisher?: string;
    volume?: number;
    pages?: string;
    year: number;
    type: "article" | "book" | "thesis" | "unpublished";
  };
  nodeCount?: number;
  edgeCount?: number;
  directed?: boolean;
  weighted?: boolean;
  bipartite?: boolean;
  stub?: boolean; // true if we haven't downloaded the data
}

interface Source {
  name: string;
  url: string;
  description: string;
  format: string;
  archiveUrl?: string;
}

// Load existing catalog
const catalogPath = "src/data/catalog.json";
const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

// Add missing sources
const newSources: Record<string, Source> = {
  watts: {
    name: "Duncan Watts Datasets",
    url: "http://cdg.columbia.edu/cdg/datasets",
    description:
      "Network datasets from Duncan Watts' Collective Dynamics Group at Columbia University.",
    format: "various",
    archiveUrl:
      "https://web.archive.org/web/20090515011350/http://cdg.columbia.edu/cdg/datasets",
  },
  indiana: {
    name: "Indiana University Cyberinfrastructure",
    url: "http://iv.slis.indiana.edu/db/index.html",
    description:
      "Large-scale bibliographic and citation databases from Indiana University.",
    format: "various",
    archiveUrl:
      "https://web.archive.org/web/20200701163417/http://iv.slis.indiana.edu/db/index.html",
  },
};

// Add new sources to catalog
for (const [id, source] of Object.entries(newSources)) {
  if (!catalog.sources[id]) {
    catalog.sources[id] = source;
    console.log(`Added source: ${id}`);
  }
}

// UCINet datasets to add (those we don't have yet)
const ucinetDatasets: Dataset[] = [
  {
    id: "ucinet-bkfrat",
    name: "Bernard & Killworth Fraternity",
    description:
      "Interaction data from 58 students in a West Virginia fraternity. Includes observed conversation frequency and recalled interaction rankings.",
    source: "ucinet",
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
    nodeCount: 58,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-bkham",
    name: "Bernard & Killworth Ham Radio",
    description:
      "HAM radio calls among 44 operators over one month, with recalled frequency rankings.",
    source: "ucinet",
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
    nodeCount: 44,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-bkoff",
    name: "Bernard & Killworth Office",
    description:
      "Interactions in a small business office among 40 employees, observed over two four-day periods.",
    source: "ucinet",
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
    nodeCount: 40,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-bktec",
    name: "Bernard & Killworth Technical",
    description:
      "Interactions in a technical research group of 34 members at a West Virginia university.",
    source: "ucinet",
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
    nodeCount: 34,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-davis",
    name: "Davis Southern Club Women",
    description:
      "Attendance at 14 social events by 18 Southern women in the 1930s. A classic bipartite (two-mode) network.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/davis.dat",
    citation: {
      authors: ["A. Davis", "B. Gardner", "M. Gardner"],
      title: "Deep South",
      publisher: "University of Chicago Press",
      year: 1941,
      type: "book",
    },
    nodeCount: 32, // 18 women + 14 events
    directed: false,
    bipartite: true,
    stub: true,
  },
  {
    id: "ucinet-kapmine",
    name: "Kapferer Mine",
    description:
      "Multiplex and uniplex ties among 15 workers in a Zambian mining operation.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/kapmine.dat",
    citation: {
      authors: ["B. Kapferer"],
      title: "Norms and the manipulation of relationships in a work context",
      publisher: "Manchester University Press",
      year: 1969,
      type: "book",
    },
    nodeCount: 15,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-kaptail",
    name: "Kapferer Tailor Shop",
    description:
      "Instrumental and sociational interactions among 39 workers in a Zambian tailor shop, observed at two time points.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/kaptail.dat",
    citation: {
      authors: ["B. Kapferer"],
      title: "Strategy and transaction in an African factory",
      publisher: "Manchester University Press",
      year: 1972,
      type: "book",
    },
    nodeCount: 39,
    directed: true,
    stub: true,
  },
  {
    id: "ucinet-knokbur",
    name: "Knoke Bureaucracies",
    description:
      "Money and information exchange among 10 organizations in Indianapolis.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/knokbur.dat",
    citation: {
      authors: ["D. Knoke", "J. Kuklinski"],
      title: "Network analysis",
      publisher: "Sage",
      year: 1982,
      type: "book",
    },
    nodeCount: 10,
    directed: true,
    stub: true,
  },
  {
    id: "ucinet-krackad",
    name: "Krackhardt Office Advice",
    description:
      "Cognitive social structure data: 21 managers' perceptions of advice-seeking relationships.",
    source: "ucinet",
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
    nodeCount: 21,
    directed: true,
    stub: true,
  },
  {
    id: "ucinet-krackfr",
    name: "Krackhardt Office Friendship",
    description:
      "Cognitive social structure data: 21 managers' perceptions of friendship relationships.",
    source: "ucinet",
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
    nodeCount: 21,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-newfrat",
    name: "Newcomb Fraternity",
    description:
      "Weekly sociometric preference rankings from 17 men over 15 weeks at University of Michigan (1956).",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/newfrat.dat",
    citation: {
      authors: ["T. Newcomb"],
      title: "The acquaintance process",
      publisher: "Holt, Reinhard & Winston",
      year: 1961,
      type: "book",
    },
    nodeCount: 17,
    directed: true,
    weighted: true,
    stub: true,
  },
  {
    id: "ucinet-sampson",
    name: "Sampson Monastery",
    description:
      "Social interactions among 18 monks including liking, esteem, influence, and praise relations over time.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/sampson.dat",
    citation: {
      authors: ["S. Sampson"],
      title: "Crisis in a cloister",
      year: 1969,
      type: "thesis",
    },
    nodeCount: 18,
    directed: true,
    weighted: true,
    stub: true,
  },
  {
    id: "ucinet-szcid",
    name: "Stokman-Ziegler Netherlands Interlocks",
    description: "Corporate interlocks among 16 major Dutch business entities.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/szcid.dat",
    citation: {
      authors: ["F. Stokman", "F. Wasseur", "D. Elsas"],
      title: "The Dutch network: Types of interlocks and network structure",
      publisher: "Polity Press",
      year: 1985,
      type: "book",
    },
    nodeCount: 16,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-szcig",
    name: "Stokman-Ziegler German Interlocks",
    description:
      "Corporate interlocks among 15 major West German business entities.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/szcig.dat",
    citation: {
      authors: ["R. Ziegler", "R. Bender", "H. Biehler"],
      title: "Industry and banking in the German corporate network",
      publisher: "Polity Press",
      year: 1985,
      type: "book",
    },
    nodeCount: 15,
    directed: false,
    stub: true,
  },
  {
    id: "ucinet-thuroff",
    name: "Thurman Office",
    description:
      "Formal and informal ties among 15 employees in an overseas corporate office.",
    source: "ucinet",
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
    nodeCount: 15,
    directed: true,
    stub: true,
  },
  {
    id: "ucinet-wolf",
    name: "Wolfe Primates",
    description:
      "Interactions and kin relationships among 20 monkeys observed in Ocala, Florida.",
    source: "ucinet",
    url: "http://vlado.fmf.uni-lj.si/pub/networks/data/UciNet/wolf.dat",
    nodeCount: 20,
    directed: true,
    weighted: true,
    stub: true,
  },
];

// Indiana University datasets (large bibliographic databases)
const indianaDatasets: Dataset[] = [
  {
    id: "indiana-medline",
    name: "Medline Citations",
    description:
      "11.7 million biomedical literature entries from 1963-2002. Large-scale citation network.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/medline.html",
    nodeCount: 11693477,
    directed: true,
    stub: true,
  },
  {
    id: "indiana-physrev",
    name: "Physical Review",
    description:
      "247,149 physics papers from 1895-2004 with citation links. 8.6 GB dataset.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/index.html",
    nodeCount: 247149,
    directed: true,
    stub: true,
  },
  {
    id: "indiana-pnas",
    name: "PNAS Citations",
    description:
      "16,169 papers from Proceedings of the National Academy of Sciences (1997-2002).",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/pnas.html",
    nodeCount: 16169,
    directed: true,
    stub: true,
  },
  {
    id: "indiana-patents",
    name: "US Patent Citations",
    description:
      "2.58 million US patents from 1976-2003 with citation network. NBER dataset.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/patents.html",
    nodeCount: 2582647,
    directed: true,
    stub: true,
  },
  {
    id: "indiana-wikipedia",
    name: "Wikipedia Links",
    description:
      "491,575 English Wikipedia articles with 10.2 million hyperlinks between them.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/index.html",
    nodeCount: 491575,
    edgeCount: 10214556,
    directed: true,
    stub: true,
  },
  {
    id: "indiana-nsf",
    name: "NSF Grants",
    description: "181,132 National Science Foundation grant awards from 1985-2002.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/nsf.html",
    nodeCount: 181132,
    directed: false,
    stub: true,
  },
  {
    id: "indiana-nih",
    name: "NIH Grants",
    description:
      "1,003,521 National Institutes of Health grants from 1972-1992 and 1994-2002.",
    source: "indiana",
    url: "http://iv.slis.indiana.edu/db/nih.html",
    nodeCount: 1003521,
    directed: false,
    stub: true,
  },
];

// Duncan Watts datasets (note: these overlap with Newman but from original source)
const wattsDatasets: Dataset[] = [
  {
    id: "watts-celegans",
    name: "C. Elegans Neural Network (Watts)",
    description:
      "Neural network of C. Elegans worm. Original data from Watts & Strogatz Nature 1998 paper.",
    source: "watts",
    url: "http://cdg.columbia.edu/uploads/datasets/celegans_raw_data",
    archiveUrl:
      "https://web.archive.org/web/20090515011350/http://cdg.columbia.edu/uploads/datasets/celegans_raw_data",
    citation: {
      authors: ["D. J. Watts", "S. H. Strogatz"],
      title: "Collective dynamics of 'small-world' networks",
      journal: "Nature",
      volume: 393,
      pages: "440-442",
      year: 1998,
      type: "article",
    },
    nodeCount: 297,
    directed: true,
    weighted: true,
    stub: true,
  },
  {
    id: "watts-power",
    name: "US Power Grid (Watts)",
    description:
      "Western States Power Grid topology. Original data from Watts & Strogatz Nature 1998 paper.",
    source: "watts",
    url: "http://cdg.columbia.edu/uploads/datasets/power_unweighted",
    archiveUrl:
      "https://web.archive.org/web/20090515011350/http://cdg.columbia.edu/uploads/datasets/power_unweighted",
    citation: {
      authors: ["D. J. Watts", "S. H. Strogatz"],
      title: "Collective dynamics of 'small-world' networks",
      journal: "Nature",
      volume: 393,
      pages: "440-442",
      year: 1998,
      type: "article",
    },
    nodeCount: 4941,
    directed: false,
    weighted: false,
    stub: true,
  },
];

// Barabási missing dataset
const barabasiDatasets: Dataset[] = [
  {
    id: "barabasi-cellular",
    name: "Cellular Network",
    description:
      "Metabolic network representing cellular processes. From Barabási lab research on scale-free networks.",
    source: "barabasi",
    url: "http://www.nd.edu/~networks/resources.htm",
    archiveUrl:
      "https://web.archive.org/web/20090201045916/http://www.nd.edu/~networks/resources/Genetic/PIN/protein.interactions.gz",
    nodeCount: 1458,
    directed: false,
    stub: true,
  },
];

// Add all new datasets
const allNewDatasets = [
  ...ucinetDatasets,
  ...indianaDatasets,
  ...wattsDatasets,
  ...barabasiDatasets,
];

let added = 0;
for (const dataset of allNewDatasets) {
  if (!catalog.datasets[dataset.id]) {
    catalog.datasets[dataset.id] = {
      ...dataset,
      retrieved: new Date().toISOString().split("T")[0],
    };
    added++;
    console.log(`Added dataset: ${dataset.id}`);
  }
}

// Update dataset count
catalog.datasetCount = Object.keys(catalog.datasets).length;
catalog.generated = new Date().toISOString();

// Write updated catalog
writeFileSync(catalogPath, JSON.stringify(catalog, null, "\t"));

console.log(`\nDone!`);
console.log(`  New datasets added: ${added}`);
console.log(`  Total datasets: ${catalog.datasetCount}`);
console.log(`  Total sources: ${Object.keys(catalog.sources).length}`);
