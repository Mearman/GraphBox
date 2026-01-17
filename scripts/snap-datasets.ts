/**
 * SNAP dataset configurations.
 *
 * Contains metadata and download URLs for all SNAP datasets.
 */

export interface SnapDatasetConfig {
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

// Default SNAP citation
const SNAP_CITATION = {
	authors: ["Jure Leskovec", "Andrej Krevl"],
	title: "SNAP Datasets: Stanford Large Network Dataset Collection",
	year: 2014,
};

export const SNAP_DATASETS: SnapDatasetConfig[] = [
	// =========================================================================
	// Social Networks
	// =========================================================================
	{
		id: "ego-facebook",
		name: "Facebook Social Circles",
		description: "Social circles from Facebook (anonymized). Nodes are users and edges are friendships.",
		url: "https://snap.stanford.edu/data/facebook_combined.txt.gz",
		directed: false,
		citation: {
			authors: ["J. McAuley", "J. Leskovec"],
			title: "Learning to Discover Social Circles in Ego Networks",
			venue: "NIPS",
			year: 2012,
		},
		category: "social",
	},
	{
		id: "ego-twitter",
		name: "Twitter Social Circles",
		description: "Social circles from Twitter. Nodes are users and edges represent following relationships.",
		url: "https://snap.stanford.edu/data/twitter_combined.txt.gz",
		directed: true,
		citation: {
			authors: ["J. McAuley", "J. Leskovec"],
			title: "Learning to Discover Social Circles in Ego Networks",
			venue: "NIPS",
			year: 2012,
		},
		category: "social",
	},
	{
		id: "ego-gplus",
		name: "Google+ Social Circles",
		description: "Social circles from Google+. Nodes are users and edges represent following relationships.",
		url: "https://snap.stanford.edu/data/gplus_combined.txt.gz",
		directed: true,
		citation: {
			authors: ["J. McAuley", "J. Leskovec"],
			title: "Learning to Discover Social Circles in Ego Networks",
			venue: "NIPS",
			year: 2012,
		},
		category: "social",
	},
	{
		id: "soc-epinions",
		name: "Epinions Trust Network",
		description: "Who-trusts-whom network of Epinions.com.",
		url: "https://snap.stanford.edu/data/soc-Epinions1.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Richardson", "R. Agrawal", "P. Domingos"],
			title: "Trust Management for the Semantic Web",
			venue: "ISWC",
			year: 2003,
		},
		category: "social",
	},
	{
		id: "soc-slashdot0811",
		name: "Slashdot Network Nov 2008",
		description: "Slashdot social network from November 2008.",
		url: "https://snap.stanford.edu/data/soc-Slashdot0811.txt.gz",
		directed: true,
		citation: SNAP_CITATION,
		category: "social",
	},
	{
		id: "soc-slashdot0902",
		name: "Slashdot Network Feb 2009",
		description: "Slashdot social network from February 2009.",
		url: "https://snap.stanford.edu/data/soc-Slashdot0902.txt.gz",
		directed: true,
		citation: SNAP_CITATION,
		category: "social",
	},
	{
		id: "wiki-vote",
		name: "Wikipedia Vote Network",
		description: "Wikipedia who-votes-on-whom network for adminship elections.",
		url: "https://snap.stanford.edu/data/wiki-Vote.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "D. Huttenlocher", "J. Kleinberg"],
			title: "Predicting Positive and Negative Links in Online Social Networks",
			venue: "WWW",
			year: 2010,
		},
		category: "social",
	},

	// =========================================================================
	// Communication Networks
	// =========================================================================
	{
		id: "email-enron",
		name: "Enron Email Network",
		description: "Email communication network from Enron.",
		url: "https://snap.stanford.edu/data/email-Enron.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "communication",
	},
	{
		id: "email-euall",
		name: "EU Email Network",
		description: "Email network from a European research institution.",
		url: "https://snap.stanford.edu/data/email-EuAll.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "communication",
	},
	{
		id: "wiki-talk",
		name: "Wikipedia Talk Network",
		description: "Wikipedia talk (communication) network.",
		url: "https://snap.stanford.edu/data/wiki-Talk.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "D. Huttenlocher", "J. Kleinberg"],
			title: "Predicting Positive and Negative Links in Online Social Networks",
			venue: "WWW",
			year: 2010,
		},
		category: "communication",
	},

	// =========================================================================
	// Citation Networks
	// =========================================================================
	{
		id: "cit-hepph",
		name: "HEP-PH Citation Network",
		description: "Arxiv High Energy Physics paper citation network.",
		url: "https://snap.stanford.edu/data/cit-HepPh.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "citation",
	},
	{
		id: "cit-hepth",
		name: "HEP-TH Citation Network",
		description: "Arxiv High Energy Physics Theory paper citation network.",
		url: "https://snap.stanford.edu/data/cit-HepTh.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "citation",
	},
	{
		id: "cit-patents",
		name: "US Patent Citation Network",
		description: "Citation network among US Patents.",
		url: "https://snap.stanford.edu/data/cit-Patents.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "citation",
	},

	// =========================================================================
	// Collaboration Networks
	// =========================================================================
	{
		id: "ca-astroph",
		name: "Arxiv Astro Physics Collaborations",
		description: "Collaboration network of Arxiv Astro Physics category.",
		url: "https://snap.stanford.edu/data/ca-AstroPh.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "collaboration",
	},
	{
		id: "ca-condmat",
		name: "Arxiv Condensed Matter Collaborations",
		description: "Collaboration network of Arxiv Condensed Matter category.",
		url: "https://snap.stanford.edu/data/ca-CondMat.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "collaboration",
	},
	{
		id: "ca-grqc",
		name: "Arxiv General Relativity Collaborations",
		description: "Collaboration network of Arxiv General Relativity category.",
		url: "https://snap.stanford.edu/data/ca-GrQc.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "collaboration",
	},
	{
		id: "ca-hepph",
		name: "Arxiv High Energy Physics Collaborations",
		description: "Collaboration network of Arxiv High Energy Physics category.",
		url: "https://snap.stanford.edu/data/ca-HepPh.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "collaboration",
	},
	{
		id: "ca-hepth",
		name: "Arxiv High Energy Physics Theory Collaborations",
		description: "Collaboration network of Arxiv High Energy Physics Theory category.",
		url: "https://snap.stanford.edu/data/ca-HepTh.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "collaboration",
	},

	// =========================================================================
	// Web Graphs
	// =========================================================================
	{
		id: "web-berkstan",
		name: "Berkeley-Stanford Web Graph",
		description: "Web graph of Berkeley and Stanford.",
		url: "https://snap.stanford.edu/data/web-BerkStan.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks: Natural Cluster Sizes and the Absence of Large Well-Defined Clusters",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "web",
	},
	{
		id: "web-google",
		name: "Google Web Graph",
		description: "Web graph from Google.",
		url: "https://snap.stanford.edu/data/web-Google.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks: Natural Cluster Sizes and the Absence of Large Well-Defined Clusters",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "web",
	},
	{
		id: "web-notredame",
		name: "Notre Dame Web Graph",
		description: "Web graph of Notre Dame.",
		url: "https://snap.stanford.edu/data/web-NotreDame.txt.gz",
		directed: true,
		citation: {
			authors: ["R. Albert", "H. Jeong", "A. Barabasi"],
			title: "Diameter of the World Wide Web",
			venue: "Nature",
			year: 1999,
		},
		category: "web",
	},
	{
		id: "web-stanford",
		name: "Stanford Web Graph",
		description: "Web graph of Stanford.edu.",
		url: "https://snap.stanford.edu/data/web-Stanford.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks: Natural Cluster Sizes and the Absence of Large Well-Defined Clusters",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "web",
	},

	// =========================================================================
	// Amazon Networks
	// =========================================================================
	{
		id: "amazon0302",
		name: "Amazon Co-Purchasing Mar 2003",
		description: "Amazon product co-purchasing network from March 2 2003.",
		url: "https://snap.stanford.edu/data/amazon0302.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "L. Adamic", "B. Huberman"],
			title: "The Dynamics of Viral Marketing",
			venue: "ACM TWEB",
			year: 2007,
		},
		category: "amazon",
	},
	{
		id: "amazon0312",
		name: "Amazon Co-Purchasing Mar 12 2003",
		description: "Amazon product co-purchasing network from March 12 2003.",
		url: "https://snap.stanford.edu/data/amazon0312.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "L. Adamic", "B. Huberman"],
			title: "The Dynamics of Viral Marketing",
			venue: "ACM TWEB",
			year: 2007,
		},
		category: "amazon",
	},
	{
		id: "amazon0505",
		name: "Amazon Co-Purchasing May 2003",
		description: "Amazon product co-purchasing network from May 5 2003.",
		url: "https://snap.stanford.edu/data/amazon0505.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "L. Adamic", "B. Huberman"],
			title: "The Dynamics of Viral Marketing",
			venue: "ACM TWEB",
			year: 2007,
		},
		category: "amazon",
	},
	{
		id: "amazon0601",
		name: "Amazon Co-Purchasing Jun 2003",
		description: "Amazon product co-purchasing network from June 1 2003.",
		url: "https://snap.stanford.edu/data/amazon0601.txt.gz",
		directed: true,
		citation: {
			authors: ["J. Leskovec", "L. Adamic", "B. Huberman"],
			title: "The Dynamics of Viral Marketing",
			venue: "ACM TWEB",
			year: 2007,
		},
		category: "amazon",
	},

	// =========================================================================
	// Peer-to-Peer Networks
	// =========================================================================
	{
		id: "p2p-gnutella04",
		name: "Gnutella P2P Aug 4 2002",
		description: "Gnutella peer to peer network from August 4 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella04.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network: Properties of Large-Scale Peer-to-Peer Systems",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella05",
		name: "Gnutella P2P Aug 5 2002",
		description: "Gnutella peer to peer network from August 5 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella05.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella06",
		name: "Gnutella P2P Aug 6 2002",
		description: "Gnutella peer to peer network from August 6 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella06.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella08",
		name: "Gnutella P2P Aug 8 2002",
		description: "Gnutella peer to peer network from August 8 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella08.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella09",
		name: "Gnutella P2P Aug 9 2002",
		description: "Gnutella peer to peer network from August 9 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella09.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella24",
		name: "Gnutella P2P Aug 24 2002",
		description: "Gnutella peer to peer network from August 24 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella24.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella25",
		name: "Gnutella P2P Aug 25 2002",
		description: "Gnutella peer to peer network from August 25 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella25.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella30",
		name: "Gnutella P2P Aug 30 2002",
		description: "Gnutella peer to peer network from August 30 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella30.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},
	{
		id: "p2p-gnutella31",
		name: "Gnutella P2P Aug 31 2002",
		description: "Gnutella peer to peer network from August 31 2002.",
		url: "https://snap.stanford.edu/data/p2p-Gnutella31.txt.gz",
		directed: true,
		citation: {
			authors: ["M. Ripeanu", "I. Foster", "A. Iamnitchi"],
			title: "Mapping the Gnutella Network",
			venue: "IEEE Internet Computing",
			year: 2002,
		},
		category: "p2p",
	},

	// =========================================================================
	// Road Networks
	// =========================================================================
	{
		id: "roadnet-ca",
		name: "California Road Network",
		description: "Road network of California. Nodes are intersections/endpoints, edges are roads.",
		url: "https://snap.stanford.edu/data/roadNet-CA.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "road",
	},
	{
		id: "roadnet-pa",
		name: "Pennsylvania Road Network",
		description: "Road network of Pennsylvania.",
		url: "https://snap.stanford.edu/data/roadNet-PA.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "road",
	},
	{
		id: "roadnet-tx",
		name: "Texas Road Network",
		description: "Road network of Texas.",
		url: "https://snap.stanford.edu/data/roadNet-TX.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "K. Lang", "A. Dasgupta", "M. Mahoney"],
			title: "Community Structure in Large Networks",
			venue: "Internet Mathematics",
			year: 2009,
		},
		category: "road",
	},

	// =========================================================================
	// Autonomous Systems
	// =========================================================================
	{
		id: "as-skitter",
		name: "Internet Topology (Skitter)",
		description: "Internet topology graph from traceroutes run daily in 2005.",
		url: "https://snap.stanford.edu/data/as-Skitter.txt.gz",
		directed: false,
		citation: {
			authors: ["J. Leskovec", "J. Kleinberg", "C. Faloutsos"],
			title: "Graph Evolution: Densification and Shrinking Diameters",
			venue: "ACM TKDD",
			year: 2007,
		},
		category: "autonomous-systems",
	},

	// =========================================================================
	// Location-based Networks
	// =========================================================================
	{
		id: "loc-gowalla",
		name: "Gowalla Location Network",
		description: "Gowalla location based online social network.",
		url: "https://snap.stanford.edu/data/loc-gowalla_edges.txt.gz",
		directed: false,
		citation: {
			authors: ["E. Cho", "S. Myers", "J. Leskovec"],
			title: "Friendship and Mobility: Friendship and Mobility: User Movement in Location-Based Social Networks",
			venue: "KDD",
			year: 2011,
		},
		category: "location",
	},
	{
		id: "loc-brightkite",
		name: "Brightkite Location Network",
		description: "Brightkite location based online social network.",
		url: "https://snap.stanford.edu/data/loc-brightkite_edges.txt.gz",
		directed: false,
		citation: {
			authors: ["E. Cho", "S. Myers", "J. Leskovec"],
			title: "Friendship and Mobility: User Movement in Location-Based Social Networks",
			venue: "KDD",
			year: 2011,
		},
		category: "location",
	},
];
