/**
 * Graph validation module
 *
 * Provides validators for various graph properties.
 * All validators return PropertyValidationResult objects.
 */

// Export types
export type { GraphValidationResult,PropertyValidationResult } from "./types";

// Note: Helper functions (buildAdjacencyList, findComponentsForDensity, checkBipartiteWithBFS)
// are not re-exported - import directly from './helper-functions' if needed

// Export basic validators
export {
	validateConnectivity,
	validateCycles,
	validateDirectionality,
	validateEdgeMultiplicity,
	validateSchema,
	validateSelfLoops,
	validateWeighting} from "./basic-validators";

// Export structural validators
export {
	validateCage,
	validateMooreGraph,
	validateRamanujan
} from "./extremal";
export {
	validatePlanar,
	validateUnitDisk} from "./geometric";
export {
	validateDominationNumber,
	validateHereditaryClass,
	validateIndependenceNumber,
	validateVertexCover} from "./invariant";
export {
	validateMinorFree,
	validateTopologicalMinorFree
} from "./minor";
export {
	validateModular,
	validateScaleFree,
	validateSmallWorld} from "./network";
export {
	validateCircumference,
	validateDiameter,
	validateGirth,
	validateHamiltonian,
	validateRadius,
	validateTraceable} from "./path-cycle";
export {
	validateCartesianProduct,
	validateLexicographicProduct,
	validateStrongProduct,
	validateTensorProduct} from "./product";
export {
	validateIntegrity,
	validateToughness} from "./robustness";
export {
	validateAlgebraicConnectivity,
	validateSpectralRadius,
	validateSpectrum} from "./spectral";
export {
	validateBipartite,
	validateDensityAndCompleteness,
	validateTournament
} from "./structural";
export {
	validateChordal,
	validateClawFree,
	validateCograph,
	validateComparability,
	validateInterval,
	validatePerfect,
	validatePermutation,
	validateSplit} from "./structural-class";
export {
	validateArcTransitive,
	validateEdgeTransitive,
	validateLine,
	validateSelfComplementary,
	validateStronglyRegular,
	validateThreshold,
	validateVertexTransitive} from "./symmetry";

// Export degree validators
export {
	validateEulerian,
	validateRegularGraph} from "./degree-validators";

// Export connectivity validators
export {
	validateKEdgeConnected,
	validateKVertexConnected} from "./connectivity-validators";

// Export treewidth validator
export {
	findMaxCliqueSize,
	validateTreewidth} from "./treewidth-validator";

// Export coloring validator
export {
	greedyColoring,
	validateKColorable} from "./coloring-validator";

// Export flow validator
export { validateFlowNetwork } from "./flow-validator";

// ============================================================================
// NEW GRAPH CLASS VALIDATORS (Priority 1 - 22 classes)
// ============================================================================

// Forbidden subgraph validators
export {
	validateATFree,
	validateBullFree,
	validateC5Free,
	validateDistanceHereditary,
	validateGemFree,
	validateHHFree,
	validateP5Free,
} from "./forbidden_subgraph";

// Intersection graph validators
export {
	validateCircularArc,
	validateProperCircularArc,
} from "./intersection";

// Probe graph validators
export {
	validateProbeChordal,
	validateProbeInterval,
} from "./probe";

// Perfect variant validators
export {
	validateModular as validateModularClass,
	validatePtolemaic,
	validateQuasiLine,
} from "./perfect_variants";
