import type { GraphSpec } from "../spec";
import {
	generateConnectedCyclicEdges,
	generateDisconnectedEdges,
	generateForestEdges,
} from "./connectivity";
import { generateTreeEdges } from "./core-structures";
import type { TestEdge, TestNode } from "./types";
import { SeededRandom } from "./types";

/**
 * Generate standard edges based on connectivity and cycle properties.
 * This is a common pattern used by many graph property handlers.
 * @param nodes
 * @param edges
 * @param spec
 * @param rng
 */
const generateStandardEdges = (
	nodes: TestNode[],
	edges: TestEdge[],
	spec: GraphSpec,
	rng: SeededRandom
): void => {
	if (spec.connectivity.kind === "connected" && spec.cycles.kind === "acyclic") {
		generateTreeEdges(nodes, edges, spec, rng);
	} else if (spec.connectivity.kind === "connected" && spec.cycles.kind === "cycles_allowed") {
		generateConnectedCyclicEdges(nodes, edges, spec, rng);
	} else if (spec.connectivity.kind === "unconstrained" && spec.cycles.kind === "acyclic") {
		generateForestEdges(nodes, edges, spec, rng);
	} else {
		generateDisconnectedEdges(nodes, edges, spec, rng);
	}
};

/**
 * Create a property handler that generates standard edges then computes and stores metadata.
 * This factory reduces code duplication for spectral, robustness, extremal, and product properties.
 * @param computeFn
 * @param computeFunction
 */
const createPropertyHandler = (
	computeFunction: (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom) => void
) => {
	return (nodes: TestNode[], edges: TestEdge[], spec: GraphSpec, rng: SeededRandom): TestEdge[] => {
		generateStandardEdges(nodes, edges, spec, rng);
		computeFunction(nodes, edges, spec, rng);
		return edges;
	};
};

// Import compute functions from property-computers
import {
	computeAndStoreAlgebraicConnectivity,
	computeAndStoreCage,
	computeAndStoreCartesianProduct,
	computeAndStoreIntegrity,
	computeAndStoreLexicographicProduct,
	computeAndStoreMinorFree,
	computeAndStoreMooreGraph,
	computeAndStoreRamanujan,
	computeAndStoreSpectralRadius,
	computeAndStoreSpectrum,
	computeAndStoreStrongProduct,
	computeAndStoreTensorProduct,
	computeAndStoreTopologicalMinorFree,
	computeAndStoreToughness,
} from "./property-computers";

// ============================================================================
// SPECTRAL PROPERTY HANDLERS
// ============================================================================

export const handleSpectrum = createPropertyHandler(computeAndStoreSpectrum);
export const handleAlgebraicConnectivity = createPropertyHandler(computeAndStoreAlgebraicConnectivity);
export const handleSpectralRadius = createPropertyHandler(computeAndStoreSpectralRadius);

// ============================================================================
// ROBUSTNESS MEASURE HANDLERS
// ============================================================================

export const handleToughness = createPropertyHandler(computeAndStoreToughness);
export const handleIntegrity = createPropertyHandler(computeAndStoreIntegrity);

// ============================================================================
// EXTREMAL GRAPH HANDLERS
// ============================================================================

export const handleCage = createPropertyHandler(computeAndStoreCage);
export const handleMoore = createPropertyHandler(computeAndStoreMooreGraph);
export const handleRamanujan = createPropertyHandler(computeAndStoreRamanujan);

// ============================================================================
// GRAPH PRODUCT HANDLERS
// ============================================================================

export const handleCartesianProduct = createPropertyHandler(computeAndStoreCartesianProduct);
export const handleTensorProduct = createPropertyHandler(computeAndStoreTensorProduct);
export const handleStrongProduct = createPropertyHandler(computeAndStoreStrongProduct);
export const handleLexicographicProduct = createPropertyHandler(computeAndStoreLexicographicProduct);

// ============================================================================
// MINOR-FREE GRAPH HANDLERS
// ============================================================================

export const handleMinorFree = createPropertyHandler(computeAndStoreMinorFree);
export const handleTopologicalMinorFree = createPropertyHandler(computeAndStoreTopologicalMinorFree);
