/**
 * Overlap-Based Expansion Algorithm Family
 *
 * A modular implementation of overlap-based termination for N-seed graph traversal.
 * This system enables efficient sampling of the "between-graph" (region connecting N seeds)
 * while preserving sufficient structure for Path Salience ranking.
 *
 * ## Architecture
 *
 * The system uses a strategy pattern with 4 independent dimensions:
 *
 * 1. **Overlap Detection** (3 variants): How to detect when seeds' regions meet
 *    - PhysicalMeeting: O(1) physical node sharing
 *    - ThresholdSharing: Jaccard similarity threshold
 *    - SphereIntersection: Geometric radius-based detection
 *
 * 2. **N=1 Handling** (1 variant): Single-seed termination
 *    - CoverageThreshold: Terminate when X% of graph visited
 *
 * 3. **Termination** (3 variants): When overall algorithm terminates (N≥2)
 *    - FullPairwise: All C(N,2) seed pairs must overlap
 *    - TransitiveConnectivity: Overlap graph must be connected
 *    - CommonConvergence: All seeds share a common node
 *
 * 4. **Between-Graph** (3 variants): What subgraph to output
 *    - MinimalPaths: Only nodes/edges in discovered paths
 *    - TruncatedComponent: Connected component containing overlaps
 *    - SaliencePreserving: MI-based node ranking
 *
 * ## Total Variants
 *
 * 3 × 1 × 3 × 3 = 27 algorithm variants
 *
 * @example
 * ```typescript
 * import { OverlapBasedExpansion, PhysicalMeetingStrategy, FullPairwiseStrategy } from './overlap-based';
 *
 * const expansion = new OverlapBasedExpansion(expander, ['seedA', 'seedB'], {
 *   overlapDetection: new PhysicalMeetingStrategy(),
 *   termination: new FullPairwiseStrategy(),
 *   n1Handling: new CoverageThresholdStrategy(),
 *   betweenGraph: new MinimalPathsStrategy(),
 * });
 *
 * const result = await expansion.run();
 * ```
 */

// Core classes and types
export { OverlapBasedExpansion } from "./overlap-based-expansion.js";
export type { OverlapBasedExpansionConfig } from "./overlap-based-expansion.js";
export type { FrontierState } from "./frontier-state.js";
export type {
	OverlapBasedExpansionResult,
	OverlapMetadata,
	ExpansionStats,
	OverlapEvent,
} from "./overlap-result.js";

// Overlap Detection Strategies
export { PhysicalMeetingStrategy } from "./strategies/overlap-detection/physical-meeting.strategy.js";
export { ThresholdSharingStrategy } from "./strategies/overlap-detection/threshold-sharing.strategy.js";
export { SphereIntersectionStrategy } from "./strategies/overlap-detection/sphere-intersection.strategy.js";
export type { OverlapDetectionStrategy } from "./strategies/overlap-detection/overlap-detection-strategy.js";
export type { ThresholdSharingConfig } from "./strategies/overlap-detection/threshold-sharing.strategy.js";
export type { SphereIntersectionConfig } from "./strategies/overlap-detection/sphere-intersection.strategy.js";

// N=1 Handling Strategies
export { CoverageThresholdStrategy } from "./strategies/n1-handling/coverage-threshold.strategy.js";
export type { N1HandlingStrategy } from "./strategies/n1-handling/n1-handling-strategy.js";
export type { CoverageThresholdConfig } from "./strategies/n1-handling/coverage-threshold.strategy.js";

// Termination Strategies
export { FullPairwiseStrategy } from "./strategies/termination/full-pairwise.strategy.js";
export { TransitiveConnectivityStrategy } from "./strategies/termination/transitive-connectivity.strategy.js";
export { CommonConvergenceStrategy } from "./strategies/termination/common-convergence.strategy.js";
export type { TerminationStrategy } from "./strategies/termination/termination-strategy.js";

// Between-Graph Strategies
export { MinimalPathsStrategy } from "./strategies/between-graph/minimal-paths.strategy.js";
export { TruncatedComponentStrategy } from "./strategies/between-graph/truncated-component.strategy.js";
export { SaliencePreservingStrategy } from "./strategies/between-graph/salience-preserving.strategy.js";
export type { BetweenGraphStrategy } from "./strategies/between-graph/between-graph-strategy.js";
export type { BetweenGraphOutput } from "./strategies/between-graph/between-graph-strategy.js";
export type { SaliencePreservingConfig } from "./strategies/between-graph/salience-preserving.strategy.js";
