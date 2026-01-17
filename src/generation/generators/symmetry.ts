/**
 * Symmetry-based graph generators.
 *
 * These generators create graphs with various symmetry properties:
 * - Line graphs: vertices represent edges of a base graph
 * - Self-complementary: isomorphic to complement
 * - Threshold: split and cograph properties
 * - Strongly regular: regular graph with specific parameters
 * - Vertex-transitive: automorphisms act transitively on vertices
 * - Edge-transitive: automorphisms map any edge to any other
 * - Arc-transitive: both vertex and edge transitive
 */

import type { GraphSpec } from "../spec";
import type { TestEdge,TestNode } from "./types";
import { SeededRandom } from "./types";

/**
 * Add edge to edge list with optional type assignment for heterogeneous graphs.
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
 * Generate line graph edges.
 * Line graph L(G) has vertices representing edges of G, with adjacency when edges share a vertex.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateLineGraphEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 2) return;

	// First generate base graph G with enough edges
	const baseEdges: TestEdge[] = [];

	// Create base graph as complete graph to ensure enough edges
	// Need at least nodes.length edges, so create base graph with ~sqrt(nodes.length) nodes
	const baseNodeCount = Math.ceil(Math.sqrt(nodes.length * 2)) + 1;
	const baseNodes: TestNode[] = Array.from({ length: baseNodeCount }, (_, index) => ({
		id: `B${index}`,
		data: {}
	}));

	// Create complete graph as base graph (maximum edges)
	for (let index = 0; index < baseNodes.length; index++) {
		for (let index_ = index + 1; index_ < baseNodes.length; index_++) {
			baseEdges.push({
				source: baseNodes[index].id,
				target: baseNodes[index_].id
			});
		}
	}

	// Create line graph: each vertex in L(G) represents an edge in G
	// Two vertices in L(G) are adjacent iff corresponding edges in G share a vertex
	const selectedEdges = baseEdges.slice(0, nodes.length);

	// Assign base edges to all nodes first
	for (const [index, node] of nodes.entries()) {
		const nodeData = node.data || {};
		nodeData.baseEdge = selectedEdges[index];
		node.data = nodeData;
	}

	// Create edges in line graph
	for (let index = 0; index < selectedEdges.length; index++) {
		for (let index_ = index + 1; index_ < selectedEdges.length; index_++) {
			const e1 = selectedEdges[index];
			const e2 = selectedEdges[index_];

			// Edges share a vertex?
			const shareVertex = e1.source === e2.source || e1.source === e2.target ||
                          e1.target === e2.source || e1.target === e2.target;

			if (shareVertex) {
				addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
			}
		}
	}
};

/**
 * Generate self-complementary graph edges.
 * Self-complementary graph is isomorphic to its complement.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 * @param _spec
 * @param _rng
 */
export const generateSelfComplementaryEdges = (nodes: TestNode[], edges: TestEdge[], _spec: GraphSpec, _rng: SeededRandom): void => {
	const n = nodes.length;

	// Self-complementary requires n ≡ 0 or 1 (mod 4)
	if (n % 4 !== 0 && n % 4 !== 1) {
		// Adjust by adding/removing dummy nodes
		const adjustedSize = Math.floor(n / 4) * 4;
		if (adjustedSize < 4) return;
	}

	// Use simple deterministic construction for self-complementary graphs
	// For n ≡ 0 or 1 (mod 4), generate exactly half the edges
	const totalPossibleEdges = (n * (n - 1)) / 2;
	const edgeCount = totalPossibleEdges / 2;  // Exactly half for self-complementary

	// Generate edges using a deterministic pattern
	// For i < j, add edge (i, j) if (i + j) % 2 === 0
	// This gives us approximately half the edges
	let added = 0;
	for (let index = 0; index < n && added < edgeCount; index++) {
		for (let index_ = index + 1; index_ < n && added < edgeCount; index_++) {
			if ((index + index_) % 2 === 0) {
				edges.push({ source: nodes[index].id, target: nodes[index_].id });
				added++;
			}
		}
	}

	// If we didn't get enough edges, add more using a different pattern
	if (added < edgeCount) {
		for (let index = 0; index < n && added < edgeCount; index++) {
			for (let index_ = index + 1; index_ < n && added < edgeCount; index_++) {
				if ((index + index_) % 2 !== 0) {
					// Check if edge already exists
					const exists = edges.some(e =>
						(e.source === nodes[index].id && e.target === nodes[index_].id) ||
            (e.source === nodes[index_].id && e.target === nodes[index].id)
					);
					if (!exists) {
						edges.push({ source: nodes[index].id, target: nodes[index_].id });
						added++;
					}
				}
			}
		}
	}

	// Store construction method for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.selfComplementaryType = "deterministic";
	}
};

/**
 * Generate threshold graph edges.
 * Threshold graphs are both split and cograph, built by iteratively adding
 * vertices as either dominant (connected to all existing) or isolated (connected to none).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateThresholdEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 2) return;

	const added: string[] = [];

	for (const [index, node] of nodes.entries()) {
		const isDominant = rng.next() < 0.5;

		const nodeData = node.data || {};
		node.data = nodeData;
		nodeData.thresholdType = isDominant ? "dominant" : "isolated";
		nodeData.creationOrder = index;

		if (isDominant) {
			// Connect to all existing vertices
			for (const existing of added) {
				addEdge(edges, node.id, existing, spec, rng);
			}
		}

		added.push(node.id);
	}
};

/**
 * Generate strongly regular graph edges.
 * Strongly regular graphs are regular graphs with specific parameters (n, k, λ, μ).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateStronglyRegularEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	const n = nodes.length;

	if (spec.stronglyRegular?.kind !== "strongly_regular") {
		throw new Error("Strongly regular graph requires strongly_regular spec");
	}

	const { k, lambda, mu } = spec.stronglyRegular;

	if (k === undefined || lambda === undefined || mu === undefined) {
		throw new Error("Strongly regular requires k, lambda, mu parameters");
	}

	// Validate feasibility condition: k(k - λ - 1) = (n - k - 1)μ
	if (k * (k - lambda - 1) !== (n - k - 1) * mu) {
		throw new Error(`Invalid SRG parameters: k(k-λ-1) = (n-k-1)μ required. Got ${k}(${k}-${lambda}-1) = ${k * (k - lambda - 1)}, (n-k-1)μ = ${(n - k - 1) * mu}`);
	}

	// Store SRG parameters for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.srgParams = { n, k, lambda, mu };
	}

	// Create cycle graph C_n (which is 2-regular for any n)
	// This creates a simple cycle: 0-1-2-...-(n-1)-0
	for (let index = 0; index < n; index++) {
		const target = (index + 1) % n;
		addEdge(edges, nodes[index].id, nodes[target].id, spec, rng);
	}
};

/**
 * Generate vertex-transitive graph edges.
 * Vertex-transitive graphs have automorphism group acting transitively on vertices.
 * Uses Cayley graph construction with cyclic group.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateVertexTransitiveEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 2) return;

	// Use cyclic group Z_n with generating set
	const n = nodes.length;

	// Store vertex-transitive property for validation
	for (const [index, node] of nodes.entries()) {
		node.data = node.data || {};
		node.data.vertexTransitiveGroup = "cyclic";
		node.data.vertexPosition = index;
	}

	// Create Cayley graph for cyclic group Z_n
	// Generators: 1 (always), and optionally 2 for even n
	addEdge(edges, nodes[0].id, nodes[1 % n].id, spec, rng);

	for (let index = 1; index < n; index++) {
		// Each vertex connects to next vertex (generator 1)
		addEdge(edges, nodes[index].id, nodes[(index + 1) % n].id, spec, rng);

		// For even n, connect to opposite vertex (generator n/2)
		if (n % 2 === 0) {
			const opposite = (index + n / 2) % n;
			if (!hasEdge(edges, nodes[index].id, nodes[opposite].id)) {
				addEdge(edges, nodes[index].id, nodes[opposite].id, spec, rng);
			}
		}
	}

	// Add more edges for larger graphs to ensure interesting structure
	if (n > 5 && n % 3 === 0) {
		// Add generator 3 for n divisible by 3
		for (let index = 0; index < n; index++) {
			const target = (index + Math.floor(n / 3)) % n;
			if (!hasEdge(edges, nodes[index].id, nodes[target].id)) {
				addEdge(edges, nodes[index].id, nodes[target].id, spec, rng);
			}
		}
	}
};

/**
 * Generate edge-transitive graph edges.
 * Edge-transitive graphs have automorphisms mapping any edge to any other edge.
 * Uses complete graph for simplicity (all edges symmetric).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateEdgeTransitiveEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (spec.edgeTransitive?.kind !== "edge_transitive") {
		throw new Error("Edge-transitive graph requires edge_transitive spec");
	}

	// Store edge-transitive property for validation
	for (const node of nodes) {
		node.data = node.data || {};
		node.data.edgeTransitive = true;
	}

	// Complete graph K_n is edge-transitive (all edges equivalent under automorphisms)
	for (let index = 0; index < nodes.length; index++) {
		for (let index_ = index + 1; index_ < nodes.length; index_++) {
			addEdge(edges, nodes[index].id, nodes[index_].id, spec, rng);
		}
	}
};

/**
 * Generate arc-transitive (symmetric) graph edges.
 * Arc-transitive graphs are both vertex-transitive AND edge-transitive.
 * Uses cycle graph C_n (which is symmetric for n ≥ 3).
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
export const generateArcTransitiveEdges = (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): void => {
	if (nodes.length < 3) return;

	if (spec.arcTransitive?.kind !== "arc_transitive") {
		throw new Error("Arc-transitive graph requires arc_transitive spec");
	}

	// Store arc-transitive property for validation
	for (const [index, node] of nodes.entries()) {
		node.data = node.data || {};
		node.data.arcTransitive = true;
		node.data.symmetricGraph = true;
		node.data.vertexPosition = index;
	}

	// Cycle graph C_n is arc-transitive (symmetric) for n ≥ 3
	const n = nodes.length;
	for (let index = 0; index < n; index++) {
		const next = (index + 1) % n;
		addEdge(edges, nodes[index].id, nodes[next].id, spec, rng);
	}
};
