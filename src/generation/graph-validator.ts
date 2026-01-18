import {
	type GraphValidationResult,
	type PropertyValidationResult,
	validateAlgebraicConnectivity,
	validateArcTransitive,
	validateATFree,
	validateBipartite,
	validateBullFree,
	validateC5Free,
	validateCage,
	validateCartesianProduct,
	validateChordal,
	validateCircularArc,
	validateCircumference,
	validateClawFree,
	validateCograph,
	validateComparability,
	validateConnectivity,
	validateCycles,
	validateDensityAndCompleteness,
	validateDiameter,
	validateDirectionality,
	validateDistanceHereditary,
	validateDominationNumber,
	validateEdgeMultiplicity,
	validateEdgeTransitive,
	validateEulerian,
	validateFlowNetwork,
	validateGemFree,
	validateGirth,
	validateHamiltonian,
	validateHereditaryClass,
	validateHHFree,
	validateIndependenceNumber,
	validateIntegrity,
	validateInterval,
	validateKColorable,
	validateKEdgeConnected,
	validateKVertexConnected,
	validateLexicographicProduct,
	validateLine,
	validateMinorFree,
	validateModular,
	validateModular as validateModularClass,
	validateMooreGraph,
	// New graph class validators (Priority 1)
	validateP5Free,
	validatePerfect,
	validatePermutation,
	validatePlanar,
	validateProbeChordal,
	validateProbeInterval,
	validateProperCircularArc,
	validatePtolemaic,
	validateQuasiLine,
	validateRadius,
	validateRamanujan,
	validateRegularGraph,
	validateScaleFree,
	validateSchema,
	validateSelfComplementary,
	validateSelfLoops,
	validateSmallWorld,
	validateSpectralRadius,
	validateSpectrum,
	validateSplit,
	validateStronglyRegular,
	validateStrongProduct,
	validateTensorProduct,
	validateThreshold,
	validateTopologicalMinorFree,
	validateToughness,
	validateTournament,
	validateTraceable,
	validateTreewidth,
	validateUnitDisk,
	validateVertexCover,
	validateVertexTransitive,
	validateWeighting,
} from "../validation";
import { analyzeGraphSpecConstraints, getAdjustedValidationExpectations } from "./constraints";
import type { TestGraph } from "./generator";

/**
 * Validate that a generated graph actually has its claimed properties.
 * @param graph
 */
export const validateGraphProperties = (graph: TestGraph): GraphValidationResult => {
	const results: PropertyValidationResult[] = [];
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check for impossible or problematic combinations
	const impossibilities = analyzeGraphSpecConstraints(graph.spec);
	const adjustments = getAdjustedValidationExpectations(graph.spec);

	for (const imp of impossibilities) {
		// Only track warnings, not errors - impossible combinations are filtered out before testing
		if (imp.severity === "warning") {
			warnings.push(`Problematic combination: ${imp.property} - ${imp.reason}`);
		}
	}

	// Validate each core property
	results.push(validateDirectionality(graph));
	results.push(validateWeighting(graph));
	results.push(validateCycles(graph, adjustments));
	results.push(validateConnectivity(graph));
	results.push(validateSchema(graph));
	results.push(validateEdgeMultiplicity(graph));
	results.push(validateSelfLoops(graph));
	results.push(validateDensityAndCompleteness(graph, adjustments));
	results.push(validateBipartite(graph));
	results.push(validateTournament(graph));
	results.push(validateSplit(graph));
	results.push(validateCograph(graph));
	results.push(validateClawFree(graph));
	results.push(validateChordal(graph));
	results.push(validateInterval(graph));
	results.push(validatePermutation(graph));
	results.push(validateComparability(graph));
	results.push(validatePerfect(graph));
	results.push(validateScaleFree(graph));
	results.push(validateSmallWorld(graph));
	results.push(validateModular(graph));
	results.push(validateLine(graph));
	results.push(validateSelfComplementary(graph));
	results.push(validateThreshold(graph));
	results.push(validateUnitDisk(graph));
	results.push(validatePlanar(graph));

	// Validate new graph classes (Priority 1)
	// Only validate if the property is specified in the spec
	if (graph.spec.p5Free?.kind && graph.spec.p5Free.kind !== "unconstrained") {
		results.push(validateP5Free(graph));
	}
	if (graph.spec.c5Free?.kind && graph.spec.c5Free.kind !== "unconstrained") {
		results.push(validateC5Free(graph));
	}
	if (graph.spec.bullFree?.kind && graph.spec.bullFree.kind !== "unconstrained") {
		results.push(validateBullFree(graph));
	}
	if (graph.spec.gemFree?.kind && graph.spec.gemFree.kind !== "unconstrained") {
		results.push(validateGemFree(graph));
	}
	if (graph.spec.atFree?.kind && graph.spec.atFree.kind !== "unconstrained") {
		results.push(validateATFree(graph));
	}
	if (graph.spec.hhFree?.kind && graph.spec.hhFree.kind !== "unconstrained") {
		results.push(validateHHFree(graph));
	}
	if (graph.spec.distanceHereditary?.kind && graph.spec.distanceHereditary.kind !== "unconstrained") {
		results.push(validateDistanceHereditary(graph));
	}
	if (graph.spec.circularArc?.kind && graph.spec.circularArc.kind !== "unconstrained") {
		results.push(validateCircularArc(graph));
	}
	if (graph.spec.properCircularArc?.kind && graph.spec.properCircularArc.kind !== "unconstrained") {
		results.push(validateProperCircularArc(graph));
	}
	if (graph.spec.probeChordal?.kind && graph.spec.probeChordal.kind !== "unconstrained") {
		results.push(validateProbeChordal(graph));
	}
	if (graph.spec.probeInterval?.kind && graph.spec.probeInterval.kind !== "unconstrained") {
		results.push(validateProbeInterval(graph));
	}
	if (graph.spec.modular?.kind && graph.spec.modular.kind !== "unconstrained") {
		results.push(validateModularClass(graph));
	}
	if (graph.spec.ptolemaic?.kind && graph.spec.ptolemaic.kind !== "unconstrained") {
		results.push(validatePtolemaic(graph));
	}
	if (graph.spec.quasiLine?.kind && graph.spec.quasiLine.kind !== "unconstrained") {
		results.push(validateQuasiLine(graph));
	}

	results.push(validateHamiltonian(graph));
	results.push(validateTraceable(graph));
	results.push(validateStronglyRegular(graph));
	results.push(validateVertexTransitive(graph));
	results.push(validateEdgeTransitive(graph));
	results.push(validateArcTransitive(graph));
	results.push(validateDiameter(graph));
	results.push(validateRadius(graph));
	results.push(validateGirth(graph));
	results.push(validateCircumference(graph));
	results.push(validateHereditaryClass(graph));
	results.push(validateIndependenceNumber(graph));
	results.push(validateVertexCover(graph));
	results.push(validateDominationNumber(graph));
	results.push(validateSpectrum(graph));
	results.push(validateAlgebraicConnectivity(graph));
	results.push(validateSpectralRadius(graph));
	results.push(validateToughness(graph));
	results.push(validateIntegrity(graph));
	results.push(validateCage(graph));
	results.push(validateMooreGraph(graph));
	results.push(validateRamanujan(graph));
	results.push(validateCartesianProduct(graph));
	results.push(validateTensorProduct(graph));
	results.push(validateStrongProduct(graph));
	results.push(validateLexicographicProduct(graph));
	results.push(validateMinorFree(graph));
	results.push(validateTopologicalMinorFree(graph));
	results.push(validateRegularGraph(graph));
	results.push(validateEulerian(graph));
	results.push(validateKVertexConnected(graph));
	results.push(validateKEdgeConnected(graph));
	results.push(validateTreewidth(graph));
	results.push(validateKColorable(graph));
	results.push(validateFlowNetwork(graph));

	// Collect errors
	for (const result of results) {
		if (!result.valid) {
			errors.push(result.message ?? `Property ${result.property} validation failed`);
		}
	}

	return {
		properties: results,
		valid: errors.length === 0,
		errors,
		warnings: warnings.length > 0 ? warnings : undefined,
	};
};

// Re-export types for backward compatibility

