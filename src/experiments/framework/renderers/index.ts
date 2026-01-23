/**
 * Renderers Module
 *
 * Re-exports rendering components.
 */

export {
	createLatexRenderer,
	escapeLatex,
	LaTeXRenderer,
	type LaTeXRendererOptions,
} from "./latex-renderer.js";
export {
	getTableSpec,
	HUB_AVOIDANCE_SPEC,
	HUB_TRAVERSAL_SPEC,
	METHOD_RANKING_SPEC,
	MI_RANKING_QUALITY_SPEC,
	N_SEED_COMPARISON_SPEC,
	N_SEED_GENERALIZATION_SPEC,
	PATH_LENGTHS_SPEC,
	RANKING_COMPARISON_SPEC,
	RANKING_SIGNIFICANCE_SPEC,
	RUNTIME_PERFORMANCE_SPEC,
	STATISTICAL_SIGNIFICANCE_SPEC,
	TABLE_SPECS,
} from "./table-specs.js";
export {
	type ClaimStatusDisplay,
	type ColumnSpec,
	LATEX_CLAIM_STATUS,
	type Renderer,
	type RenderOutput,
	type TableRenderSpec,
	UNICODE_CLAIM_STATUS,
} from "./types.js";
