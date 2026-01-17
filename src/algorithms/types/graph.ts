/**
 * Core graph algorithm types.
 */

/**
 * Base node interface - minimum requirements.
 * All node types must extend this with an id field.
 */
export interface NodeBase {
	id: string;
}

/**
 * Base edge interface - minimum requirements.
 * All edge types must extend this with source and target fields.
 */
export interface EdgeBase {
	source: string;
	target: string;
}

/**
 * Base Node interface with required discriminator field.
 * All node types must extend this interface.
 *
 * id - Unique node identifier (must be unique within graph)
 * type - Discriminator field for runtime type narrowing
 *
 * @example
 * ```typescript
 * type WorkNode = {
 *   id: string;
 *   type: 'work';
 *   title: string;
 *   year: number;
 * };
 *
 * type AuthorNode = {
 *   id: string;
 *   type: 'author';
 *   name: string;
 * };
 *
 * type AcademicNode = WorkNode | AuthorNode;
 *
 * const processNode = (node: AcademicNode) => {
 *   if (node.type === 'work') {
 *     console.log(node.title); // TypeScript knows it's WorkNode
 *   } else {
 *     console.log(node.name); // TypeScript knows it's AuthorNode
 *   }
 * };
 * ```
 */
export interface Node extends NodeBase {
	type: string;
	[key: string]: unknown;
}

/**
 * Base Edge interface with required fields for graph connectivity.
 * All edge types must extend this interface.
 *
 * id - Unique edge identifier
 * source - ID of source node (must exist in graph)
 * target - ID of target node (must exist in graph)
 * type - Discriminator field for runtime type narrowing
 * weight - Optional edge weight (default: 1 if not specified)
 *
 * @example
 * ```typescript
 * type CitationEdge = {
 *   id: string;
 *   source: string;
 *   target: string;
 *   type: 'citation';
 *   year: number;
 * };
 *
 * type AuthorshipEdge = {
 *   id: string;
 *   source: string;
 *   target: string;
 *   type: 'authorship';
 *   position: number;
 * };
 *
 * type AcademicEdge = CitationEdge | AuthorshipEdge;
 * ```
 */
export interface Edge extends EdgeBase {
	id: string;
	type: string;
	weight?: number;
	[key: string]: unknown;
}

/**
 * Generic node interface for graph layout algorithms.
 *
 * Used by layout algorithms that position nodes in 2D space.
 *
 * @template T - Additional properties for the node
 */
export interface LayoutNode {
	/** Unique identifier for the node */
	id: string;
	/** X coordinate for graph positioning */
	x: number;
	/** Y coordinate for graph positioning */
	y: number;
	/** Additional node properties */
	[key: string]: unknown;
}

/**
 * Generic edge interface for graph layout algorithms.
 *
 * Used by layout algorithms for edge routing and positioning.
 *
 * @template T - Additional properties for the edge
 */
export interface LayoutEdge {
	/** Source node ID */
	source: string;
	/** Target node ID */
	target: string;
	/** Edge type/label */
	type?: string;
	/** Edge weight for weighted algorithms */
	weight?: number;
	/** Additional edge properties */
	[key: string]: unknown;
}

/**
 * Positioned node with layout coordinates.
 *
 * Used in hierarchical and force-directed layouts.
 */
export interface PositionedNode<N> {
	/** Node data */
	node: N;
	/** X coordinate */
	x: number;
	/** Y coordinate */
	y: number;
	/** Level in hierarchy (for tree layouts) */
	level?: number;
}


