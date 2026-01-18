/**
 * Graph Spec Analyzer - Main API
 *
 * Main exports for the analyzer module including InferredGraphSpec type
 * and computeGraphSpecFromGraph function.
 */

import {
	computeEdgeOrdering,
	computeEmbedding,
	computeLayering,
	computeMeasureSemantics,
	computeObservability,
	computeOperationalSemantics,
	computePorts,
	computeRooting,
	computeTemporal} from "./advanced-props";
import {
	computeAutoRegular,
	computeClawFree,
	computeCograph,
	computeCompleteBipartite,
	computeCubic,
	computeLine,
	computePerfect,
	computeSelfComplementary,
	computeSplit,
	computeStronglyRegular,
	computeThreshold,
	computeVertexTransitive} from "./advanced-structures";
import {
	computeConnectivity,
	computeCycles,
	computeDegreeConstraint
} from "./connectivity";
// Import all compute functions from their modules
import {
	computeDirectionality,
	computeEdgeArity,
	computeEdgeData,
	computeEdgeMultiplicity,
	computeSchemaHomogeneity,
	computeSelfLoops,
	computeSignedness,
	computeUncertainty,
	computeVertexCardinality,
	computeVertexData,
	computeVertexIdentity,
	computeVertexOrdering,
	computeWeighting} from "./core-props";
import {
	computeATFree,
	computeBullFree,
	computeC5Free,
	computeDistanceHereditary,
	computeGemFree,
	computeHHFree,
	computeP5Free,
} from "./forbidden_subgraph";
import {
	computePlanar
} from "./geometric";
import {
	computeCircularArc,
	computeProperCircularArc
} from "./intersection";
import {
	computeHamiltonian,
	computeTraceable
} from "./path-props";
import {
	computeModular,
	computePtolemaic,
	computeQuasiLine,
} from "./perfect_variants";
import {
	computeProbeChordal,
	computeProbeInterval
} from "./probe";
import {
	computeCommunityStructure,
	computeScaleFree,
	computeSmallWorld} from "./spectral";
import {
	computeWeaklyChordal,
} from "./structural";
import {
	computeCompleteness,
	computeDensity,
	computePartiteness} from "./structure";
import type {
	AnalyzerGraph,
	ComputePolicy} from "./types";
import {
	defaultComputePolicy
} from "./types";

// Re-export all functions

// ============================================================================
// Type-safe GraphSpec (inferred from graph structure)
// ============================================================================

export type InferredGraphSpec = Readonly<{
	vertexCardinality: ReturnType<typeof computeVertexCardinality>;
	vertexIdentity: ReturnType<typeof computeVertexIdentity>;
	vertexOrdering: ReturnType<typeof computeVertexOrdering>;

	edgeArity: ReturnType<typeof computeEdgeArity>;
	edgeMultiplicity: ReturnType<typeof computeEdgeMultiplicity>;
	selfLoops: ReturnType<typeof computeSelfLoops>;

	directionality: ReturnType<typeof computeDirectionality>;

	weighting: ReturnType<typeof computeWeighting>;
	signedness: ReturnType<typeof computeSignedness>;
	uncertainty: ReturnType<typeof computeUncertainty>;

	vertexData: ReturnType<typeof computeVertexData>;
	edgeData: ReturnType<typeof computeEdgeData>;
	schema: ReturnType<typeof computeSchemaHomogeneity>;

	connectivity: ReturnType<typeof computeConnectivity>;
	cycles: ReturnType<typeof computeCycles>;
	degreeConstraint: ReturnType<typeof computeDegreeConstraint>;
	completeness: ReturnType<typeof computeCompleteness>;
	partiteness: ReturnType<typeof computePartiteness>;
	density: ReturnType<typeof computeDensity>;

	embedding: ReturnType<typeof computeEmbedding>;
	rooting: ReturnType<typeof computeRooting>;
	temporal: ReturnType<typeof computeTemporal>;
	layering: ReturnType<typeof computeLayering>;
	edgeOrdering: ReturnType<typeof computeEdgeOrdering>;
	ports: ReturnType<typeof computePorts>;

	observability: ReturnType<typeof computeObservability>;
	operationalSemantics: ReturnType<typeof computeOperationalSemantics>;
	measureSemantics: ReturnType<typeof computeMeasureSemantics>;

	// Network analysis properties
	scaleFree: ReturnType<typeof computeScaleFree>;
	smallWorld: ReturnType<typeof computeSmallWorld>;
	communityStructure: ReturnType<typeof computeCommunityStructure>;

	// Path and cycle properties
	hamiltonian: ReturnType<typeof computeHamiltonian>;
	traceable: ReturnType<typeof computeTraceable>;

	// Structural properties
	perfect: ReturnType<typeof computePerfect>;
	split: ReturnType<typeof computeSplit>;
	cograph: ReturnType<typeof computeCograph>;
	threshold: ReturnType<typeof computeThreshold>;
	line: ReturnType<typeof computeLine>;
	clawFree: ReturnType<typeof computeClawFree>;

	// Priority 1: Perfect graph variants
	modular: ReturnType<typeof computeModular>;
	ptolemaic: ReturnType<typeof computePtolemaic>;
	quasiLine: ReturnType<typeof computeQuasiLine>;

	// Priority 1: Forbidden subgraph classes
	p5Free: ReturnType<typeof computeP5Free>;
	c5Free: ReturnType<typeof computeC5Free>;
	bullFree: ReturnType<typeof computeBullFree>;
	gemFree: ReturnType<typeof computeGemFree>;
	atFree: ReturnType<typeof computeATFree>;
	hhFree: ReturnType<typeof computeHHFree>;
	distanceHereditary: ReturnType<typeof computeDistanceHereditary>;
	weaklyChordal: ReturnType<typeof computeWeaklyChordal>;

	// Priority 1: Intersection graphs
	circularArc: ReturnType<typeof computeCircularArc>;
	properCircularArc: ReturnType<typeof computeProperCircularArc>;

	// Priority 1: Probe graphs
	probeChordal: ReturnType<typeof computeProbeChordal>;
	probeInterval: ReturnType<typeof computeProbeInterval>;

	// Priority 1: Geometric
	planarNew: ReturnType<typeof computePlanar>;

	// Regularity properties
	cubic: ReturnType<typeof computeCubic>;
	specificRegular: ReturnType<typeof computeAutoRegular>;
	stronglyRegular: ReturnType<typeof computeStronglyRegular>;

	// Symmetry properties
	selfComplementary: ReturnType<typeof computeSelfComplementary>;
	vertexTransitive: ReturnType<typeof computeVertexTransitive>;

	// Special bipartite properties
	completeBipartite: ReturnType<typeof computeCompleteBipartite>;
}>;

// ============================================================================
// Main API: Compute full GraphSpec from graph
// ============================================================================

export const computeGraphSpecFromGraph = (g: AnalyzerGraph, policy: Partial<ComputePolicy> = {}): InferredGraphSpec => {
	const p: ComputePolicy = { ...defaultComputePolicy, ...policy };

	return {
		vertexCardinality: computeVertexCardinality(g),
		vertexIdentity: computeVertexIdentity(g),
		vertexOrdering: computeVertexOrdering(g, p),

		edgeArity: computeEdgeArity(g),
		edgeMultiplicity: computeEdgeMultiplicity(g),
		selfLoops: computeSelfLoops(g),

		directionality: computeDirectionality(g),

		weighting: computeWeighting(g, p),
		signedness: computeSignedness(g),
		uncertainty: computeUncertainty(g, p),

		vertexData: computeVertexData(g),
		edgeData: computeEdgeData(g),
		schema: computeSchemaHomogeneity(g),

		connectivity: computeConnectivity(g),
		cycles: computeCycles(g),
		degreeConstraint: computeDegreeConstraint(g),
		completeness: computeCompleteness(g),
		partiteness: computePartiteness(g),
		density: computeDensity(g),

		embedding: computeEmbedding(g, p),
		rooting: computeRooting(g, p),
		temporal: computeTemporal(g, p),
		layering: computeLayering(g, p),
		edgeOrdering: computeEdgeOrdering(g, p),
		ports: computePorts(g, p),

		observability: computeObservability(g),
		operationalSemantics: computeOperationalSemantics(g),
		measureSemantics: computeMeasureSemantics(g),

		// Network analysis properties
		scaleFree: computeScaleFree(g),
		smallWorld: computeSmallWorld(g),
		communityStructure: computeCommunityStructure(g, p),

		// Path and cycle properties
		hamiltonian: computeHamiltonian(g),
		traceable: computeTraceable(g),

		// Structural properties
		perfect: computePerfect(g),
		split: computeSplit(g),
		cograph: computeCograph(g),
		threshold: computeThreshold(g),
		line: computeLine(g),
		clawFree: computeClawFree(g),

		// Regularity properties
		cubic: computeCubic(g),
		specificRegular: computeAutoRegular(g),
		stronglyRegular: computeStronglyRegular(g),

		// Symmetry properties
		selfComplementary: computeSelfComplementary(g),
		vertexTransitive: computeVertexTransitive(g),

		// Special bipartite properties
		completeBipartite: computeCompleteBipartite(g),

		// Priority 1: Perfect graph variants
		modular: computeModular(g, p),
		ptolemaic: computePtolemaic(g, p),
		quasiLine: computeQuasiLine(g, p),

		// Priority 1: Forbidden subgraph classes
		p5Free: computeP5Free(g, p),
		c5Free: computeC5Free(g, p),
		bullFree: computeBullFree(g, p),
		gemFree: computeGemFree(g, p),
		atFree: computeATFree(g, p),
		hhFree: computeHHFree(g, p),
		distanceHereditary: computeDistanceHereditary(g, p),
		weaklyChordal: computeWeaklyChordal(g, p),

		// Priority 1: Intersection graphs
		circularArc: computeCircularArc(g, p),
		properCircularArc: computeProperCircularArc(g, p),

		// Priority 1: Probe graphs
		probeChordal: computeProbeChordal(g, p),
		probeInterval: computeProbeInterval(g, p),

		// Priority 1: Geometric
		planarNew: computePlanar(g, p),
	};

}
