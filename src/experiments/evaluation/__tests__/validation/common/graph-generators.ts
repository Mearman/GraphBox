/**
 * Graph generators for testing expansion algorithms
 *
 * Includes two types of generators:
 * 1. Edge array generators - return Array<[string, string]> for InstrumentedExpander
 * 2. TestGraphExpander generators - return TestGraphExpander objects for other tests
 */

import { TestGraphExpander } from "./test-graph-expander";

// ============================================================================
// Edge Array Generators (for InstrumentedExpander)
// ============================================================================

/**
 * Creates a star graph - worst case for node explosion.
 * Expanding the hub immediately exposes all nodes.
 * @param numberSpokes - Number of spokes connected to the hub
 */
export const createStarGraph = (numberSpokes: number): Array<[string, string]> => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < numberSpokes; index++) {
		edges.push(["HUB", `S${index}`]);
	}
	return edges;
};

/**
 * Creates a double-star graph with two hubs connected.
 * Tests behavior when path goes through hubs.
 * @param spokesPerHub - Number of spokes per hub
 */
export const createDoubleStarGraph = (spokesPerHub: number): Array<[string, string]> => {
	const edges: Array<[string, string]> = [["HUB_A", "HUB_B"]]; // Hub connection

	// Spokes for HUB_A
	for (let index = 0; index < spokesPerHub; index++) {
		edges.push(["HUB_A", `SA${index}`]);
	}

	// Spokes for HUB_B
	for (let index = 0; index < spokesPerHub; index++) {
		edges.push(["HUB_B", `SB${index}`]);
	}

	return edges;
};

/**
 * Creates a hub-and-spoke network with multiple interconnected hubs.
 * @param numberHubs - Number of hubs
 * @param spokesPerHub - Number of spokes per hub
 */
export const createMultiHubGraph = (numberHubs: number, spokesPerHub: number): Array<[string, string]> => {
	const edges: Array<[string, string]> = [];

	// Connect all hubs in a ring
	for (let index = 0; index < numberHubs; index++) {
		edges.push([`H${index}`, `H${(index + 1) % numberHubs}`]);
	}

	// Add spokes to each hub
	for (let h = 0; h < numberHubs; h++) {
		for (let s = 0; s < spokesPerHub; s++) {
			edges.push([`H${h}`, `L${h}_${s}`]);
		}
	}

	return edges;
};

/**
 * Creates a scale-free-like graph with power-law degree distribution.
 * @param numberNodes - Number of nodes in the graph
 * @param seed - Random seed for reproducibility
 */
export const createScaleFreeGraph = (numberNodes: number, seed = 42): Array<[string, string]> => {
	const edges: Array<[string, string]> = [];
	const degrees = new Map<string, number>();

	// Simple preferential attachment
	let state = seed;
	const random = () => {
		const x = Math.sin(state++) * 10_000;
		return x - Math.floor(x);
	};

	// Start with a small connected core
	edges.push(["N0", "N1"], ["N1", "N2"], ["N2", "N0"]);
	degrees.set("N0", 2);
	degrees.set("N1", 2);
	degrees.set("N2", 2);

	// Add nodes with preferential attachment
	for (let index = 3; index < numberNodes; index++) {
		const newNode = `N${index}`;
		degrees.set(newNode, 0);

		// Connect to 2 existing nodes based on degree
		const totalDegree = [...degrees.values()].reduce((a, b) => a + b, 0);
		const numberConnections = Math.min(2, index);

		const connected = new Set<string>();
		while (connected.size < numberConnections) {
			let r = random() * totalDegree;
			for (const [node, deg] of degrees) {
				if (node === newNode || connected.has(node)) continue;
				r -= deg;
				if (r <= 0) {
					edges.push([newNode, node]);
					connected.add(node);
					degrees.set(node, (degrees.get(node) ?? 0) + 1);
					degrees.set(newNode, (degrees.get(newNode) ?? 0) + 1);
					break;
				}
			}
		}
	}

	return edges;
};

// ============================================================================
// TestGraphExpander Generators (for TestGraphExpander-based tests)
// ============================================================================

/**
 * Creates a star graph with a central hub connected to all other nodes.
 * @param numSpokes
 * @param numberSpokes
 */
export const createStarGraphExpander = (numberSpokes: number): TestGraphExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < numberSpokes; index++) {
		edges.push(["HUB", `S${index}`]);
	}
	return new TestGraphExpander(edges);
};

/**
 * Creates a hub graph with multiple hubs connected to each other and to leaf nodes.
 * @param numHubs
 * @param numberHubs
 * @param leavesPerHub
 */
export const createHubGraphExpander = (numberHubs: number, leavesPerHub: number): TestGraphExpander => {
	const edges: Array<[string, string]> = [];

	// Connect hubs to each other (fully connected)
	for (let index = 0; index < numberHubs; index++) {
		for (let index_ = index + 1; index_ < numberHubs; index_++) {
			edges.push([`H${index}`, `H${index_}`]);
		}
	}

	// Connect leaves to hubs
	for (let h = 0; h < numberHubs; h++) {
		for (let l = 0; l < leavesPerHub; l++) {
			edges.push([`H${h}`, `L${h}_${l}`]);
		}
	}

	return new TestGraphExpander(edges);
};

/**
 * Creates a grid graph (lattice) with uniform degree distribution.
 * @param rows
 * @param cols
 */
export const createGridGraphExpander = (rows: number, cols: number): TestGraphExpander => {
	const edges: Array<[string, string]> = [];

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const node = `${r}_${c}`;
			// Right neighbor
			if (c < cols - 1) {
				edges.push([node, `${r}_${c + 1}`]);
			}
			// Down neighbor
			if (r < rows - 1) {
				edges.push([node, `${r + 1}_${c}`]);
			}
		}
	}

	return new TestGraphExpander(edges);
};

/**
 * Creates a chain graph: A -- B -- C -- D -- ...
 * @param length
 */
export const createChainGraphExpander = (length: number): TestGraphExpander => {
	const edges: Array<[string, string]> = [];
	for (let index = 0; index < length - 1; index++) {
		edges.push([`N${index}`, `N${index + 1}`]);
	}
	return new TestGraphExpander(edges);
};

// Re-export the functions from test-graph-expander for consistency
export { TestGraphExpander } from "./test-graph-expander";
