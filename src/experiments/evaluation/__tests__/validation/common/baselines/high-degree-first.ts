/**
 * High-Degree-First Baseline
 *
 * Prioritises high-degree nodes (opposite of thesis method).
 * Tests whether the thesis innovation (deferring high-degree nodes) matters.
 */

import type { GraphExpander } from "../../../../../../interfaces/graph-expander";

export class HighDegreeFirstExpansion {
	private expander: GraphExpander<{ id: string }>;
	private seeds: string[];
	private visited = new Set<string>();
	private sampledEdges = new Set<string>();
	private paths: Array<{ nodes: string[]; edges: string[] }> = [];

	constructor(expander: GraphExpander<{ id: string }>, seeds: string[]) {
		if (seeds.length === 0) {
			throw new Error("At least one seed node is required");
		}
		this.expander = expander;
		this.seeds = seeds;
	}

	async run(): Promise<{
		sampledNodes: Set<string>;
		sampledEdges: Set<string>;
		paths: Array<{ nodes: string[]; edges: string[] }>;
		stats: { nodesExpanded: number; edgesTraversed: number; iterations: number };
	}> {
		const frontiers: Set<string>[] = this.seeds.map((s) => new Set([s]));
		const parents = new Map<string, string | null>();

		for (const seed of this.seeds) {
			this.visited.add(seed);
			parents.set(seed, null);
		}

		let iterations = 0;
		let edgesTraversed = 0;

		while (frontiers.some((f) => f.size > 0)) {
			iterations++;

			// Select frontier with HIGHEST degree node (opposite of thesis)
			let selectedFrontier = 0;
			let maxDegree = -1;
			let selectedNode: string | null = null;

			for (const [f, frontier] of frontiers.entries()) {
				for (const nodeId of frontier) {
					const degree = this.expander.getDegree(nodeId);
					if (degree > maxDegree) {
						maxDegree = degree;
						selectedFrontier = f;
						selectedNode = nodeId;
					}
				}
			}

			if (!selectedNode) break;

			frontiers[selectedFrontier].delete(selectedNode);

			const neighbors = await this.expander.getNeighbors(selectedNode);
			edgesTraversed += neighbors.length;

			// Sort neighbors by degree (highest first) - opposite of thesis
			const sortedNeighbors = neighbors.sort((a, b) => {
				return this.expander.getDegree(b.targetId) - this.expander.getDegree(a.targetId);
			});

			for (const neighbor of sortedNeighbors) {
				if (!this.visited.has(neighbor.targetId)) {
					this.visited.add(neighbor.targetId);
					parents.set(neighbor.targetId, selectedNode);
					frontiers[selectedFrontier].add(neighbor.targetId);

					const edgeKey = `${selectedNode}->${neighbor.targetId}`;
					this.sampledEdges.add(edgeKey);
					this.expander.addEdge?.(selectedNode, neighbor.targetId, neighbor.relationshipType);
				}
			}

			// Check for path completion
			this.checkPaths(parents);
		}

		return {
			sampledNodes: this.visited,
			sampledEdges: this.sampledEdges,
			paths: this.paths,
			stats: {
				nodesExpanded: this.visited.size,
				edgesTraversed,
				iterations,
			},
		};
	}

	private checkPaths(parents: Map<string, string | null>): void {
		if (this.seeds.length < 2) return;

		const seed0 = this.seeds[0];
		const seed1 = this.seeds[1];

		// Reconstruct path from seed0 to seed1 if exists
		const path: string[] = [];
		let current = seed1;

		while (current !== null) {
			path.unshift(current);
			const parent = parents.get(current);
			if (parent === undefined) break;
			if (parent === null) break;
			current = parent;
		}

		if (path[0] === seed0 && path.length > 1) {
			const edges: string[] = [];
			for (let index = 0; index < path.length - 1; index++) {
				edges.push(`${path[index]}->${path[index + 1]}`);
			}
			this.paths.push({ nodes: path, edges });
		}
	}
}
