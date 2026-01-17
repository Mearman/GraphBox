import type { GraphSpec } from "../spec";
import type { SeededRandom,TestEdge, TestNode } from "./types";

/**
 * Add edge to edge list with optional type assignment.
 * @param edges - Edge list to modify
 * @param source - Source node ID
 * @param target - Target node ID
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
const addEdge = (edges: TestEdge[], source: string, target: string, spec: GraphSpec, rng: SeededRandom): void => {
	const edge: TestEdge = { source, target };

	if (spec.schema.kind === "heterogeneous") {
		// Assign random edge type (could be based on config.edgeTypes)
		edge.type = rng.choice(["type_a", "type_b", "type_c"]);
	}

	edges.push(edge);
};

/**
 * Shuffle array in-place using Fisher-Yates algorithm with seeded RNG.
 * @param array - Array to shuffle
 * @param rng - Seeded random number generator
 */
const shuffleArray = <T>(array: T[], rng: SeededRandom): void => {
	for (let index = array.length - 1; index > 0; index--) {
		const index_ = rng.integer(0, index);
		[array[index], array[index_]] = [array[index_], array[index]];
	}
};

/**
 * Check if edge exists between source and target.
 * @param edges - Edge list
 * @param source - Source node ID
 * @param target - Target node ID
 * @returns True if edge exists
 */
const hasEdge = (edges: TestEdge[], source: string, target: string): boolean => {
	return edges.some(e =>
		(e.source === source && e.target === target) ||
    (e.source === target && e.target === source)
	);
};

/**
 * Generate Hamiltonian graph edges.
 * Hamiltonian graphs contain a Hamiltonian cycle (visiting all vertices exactly once and returning to start).
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateHamiltonianEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	// Create random permutation for Hamiltonian cycle
	const permutation = Array.from({ length: nodes.length }, (_, index) => index);
	shuffleArray(permutation, rng);

	// Add cycle edges
	for (let index = 0; index < permutation.length; index++) {
		const current = nodes[permutation[index]].id;
		const next = nodes[permutation[(index + 1) % permutation.length]].id;
		addEdge(edges, current, next, spec, rng);
	}

	// Store Hamiltonian cycle for validation
	for (const [index, node] of nodes.entries()) {
		node.data = node.data || {};
		node.data.hamiltonianPosition = index;
		node.data.hamiltonianCycle = permutation.map(p => nodes[p].id);
	}

	// Add random chords (up to n/2 extra edges)
	const extraEdges = Math.floor(nodes.length / 2);
	let added = 0;

	for (let index = 0; index < extraEdges && added < extraEdges; index++) {
		const a = Math.floor(rng.next() * nodes.length);
		const b = Math.floor(rng.next() * nodes.length);

		if (a !== b && !hasEdge(edges, nodes[a].id, nodes[b].id)) {
			addEdge(edges, nodes[a].id, nodes[b].id, spec, rng);
			added++;
		}
	}
};

/**
 * Generate traceable graph edges.
 * Traceable graphs contain a Hamiltonian path (visiting all vertices exactly once).
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateTraceableEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 2) return;

	// Create random permutation for Hamiltonian path
	const permutation = Array.from({ length: nodes.length }, (_, index) => index);
	shuffleArray(permutation, rng);

	// Add path edges (no cycle)
	for (let index = 0; index < permutation.length - 1; index++) {
		addEdge(edges, nodes[permutation[index]].id, nodes[permutation[index + 1]].id, spec, rng);
	}

	// Store Hamiltonian path for validation
	for (const [index, node] of nodes.entries()) {
		node.data = node.data || {};
		node.data.traceablePosition = index;
		node.data.traceablePath = permutation.map(p => nodes[p].id);
	}

	// Add random edges (avoid creating cycle that would make it Hamiltonian)
	const extraEdges = Math.floor(nodes.length / 3);
	let added = 0;

	for (let index = 0; index < extraEdges && added < extraEdges; index++) {
		const a = Math.floor(rng.next() * nodes.length);
		const b = Math.floor(rng.next() * nodes.length);

		if (a === b) continue;

		// Don't connect last to first (would create cycle)
		const lastIndex = permutation.at(-1);
		const firstIndex = permutation[0];
		if ((a === lastIndex && b === firstIndex) || (a === firstIndex && b === lastIndex)) continue;

		if (!hasEdge(edges, nodes[a].id, nodes[b].id)) {
			addEdge(edges, nodes[a].id, nodes[b].id, spec, rng);
			added++;
		}
	}
};

/**
 * Generate graph with specified diameter.
 * Diameter is the maximum distance between any pair of vertices.
 * Uses complete graph (diameter=1), path graph (diameter=n-1), or intermediate structure.
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateDiameterEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (spec.diameter?.kind !== "diameter") {
		throw new Error("Diameter graph requires diameter spec");
	}

	const { value: targetDiameter } = spec.diameter;

	// Store diameter for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.targetDiameter = targetDiameter;
	}

	if (targetDiameter === 1) {
		// Complete graph K_n has diameter 1
		for (let index = 0; index < nodes.length; index++) {
			for (let index_ = index + 1; index_ < nodes.length; index_++) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
	} else if (targetDiameter >= nodes.length - 1) {
		// Path graph P_n has diameter n-1
		for (let index = 0; index < nodes.length - 1; index++) {
			addEdge(edges, nodes[index].id, nodes[index + 1].id, spec, rng);
		}
	} else {
		// Create path with extra edges to achieve intermediate diameter
		// Start with path
		for (let index = 0; index < nodes.length - 1; index++) {
			addEdge(edges, nodes[index].id, nodes[index + 1].id, spec, rng);
		}

		// Add shortcut edges to reduce diameter from (n-1) to target
		const currentDiameter = nodes.length - 1;
		const reductionsNeeded = currentDiameter - targetDiameter;

		for (let r = 0; r < reductionsNeeded; r++) {
			const skip = Math.floor(nodes.length / (reductionsNeeded + 1)) * (r + 1);
			const index = Math.floor(rng.next() * (nodes.length - skip - 1));
			const index_ = index + skip;

			if (index_ < nodes.length && !hasEdge(edges, nodes[index].id, nodes[index_].id)) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
	}
};

/**
 * Generate graph with specified radius.
 * Radius is the minimum eccentricity among all vertices.
 * Uses star graph (radius=1) or path graph with center connections.
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateRadiusEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (spec.radius?.kind !== "radius") {
		throw new Error("Radius graph requires radius spec");
	}

	const { value: targetRadius } = spec.radius;

	// Store radius for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.targetRadius = targetRadius;
	}

	// Create star graph (radius = 1) or path (radius ≈ n/2)
	if (targetRadius === 1) {
		// Star graph: center connected to all others
		const center = nodes[0].id;
		for (let index = 1; index < nodes.length; index++) {
			addEdge(edges, center, nodes[index].id, spec, rng);
		}
	} else {
		// Path graph has radius ⌈(n-1)/2⌉
		for (let index = 0; index < nodes.length - 1; index++) {
			addEdge(edges, nodes[index].id, nodes[index + 1].id, spec, rng);
		}

		// If target radius is smaller than path radius, add center connections
		const pathRadius = Math.ceil((nodes.length - 1) / 2);
		if (targetRadius < pathRadius) {
			// Connect middle node to others to reduce eccentricity
			const center = nodes[Math.floor(nodes.length / 2)].id;
			const connectionsToAdd = pathRadius - targetRadius;

			for (let index = 0; index < connectionsToAdd && index < Math.floor(nodes.length / 2); index++) {
				const target = nodes[index].id;
				if (!hasEdge(edges, center, target)) {
					addEdge(edges, center, target, spec, rng);
				}
			}
		}
	}
};

/**
 * Generate graph with specified girth.
 * Girth is the length of the shortest cycle.
 * Uses cycle graph C_k (girth = k) with additional tree nodes.
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateGirthEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	if (spec.girth?.kind !== "girth") {
		throw new Error("Girth graph requires girth spec");
	}

	const { girth: targetGirth } = spec.girth;

	// Store girth for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.targetGirth = targetGirth;
	}

	// Ensure we have enough nodes for the cycle
	const cycleLength = Math.min(targetGirth, nodes.length);

	// Create cycle C_k for girth = k
	for (let index = 0; index < cycleLength; index++) {
		const next = (index + 1) % cycleLength;
		addEdge(edges, nodes[index].id, nodes[next].id, spec, rng);
	}

	// Attach remaining nodes as trees (preserves girth)
	for (let index = cycleLength; index < nodes.length; index++) {
		// Connect to a random node in the cycle (creating a tree attachment)
		const parent = Math.floor(rng.next() * cycleLength);
		addEdge(edges, nodes[parent].id, nodes[index].id, spec, rng);
	}
};

/**
 * Generate graph with specified circumference.
 * Circumference is the length of the longest cycle.
 * Uses cycle graph C_k (circumference = k) with additional chords.
 * @param nodes - Node list
 * @param edges - Edge list to modify
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const generateCircumferenceEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	if (spec.circumference?.kind !== "circumference") {
		throw new Error("Circumference graph requires circumference spec");
	}

	const { value: targetCircumference } = spec.circumference;

	// Store circumference for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.targetCircumference = targetCircumference;
	}

	// Ensure target is achievable
	const cycleLength = Math.min(targetCircumference, nodes.length);

	// Create cycle C_k for circumference = k
	for (let index = 0; index < cycleLength; index++) {
		const next = (index + 1) % cycleLength;
		addEdge(edges, nodes[index].id, nodes[next].id, spec, rng);
	}

	// Add remaining nodes with edges that don't create longer cycles
	for (let index = cycleLength; index < nodes.length; index++) {
		// Connect as tree branch (doesn't increase circumference)
		const parent = Math.floor(rng.next() * cycleLength);
		addEdge(edges, nodes[parent].id, nodes[index].id, spec, rng);
	}

	// Add chords within the cycle (doesn't increase longest cycle)
	if (cycleLength > 4) {
		const numberChords = Math.floor(cycleLength / 4);
		for (let index = 0; index < numberChords; index++) {
			const a = Math.floor(rng.next() * cycleLength);
			const b = (a + 2) % cycleLength;
			if (!hasEdge(edges, nodes[a].id, nodes[b].id)) {
				addEdge(edges, nodes[a].id, nodes[b].id, spec, rng);
			}
		}
	}
};
