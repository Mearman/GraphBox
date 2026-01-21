/**
 * Claims Module
 *
 * Re-exports claim evaluation and registry.
 */

export {
	createClaimSummary,
	evaluateClaim,
	evaluateClaims,
} from "./evaluator.js";
export {
	getClaim,
	getClaimsByBaseline,
	getClaimsBySut,
	getClaimsByTag,
	getCoreClaims,
	THESIS_CLAIMS,
} from "./registry.js";
