/**
 * Instrumented Graph Expander for node explosion testing
 *
 * Tracks which nodes were expanded and hub expansions during testing.
 */

import type { GraphExpander, Neighbor } from "../../../../../interfaces/graph-expander";
import { identifyHubNodes } from "../../../metrics/path-diversity";

// ============================================================================
// Types
// ============================================================================

export interface TestNode {
	id: string;
}

// ============================================================================
// Instrumented Graph Expander
// ============================================================================

/**
 * Graph expander that tracks which nodes were expanded and hub expansions.
 */
export class InstrumentedExpander implements GraphExpander<TestNode> {
	private adjacency = new Map<string, Neighbor[]>();
	private degrees = new Map<string, number>();
	private nodes = new Map<string, TestNode>();
	private expandedNodes = new Set<string>();
	private hubNodes: Set<string>;
	private expansionOrder: string[] = [];

	constructor(edges: Array<[string, string]>, hubPercentile = 0.1) {
		const nodeIds = new Set<string>();
		for (const [source, target] of edges) {
			nodeIds.add(source);
			nodeIds.add(target);
		}

		for (const id of nodeIds) {
			this.adjacency.set(id, []);
			this.nodes.set(id, { id });
		}

		for (const [source, target] of edges) {
			const sourceNeighbors = this.adjacency.get(source);
			const targetNeighbors = this.adjacency.get(target);
			if (sourceNeighbors) {
				sourceNeighbors.push({ targetId: target, relationshipType: "edge" });
			}
			if (targetNeighbors) {
				targetNeighbors.push({ targetId: source, relationshipType: "edge" });
			}
		}

		for (const [nodeId, neighbors] of this.adjacency) {
			this.degrees.set(nodeId, neighbors.length);
		}

		this.hubNodes = identifyHubNodes(this.degrees, hubPercentile);
	}

	async getNeighbors(nodeId: string): Promise<Neighbor[]> {
		if (!this.expandedNodes.has(nodeId)) {
			this.expandedNodes.add(nodeId);
			this.expansionOrder.push(nodeId);
		}
		return this.adjacency.get(nodeId) ?? [];
	}

	getDegree(nodeId: string): number {
		return this.degrees.get(nodeId) ?? 0;
	}

	async getNode(nodeId: string): Promise<TestNode | null> {
		return this.nodes.get(nodeId) ?? null;
	}

	addEdge(): void {
		// No-op
	}

	calculatePriority(nodeId: string, options: { nodeWeight?: number; epsilon?: number } = {}): number {
		const { nodeWeight = 1, epsilon = 1e-10 } = options;
		const degree = this.getDegree(nodeId);
		return degree / (nodeWeight + epsilon);
	}

	// Instrumentation methods
	getExpandedNodes(): Set<string> {
		return new Set(this.expandedNodes);
	}

	getExpansionOrder(): string[] {
		return [...this.expansionOrder];
	}

	getHubNodesExpanded(): number {
		let count = 0;
		for (const node of this.expandedNodes) {
			if (this.hubNodes.has(node)) {
				count++;
			}
		}
		return count;
	}

	getHubNodes(): Set<string> {
		return this.hubNodes;
	}

	reset(): void {
		this.expandedNodes = new Set();
		this.expansionOrder = [];
	}

	getAllDegrees(): Map<string, number> {
		return this.degrees;
	}
}
