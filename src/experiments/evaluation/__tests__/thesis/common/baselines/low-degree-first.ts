/**
 * Low-Degree-First Baseline
 *
 * Similar to thesis method, but simpler.
 * Always picks lowest degree node without considering N-seed context.
 */

import type { GraphExpander } from "../../../../../interfaces/graph-expander";

export class LowDegreeFirstExpansion {
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

			// Select frontier with LOWEST degree node (similar to thesis)
			let selectedFrontier = 0;
			let minDegree = Infinity;
			let selectedNode: string | null = null;

			for (let f = 0; f < frontiers.length; f++) {
				for (const nodeId of frontiers[f]) {
					const degree = this.expander.getDegree(nodeId);
					if (degree < minDegree) {
						minDegree = degree;
						selectedFrontier = f;
						selectedNode = nodeId;
					}
				}
			}

			if (!selectedNode || minDegree === Infinity) break;

			frontiers[selectedFrontier].delete(selectedNode);

			const neighbors = await this.expander.getNeighbors(selectedNode);
			edgesTraversed += neighbors.length;

			for (const neighbor of neighbors) {
				if (!this.visited.has(neighbor.targetId)) {
					this.visited.add(neighbor.targetId);
					parents.set(neighbor.targetId, selectedNode);
					frontiers[selectedFrontier].add(neighbor.targetId);

					const edgeKey = `${selectedNode}->${neighbor.targetId}`;
					this.sampledEdges.add(edgeKey);
					this.expander.addEdge?.(selectedNode, neighbor.targetId, neighbor.relationshipType);
				}
			}

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
			for (let i = 0; i < path.length - 1; i++) {
				edges.push(`${path[i]}->${path[i + 1]}`);
			}
			this.paths.push({ nodes: path, edges });
		}
	}
}
