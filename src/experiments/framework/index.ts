/**
 * Portable Programmatic Evaluation Framework
 *
 * A claim-driven, deterministic evaluation framework for GraphBox experiments.
 *
 * ## Architecture
 *
 * The framework follows the Execute → Aggregate → Render pipeline:
 *
 * 1. **Execute**: Run SUTs against cases, producing EvaluationResult objects
 * 2. **Aggregate**: Summarize results into AggregatedResult objects
 * 3. **Evaluate Claims**: Test explicit hypotheses against aggregates
 * 4. **Render**: Transform aggregates into LaTeX tables
 *
 * ## Key Principles
 *
 * 1. **Single Source of Truth**: Canonical schemas for all data types
 * 2. **Explicit Comparison Semantics**: SUT roles (primary, baseline, oracle)
 * 3. **Claim-Driven Evaluation**: Experiments test explicit hypotheses
 * 4. **Determinism and Reproducibility**: Deterministic run IDs
 * 5. **Separation of Concerns**: No aggregation in renderers
 * 6. **Portability**: Pure TypeScript, no external dependencies
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   expansionSutRegistry,
 *   graphCaseRegistry,
 *   Executor,
 *   aggregateResults,
 *   evaluateClaims,
 *   THESIS_CLAIMS,
 *   LaTeXRenderer,
 *   TABLE_SPECS,
 * } from './experiments/framework';
 *
 * // Execute experiments
 * const executor = new Executor({ repetitions: 10 });
 * const suts = expansionSutRegistry.listRegistrations();
 * const cases = graphCaseRegistry.listCases();
 * const { results } = await executor.execute(suts, cases, extractMetrics);
 *
 * // Aggregate
 * const aggregates = aggregateResults(results);
 *
 * // Evaluate claims
 * const claimEvals = evaluateClaims(THESIS_CLAIMS, aggregates);
 *
 * // Render
 * const renderer = new LaTeXRenderer();
 * const tables = renderer.renderAll(aggregates, TABLE_SPECS);
 * ```
 */

// Types
export * from "./types/index.js";

// Registry
export * from "./registry/index.js";

// Executor
export * from "./executor/index.js";

// Collector
export * from "./collector/index.js";

// Metrics
export * from "./metrics/index.js";

// Aggregation
export * from "./aggregation/index.js";

// Claims
export * from "./claims/index.js";

// Robustness
export * from "./robustness/index.js";

// Renderers
export * from "./renderers/index.js";
