import type { GraphSpec } from "../spec";
import type { SeededRandom,TestEdge, TestNode } from "./types";

/**
 * Generate unit disk graph edges.
 * Unit disk graphs are created by placing points in a plane and connecting
 * points within a specified distance (unit radius).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateUnitDiskEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	const unitRadius = spec.unitDisk?.kind === "unit_disk" && spec.unitDisk.unitRadius !== undefined
		? spec.unitDisk.unitRadius
		: 1;
	const spaceSize = spec.unitDisk?.kind === "unit_disk" && spec.unitDisk.spaceSize !== undefined
		? spec.unitDisk.spaceSize
		: Math.sqrt(nodes.length);

	// Place points randomly in the space
	for (const node of nodes) {
		if (!node.data) node.data = {};
		node.data.x = rng.next() * spaceSize;
		node.data.y = rng.next() * spaceSize;
	}

	// Connect points within unit radius
	for (let index = 0; index < nodes.length; index++) {
		for (let index_ = index + 1; index_ < nodes.length; index_++) {
			const sourceData = nodes[index].data;
			const targetData = nodes[index_].data;

			if (!sourceData || !targetData) continue;

			const dx = (sourceData.x as number) - (targetData.x as number);
			const dy = (sourceData.y as number) - (targetData.y as number);
			const distribution = Math.hypot(dx, dy);

			if (distribution <= unitRadius) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
	}
};

/**
 * Generate disk graph edges.
 * Disk graphs are created by placing points in a plane and connecting
 * points within a specified distance (disk radius).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateDiskEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	const disk = spec as unknown as { diskGraphNew?: { kind: string; diskRadius?: number } };

	if (disk.diskGraphNew?.kind !== "disk") {
		throw new Error("Disk graph generation requires disk spec");
	}

	const diskRadius = disk.diskGraphNew.diskRadius ?? 1;
	const spaceSize = Math.sqrt(nodes.length);

	// Place points randomly in the space
	for (const node of nodes) {
		if (!node.data) node.data = {};
		node.data.x = rng.next() * spaceSize;
		node.data.y = rng.next() * spaceSize;
	}

	// Connect points within disk radius
	for (let index = 0; index < nodes.length; index++) {
		for (let index_ = index + 1; index_ < nodes.length; index_++) {
			const sourceData = nodes[index].data;
			const targetData = nodes[index_].data;

			if (!sourceData || !targetData) continue;

			const dx = (sourceData.x as number) - (targetData.x as number);
			const dy = (sourceData.y as number) - (targetData.y as number);
			const distance = Math.hypot(dx, dy);

			if (distance <= diskRadius) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
	}
};

/**
 * Generate planar graph edges.
 * Planar graphs can be drawn in the plane without edge crossings.
 * Uses incremental construction starting from a cycle.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generatePlanarEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 4) {
		// Small graphs are always planar
		for (let index = 0; index < nodes.length; index++) {
			for (let index_ = index + 1; index_ < nodes.length; index_++) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
		return;
	}

	// Start with a cycle (planar for any n)
	for (let index = 0; index < nodes.length; index++) {
		addEdge(edges, nodes[index].id, nodes[(index + 1) % nodes.length].id, spec, rng);
	}

	// Maximum edges in planar graph: 3n - 6 (Euler's formula)
	const maxEdges = 3 * nodes.length - 6;

	// Add random chords while maintaining planarity (simplified check)
	let attempts = 0;
	const maxAttempts = nodes.length * 2;

	while (edges.length < maxEdges && attempts < maxAttempts) {
		attempts++;
		const index = Math.floor(rng.next() * nodes.length);
		const index_ = Math.floor(rng.next() * nodes.length);

		if (index >= index_) continue;

		// Check if edge already exists
		if (hasEdge(edges, nodes[index].id, nodes[index_].id)) continue;

		// Add edge (planar graphs are quite permissive)
		addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
	}
};

/**
 * Add edge to edge list.
 * @param edges - Edge list
 * @param source - Source node ID
 * @param target - Target node ID
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
export const addEdge = (edges: TestEdge[], source: string, target: string, spec: GraphSpec, rng: SeededRandom): void => {
	const edge: TestEdge = { source, target };

	if (spec.schema.kind === "heterogeneous") {
		// Assign random edge type (could be based on config.edgeTypes)
		edge.type = rng.choice(["type_a", "type_b", "type_c"]);
	}

	edges.push(edge);
};

/**
 * Check if edge exists between source and target.
 * @param edges - Edge list
 * @param source - Source node ID
 * @param target - Target node ID
 * @returns True if edge exists
 */
export const hasEdge = (edges: TestEdge[], source: string, target: string): boolean => {
	return edges.some(e =>
		(e.source === source && e.target === target) ||
    (e.source === target && e.target === source)
	);
};
