/**
 * Graph fixtures for algorithm evaluation.
 *
 * These fixtures are designed to DIFFERENTIATE between algorithms based on
 * their traversal behaviour:
 *
 * - Star graph: Tests hub explosion mitigation (DP should defer hub expansion)
 * - Hub spoke graph: Tests degree prioritisation (DP explores leaves first)
 * - Scale-free graph: Tests real-world performance (power-law degree distribution)
 * - Grid graph: Uniform degree baseline (all algorithms should behave similarly)
 */

import { TestGraphExpander } from "../validation/common/test-graph-expander";
import type { GraphFixture } from "./types";

/**
 * Star graph: 1 hub + 50 spokes.
 *
 * Worst case for node explosion - expanding the hub immediately exposes all nodes.
 * DP should defer hub expansion; BFS/FB expand hub immediately.
 */
export const starGraphFixture: GraphFixture = {
	name: "star-50",
	description: "Star graph with 1 hub and 50 spokes (worst case for hub explosion)",
	nodeCount: 51,
	optimalPathLength: 2, // S0 -> HUB -> S25
	hubCount: 1,
	create: () => {
		const edges: Array<[string, string]> = [];
		for (let index = 0; index < 50; index++) {
			edges.push(["HUB", `S${index}`]);
		}
		return new TestGraphExpander(edges);
	},
	seeds: {
		n1: ["S0"],
		n2: ["S0", "S25"],
		n3: ["S0", "S25", "S49"],
	},
};

/**
 * Hub-spoke graph: 4 interconnected hubs with 15 leaves each.
 *
 * Tests degree prioritisation on multi-hub topology.
 * DP should expand leaves before hubs; baselines converge through hubs.
 */
export const hubSpokeFixture: GraphFixture = {
	name: "hub-spoke-4x15",
	description: "4 interconnected hubs with 15 leaves each (61 nodes total)",
	nodeCount: 61,
	optimalPathLength: 3, // L0_0 -> H0 -> H1 -> L1_0
	hubCount: 4,
	create: () => {
		const edges: Array<[string, string]> = [];

		// Connect hubs in a ring
		for (let index = 0; index < 4; index++) {
			edges.push([`H${index}`, `H${(index + 1) % 4}`]);
		}

		// Add leaves to each hub
		for (let h = 0; h < 4; h++) {
			for (let l = 0; l < 15; l++) {
				edges.push([`H${h}`, `L${h}_${l}`]);
			}
		}

		return new TestGraphExpander(edges);
	},
	seeds: {
		n1: ["L0_0"],
		n2: ["L0_0", "L1_0"],
		n3: ["L0_0", "L1_0", "L2_0"],
	},
};

/**
 * Scale-free graph with preferential attachment.
 *
 * Simulates real-world citation networks with power-law degree distribution.
 * High-degree nodes emerge naturally; DP should avoid converging through them.
 */
export const scaleFreeFixture: GraphFixture = {
	name: "scale-free-100",
	description: "Scale-free graph with 100 nodes (preferential attachment)",
	nodeCount: 100,
	hubCount: 5, // Approximate top 5% by degree
	isSparse: false,
	create: () => {
		const edges: Array<[string, string]> = [];
		const degrees = new Map<string, number>();

		// Seeded RNG for reproducibility
		let state = 42;
		const random = () => {
			state = (state * 1_103_515_245 + 12_345) >>> 0;
			return state / 0xFF_FF_FF_FF;
		};

		// Start with a small connected core
		edges.push(["N0", "N1"], ["N1", "N2"], ["N2", "N0"]);
		degrees.set("N0", 2);
		degrees.set("N1", 2);
		degrees.set("N2", 2);

		// Add nodes with preferential attachment
		for (let index = 3; index < 100; index++) {
			const newNode = `N${index}`;
			degrees.set(newNode, 0);

			// Connect to 2 existing nodes based on degree (rich get richer)
			const totalDegree = [...degrees.values()].reduce((a, b) => a + b, 0);
			let connections = 0;

			while (connections < 2 && totalDegree > 0) {
				let r = random() * totalDegree;
				for (const [node, deg] of degrees) {
					if (node === newNode) continue;
					r -= deg;
					if (r <= 0) {
						edges.push([newNode, node]);
						degrees.set(node, (degrees.get(node) ?? 0) + 1);
						degrees.set(newNode, (degrees.get(newNode) ?? 0) + 1);
						connections++;
						break;
					}
				}
			}
		}

		return new TestGraphExpander(edges);
	},
	seeds: {
		n1: ["N50"],
		n2: ["N10", "N90"],
		n3: ["N10", "N50", "N90"],
	},
};

/**
 * Grid graph (lattice) with uniform degree.
 *
 * Baseline for comparison - all algorithms should behave similarly
 * since there are no hubs to prioritize or avoid.
 */
export const gridFixture: GraphFixture = {
	name: "grid-10x10",
	description: "10x10 grid lattice (uniform degree ~4)",
	nodeCount: 100,
	hubCount: 0,
	isSparse: false,
	create: () => {
		const edges: Array<[string, string]> = [];

		for (let r = 0; r < 10; r++) {
			for (let c = 0; c < 10; c++) {
				const node = `${r}_${c}`;
				// Right neighbor
				if (c < 9) {
					edges.push([node, `${r}_${c + 1}`]);
				}
				// Down neighbor
				if (r < 9) {
					edges.push([node, `${r + 1}_${c}`]);
				}
			}
		}

		return new TestGraphExpander(edges);
	},
	seeds: {
		n1: ["0_0"],
		n2: ["0_0", "9_9"],
		n3: ["0_0", "5_5", "9_9"],
	},
};

/**
 * Double-star graph: two hubs connected, each with spokes.
 *
 * Tests pathfinding when optimal path MUST go through hubs.
 * Both algorithms will find the path, but DP explores more spokes first.
 */
export const doubleStarFixture: GraphFixture = {
	name: "double-star-20x20",
	description: "Two interconnected hubs with 20 spokes each",
	nodeCount: 42,
	optimalPathLength: 3, // SA_0 -> HUB_A -> HUB_B -> SB_0
	hubCount: 2,
	create: () => {
		const edges: Array<[string, string]> = [["HUB_A", "HUB_B"]];

		for (let index = 0; index < 20; index++) {
			edges.push(["HUB_A", `SA_${index}`]);
		}
		for (let index = 0; index < 20; index++) {
			edges.push(["HUB_B", `SB_${index}`]);
		}

		return new TestGraphExpander(edges);
	},
	seeds: {
		n1: ["SA_0"],
		n2: ["SA_0", "SB_0"],
		n3: ["SA_0", "HUB_A", "SB_0"],
	},
};

/**
 * All fixtures exported as a map.
 */
export const fixtures: Record<string, GraphFixture> = {
	starGraph: starGraphFixture,
	hubSpoke: hubSpokeFixture,
	scaleFree: scaleFreeFixture,
	grid: gridFixture,
	doubleStar: doubleStarFixture,
};

/**
 * Get all fixtures as an array.
 */
export const allFixtures = (): GraphFixture[] => Object.values(fixtures);
