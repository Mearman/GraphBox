/**
 * Graph Specification System
 *
 * Atomic graph-type properties using discriminated unions for type-safe composition.
 * Each property is a disjoint union with a `kind` discriminator for exhaustiveness checking.
 *
 * This module re-exports all property types for convenient importing.
 */

// Test types
export type { TestEdge, TestGraph,TestNode } from "./test";

// Core properties
export type {
	Completeness,
	Connectivity,
	Cycles,
	Density,
	Directionality,
	EdgeMultiplicity,
	SchemaHomogeneity,
	SelfLoops,
	Weighting,
} from "./core.js";

// Advanced properties
export type {
	DegreeConstraint,
	EdgeArity,
	EdgeData,
	EdgeOrdering,
	Embedding,
	Layering,
	MeasureSemantics,
	Observability,
	OperationalSemantics,
	Partiteness,
	Ports,
	Rooting,
	Signedness,
	Temporal,
	Uncertainty,
	VertexCardinality,
	VertexData,
	VertexIdentity,
	VertexOrdering,
} from "./advanced.js";

// Network analysis properties
export type {
	CommunityStructure,
	ScaleFree,
	SmallWorld,
} from "./network.js";

// Geometric properties
export type {
	Planarity,
	UnitDisk,
} from "./geometric.js";

// Path and cycle properties
export type {
	Hamiltonian,
	Traceable,
} from "./path-cycle.js";

// Structural classes
export type {
	ClawFree,
	Cograph,
	Line,
	Perfect,
	Split,
	Threshold,
} from "./structural.js";

// Regularity properties
export type {
	Cubic,
	SpecificRegular,
	StronglyRegular,
} from "./regularity.js";

// Symmetry properties
export type {
	ArcTransitive,
	EdgeTransitive,
	SelfComplementary,
	VertexTransitive,
} from "./symmetry.js";

// Metric properties
export type {
	Circumference,
	Diameter,
	Girth,
	Radius,
} from "./metrics.js";

// Invariants and spectral properties
export type {
	AlgebraicConnectivity,
	DominationNumber,
	HereditaryClass,
	IndependenceNumber,
	SpectralRadius,
	Spectrum,
	VertexCover,
} from "./invariants.js";

// Graph products and related structures
export type {
	BinaryTree,
	Branchwidth,
	Cage,
	CartesianProduct,
	Chordal,
	ChromaticNumber,
	Comparability,
	CompleteBipartite,
	Eulerian,
	FlowNetwork,
	Grid,
	Integrity,
	Interval,
	KColorable,
	KEdgeConnected,
	KVertexConnected,
	LexicographicProduct,
	MinorFree,
	MooreGraph,
	PerfectMatching,
	Permutation,
	Ramanujan,
	SpanningTree,
	Star,
	StrongProduct,
	TensorProduct,
	TopologicalMinorFree,
	Toroidal,
	Toughness,
	Tournament,
	Treewidth,
	Wheel,
} from "./products.js";
