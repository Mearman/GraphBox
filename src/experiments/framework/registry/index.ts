/**
 * Registry Module
 *
 * Re-exports all registry classes and registration functions.
 */

// SUT Registry
export { SUTRegistry, sutRegistry } from "./sut-registry.js";

// Case Registry
export { CaseRegistry, caseRegistry } from "./case-registry.js";

// SUT Registration
export {
	type ExpansionSutRegistry,
	expansionSutRegistry,
	registerExpansionSuts,
	SUT_REGISTRATIONS,
} from "./register-suts.js";

// Case Registration
export {
	BENCHMARK_CASES,
	createSyntheticCaseDefinition,
	getBenchmarkSeeds,
	getNSeeds,
	type GraphCaseRegistry,
	graphCaseRegistry,
	registerCases,
	type SyntheticGraphType,
} from "./register-cases.js";
