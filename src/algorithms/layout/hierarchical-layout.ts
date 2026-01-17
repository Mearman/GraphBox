/**
 * Hierarchical/Tree Layout Algorithm
 *
 * Implements a Reingold-Tilford inspired tree layout for graph visualization.
 * Positions nodes in a hierarchical tree structure with proper spacing.
 *
 * Features:
 * - Root node selection (automatic or manual)
 * - Parent-child relationship detection
 * - Level-based horizontal positioning
 * - Vertical spacing for siblings
 * - Minimizes edge crossings
 *
 * @module layout/hierarchical-layout
 */

import type { LayoutEdge, LayoutNode } from "../types/graph";

/**
 * Layout configuration options
 */
export interface HierarchicalLayoutOptions {
	/** Distance between levels (horizontal) */
	levelSpacing?: number;
	/** Distance between nodes on same level (vertical) */
	nodeSpacing?: number;
	/** Root node ID (if null, selects node with no incoming edges) */
	rootNodeId?: string | null;
	/** Direction of tree growth */
	direction?: "horizontal" | "vertical";
}

/**
 * Positioned node with layout coordinates
 */
export interface HierarchicalPositionedNode<N> {
	node: N;
	x: number;
	y: number;
	level: number;
}

/**
 * Layout result with positioned nodes
 */
export interface HierarchicalLayoutResult<N> {
	/** Nodes with their positions */
	nodes: HierarchicalPositionedNode<N>[];
	/** Maximum depth of the tree */
	maxDepth: number;
	/** Root node ID used */
	rootNodeId: string;
}

/**
 * Default layout options
 */
const DEFAULT_OPTIONS: Required<HierarchicalLayoutOptions> = {
	levelSpacing: 150,
	nodeSpacing: 80,
	rootNodeId: null,
	direction: "horizontal",
} as const;

/**
 * Detect if an edge represents a parent-child relationship
 * For citation networks: reference (work cites another work)
 * For collaboration: authorship (author wrote work)
 * For affiliation: affiliation (author affiliated with institution)
 * @param edge
 */
const isParentChildEdge = (edge: LayoutEdge): boolean => {
	// Reference relationship: earlier works are "parents" of later works
	if (edge.type === "REFERENCE") {
		return true;
	}

	// Authorship relationship: work is child of author
	if (edge.type === "AUTHORSHIP") {
		return true;
	}

	// Affiliation relationship: author is child of institution
	if (edge.type === "AFFILIATION") {
		return true;
	}

	return false;
};

/**
 * Build adjacency lists for parent-child relationships
 * @param nodes
 * @param edges
 * @param rootNodeId
 */
const buildTreeStructure = (
	nodes: LayoutNode[],
	edges: LayoutEdge[],
	rootNodeId: string | null
): { rootNodeId: string; children: Map<string, string[]>; parents: Map<string, string> } => {
	const children = new Map<string, string[]>();
	const parents = new Map<string, string>();

	// Filter to parent-child edges only
	const parentChildEdges = edges.filter(isParentChildEdge);

	// Build adjacency
	for (const edge of parentChildEdges) {
		const { source, target } = edge;

		// Determine parent and child based on relationship type
		let parent: string;
		let child: string;

		if (edge.type === "AUTHORSHIP" || edge.type === "AFFILIATION") {
			// Target (work/author) is child of source (author/institution)
			parent = source;
			child = target;
		} else if (edge.type === "REFERENCE") {
			// Source references target, so target is parent (earlier work)
			parent = target;
			child = source;
		} else {
			continue;
		}

		// Record relationship
		if (!children.has(parent)) {
			children.set(parent, []);
		}
		const parentChildren = children.get(parent);
		if (parentChildren) {
			parentChildren.push(child);
		}
		parents.set(child, parent);
	}

	// Select root node if not provided
	let root = rootNodeId;
	if (root === null) {
		// Find node with no parent (root of tree)
		const nodeIds = new Set(nodes.map((n) => n.id));
		const childIds = new Set(parents.keys());
		const rootCandidates = [...nodeIds].filter((id) => !childIds.has(id));

		if (rootCandidates.length > 0) {
			root = rootCandidates[0];
		} else if (nodes.length > 0) {
			// All nodes have parents - pick first node
			root = nodes[0].id;
		} else {
			throw new Error("Cannot determine root node: no nodes available");
		}
	}

	return { rootNodeId: root, children, parents };
};

/**
 * Calculate subtree width for each node
 * @param nodeId
 * @param children
 * @param nodeSpacing
 */
const calculateSubtreeWidth = (
	nodeId: string,
	children: Map<string, string[]>,
	nodeSpacing: number
): number => {
	const nodeChildren = children.get(nodeId);
	if (!nodeChildren || nodeChildren.length === 0) {
		return nodeSpacing;
	}

	let totalWidth = 0;
	for (const childId of nodeChildren) {
		totalWidth += calculateSubtreeWidth(childId, children, nodeSpacing);
	}

	return totalWidth;
};

/**
 * Assign Y positions to children recursively
 * @param nodeId
 * @param children
 * @param nodeSpacing
 * @param startY
 */
const assignChildPositions = (
	nodeId: string,
	children: Map<string, string[]>,
	nodeSpacing: number,
	startY: number
): Map<string, number> => {
	const positions = new Map<string, number>();
	const nodeChildren = children.get(nodeId);

	if (!nodeChildren || nodeChildren.length === 0) {
		return positions;
	}

	let currentY = startY;

	for (const childId of nodeChildren) {
		positions.set(childId, currentY);

		// Recursively position grandchildren
		const childPositions = assignChildPositions(childId, children, nodeSpacing, currentY);
		for (const [id, y] of childPositions.entries()) {
			positions.set(id, y);
		}

		// Calculate subtree width to advance Y position
		const subtreeWidth = calculateSubtreeWidth(childId, children, nodeSpacing);
		currentY += subtreeWidth;
	}

	return positions;
};

/**
 * Apply hierarchical layout to graph
 * @param nodes Graph nodes
 * @param edges Graph edges
 * @param options Layout configuration
 * @returns Positioned nodes with layout coordinates
 */
export const hierarchicalLayout = (
	nodes: LayoutNode[],
	edges: LayoutEdge[],
	options: HierarchicalLayoutOptions = {}
): HierarchicalLayoutResult<LayoutNode> => {
	const options_ = { ...DEFAULT_OPTIONS, ...options };

	if (nodes.length === 0) {
		return { nodes: [], maxDepth: 0, rootNodeId: "" };
	}

	// Build tree structure
	const { rootNodeId, children } = buildTreeStructure(nodes, edges, options_.rootNodeId);

	// BFS to assign levels
	const levels = new Map<string, number>();
	const queue: { nodeId: string; level: number }[] = [{ nodeId: rootNodeId, level: 0 }];
	const visited = new Set<string>([rootNodeId]);
	let maxDepth = 0;

	while (queue.length > 0) {
		const shifted = queue.shift();
		if (!shifted) break;
		const { nodeId, level } = shifted;
		levels.set(nodeId, level);
		maxDepth = Math.max(maxDepth, level);

		const nodeChildren = children.get(nodeId) || [];
		for (const childId of nodeChildren) {
			if (!visited.has(childId)) {
				visited.add(childId);
				queue.push({ nodeId: childId, level: level + 1 });
			}
		}
	}

	// Calculate Y positions for all nodes
	const yPositions = assignChildPositions(rootNodeId, children, options_.nodeSpacing, 0);

	// Position root at center of its subtree
	const rootSubtreeWidth = calculateSubtreeWidth(rootNodeId, children, options_.nodeSpacing);
	yPositions.set(rootNodeId, rootSubtreeWidth / 2 - options_.nodeSpacing / 2);

	// Create positioned nodes
	const positionedNodes: HierarchicalPositionedNode<LayoutNode>[] = nodes.map((node) => {
		const level = levels.get(node.id) ?? 0;
		const y = yPositions.get(node.id) ?? 0;

		// Swap X/Y based on direction
		let x: number;
		let finalY: number;

		if (options_.direction === "horizontal") {
			x = level * options_.levelSpacing;
			finalY = y;
		} else {
			x = y;
			finalY = level * options_.levelSpacing;
		}

		return { node, x, y: finalY, level };
	});

	return {
		nodes: positionedNodes,
		maxDepth,
		rootNodeId,
	};
};

/**
 * Convert positioned nodes to a node position map for react-force-graph
 * @param layoutResult
 */
export const toNodePositionMap = <N extends LayoutNode>(
	layoutResult: HierarchicalLayoutResult<N>
): Map<string, { x: number; y: number }> => {
	const positionMap = new Map<string, { x: number; y: number }>();

	layoutResult.nodes.forEach(({ node, x, y }: HierarchicalPositionedNode<N>) => {
		positionMap.set(node.id, { x, y });
	});

	return positionMap;
};
