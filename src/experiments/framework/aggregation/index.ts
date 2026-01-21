/**
 * Aggregation Module
 *
 * Re-exports aggregation functions and pipeline.
 */

export {
	computeComparison,
	computeMaxSpeedup,
	computeRankings,
	computeSpeedup,
	computeSummaryStats,
	getMethodAbbreviation,
	getVariantDisplayName,
	METHOD_ABBREVIATIONS,
	VARIANT_DISPLAY_NAMES,
} from "./aggregators.js";
export {
	aggregateResults,
	type AggregationPipelineOptions,
	createAggregationOutput,
} from "./pipeline.js";
