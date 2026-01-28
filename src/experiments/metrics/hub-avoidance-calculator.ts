/**
 * Hub-Avoidance Metrics Calculator
 *
 * Computes hub-avoidance metrics from degree distribution data collected
 * during expansion. These metrics complement path diversity by directly
 * measuring the algorithm's tendency to avoid expanding through high-degree
 * hub nodes.
 *
 * **Key Insight**: Path diversity is a hub-biased metric—it favors algorithms
 * that converge through hubs. Degree-prioritised's design goal is hub avoidance,
 * which these metrics directly measure.
 */

import type { ExpansionStats } from "../../algorithms/traversal/degree-prioritised-expansion.js";
import type { BfsExpansionStats } from "../baselines/standard-bfs.js";

/**
 * Degree bucket thresholds for hub classification.
 * Matches buckets used in expansion stats.
 *
 * @internal
 * @readonly
 */
 
const _DEGREE_BUCKETS = [
	"1-5", "6-10", "11-50", "51-100", "101-500", "501-1000", "1000+"
] as const;

/**
 * Default thresholds for hub/peripheral classification.
 */
const DEFAULT_THRESHOLDS = {
	/** Hub threshold: degree >= 100 means hub */
	hubThreshold: 100,
	/** Peripheral threshold: degree <= 10 means peripheral */
	peripheralThreshold: 10,
} as const;

/**
 * Hub-avoidance metrics computed from degree distribution.
 */
export interface HubAvoidanceMetrics {
	/** Proportion of expanded nodes that are hubs (0-1, lower is better) */
	hubTraversalRate: number;

	/** Distribution of expanded nodes across degree buckets */
	degreeDistribution: Map<string, number>;

	/** Ratio of peripheral nodes expanded to hub nodes expanded (higher is better) */
	peripheralCoverageRatio: number;

	/** Total nodes expanded */
	totalExpanded: number;

	/** Number of hub nodes expanded (degree >= hubThreshold) */
	hubCount: number;

	/** Number of peripheral nodes expanded (degree <= peripheralThreshold) */
	peripheralCount: number;
}

/**
 * Compute hub-avoidance metrics from expansion stats.
 *
 * The degree distribution map contains bucket counts like:
 * - "1-5": 150      (peripheral)
 * - "6-10": 80      (peripheral)
 * - "11-50": 60
 * - "51-100": 30
 * - "101-500": 15   (hub)
 * - "501-1000": 5   (hub)
 * - "1000+": 2      (hub)
 *
 * Hub-avoidance means:
 * - Low hub traversal rate (fewer nodes from "101-500", "501-1000", "1000+")
 * - High peripheral coverage ratio (more peripheral nodes relative to hubs)
 *
 * @param stats - Expansion stats containing degree distribution
 * @param hubThreshold - Minimum degree for hub classification (default: 100)
 * @param peripheralThreshold - Maximum degree for peripheral classification (default: 10)
 * @returns Hub-avoidance metrics
 */
export const calculateHubAvoidanceMetrics = (stats: BfsExpansionStats | ExpansionStats, hubThreshold: number = DEFAULT_THRESHOLDS.hubThreshold, peripheralThreshold: number = DEFAULT_THRESHOLDS.peripheralThreshold): HubAvoidanceMetrics => {
	const { degreeDistribution } = stats;

	// Sum all expanded nodes from distribution
	let totalExpanded = 0;
	const bucketSums = new Map<string, number>();

	for (const [bucket, count] of degreeDistribution.entries()) {
		totalExpanded += count;
		bucketSums.set(bucket, count);
	}

	// Classify buckets as hub, peripheral, or intermediate
	let hubCount = 0;
	let peripheralCount = 0;

	for (const [bucket, count] of bucketSums.entries()) {
		const minDegree = getMinDegreeForBucket(bucket);
		if (minDegree === null) continue;

		if (minDegree >= hubThreshold) {
			hubCount += count;
		} else if (minDegree <= peripheralThreshold) {
			peripheralCount += count;
		}
	}

	// Compute hub traversal rate (proportion of expanded nodes that are hubs)
	const hubTraversalRate = totalExpanded > 0 ? hubCount / totalExpanded : 0;

	// Compute peripheral coverage ratio (peripheral / hub)
	// Higher is better: more peripheral nodes expanded relative to hubs
	const peripheralCoverageRatio = hubCount > 0 ? peripheralCount / hubCount : peripheralCount;

	return {
		hubTraversalRate,
		degreeDistribution: bucketSums,
		peripheralCoverageRatio,
		totalExpanded,
		hubCount,
		peripheralCount,
	};
};

/**
 * Get the minimum degree for a bucket label.
 *
 * @param bucket - Bucket label (e.g., "1-5", "6-10", "1000+")
 * @returns Minimum degree or null if bucket is unrecognised
 */
const getMinDegreeForBucket = (bucket: string): number | null => {
	const match = bucket.match(/^(\d+)-/);
	if (match) {
		return Number.parseInt(match[1], 10);
	}
	// Handle "1000+" case
	if (bucket.endsWith("+")) {
		const numberMatch = bucket.match(/^(\d+)\+/);
		if (numberMatch) {
			return Number.parseInt(numberMatch[1], 10);
		}
	}
	return null;
};

/**
 * Convert hub-avoidance metrics to a plain object for serialisation.
 *
 * @param metrics - Hub-avoidance metrics
 * @returns Plain object with serialisable values
 */
export const hubAvoidanceMetricsToObject = (metrics: HubAvoidanceMetrics): Record<string, number | string> => {
	const result: Record<string, number | string> = {
		hubTraversalRate: metrics.hubTraversalRate,
		peripheralCoverageRatio: metrics.peripheralCoverageRatio,
		totalExpanded: metrics.totalExpanded,
		hubCount: metrics.hubCount,
		peripheralCount: metrics.peripheralCount,
	};

	// Add degree distribution as flattened entries
	for (const [bucket, count] of metrics.degreeDistribution.entries()) {
		result[`bucket_${bucket}`] = count;
	}

	return result;
};

/**
 * Format hub-avoidance metrics as percentages for display.
 *
 * @param metrics - Hub-avoidance metrics
 * @returns Object with formatted percentage strings
 */
export const formatHubAvoidanceMetrics = (metrics: HubAvoidanceMetrics): {
	hubTraversalRate: string;
	peripheralCoverageRatio: string;
	degreeDistribution: Record<string, string>;
} => {
	// Format degree distribution as percentages
	const distributionPct: Record<string, string> = {};
	for (const [bucket, count] of metrics.degreeDistribution.entries()) {
		const pct = metrics.totalExpanded > 0
			? (count / metrics.totalExpanded) * 100
			: 0;
		distributionPct[bucket] = `${pct.toFixed(1)}%`;
	}

	return {
		hubTraversalRate: `${(metrics.hubTraversalRate * 100).toFixed(1)}%`,
		peripheralCoverageRatio: metrics.peripheralCoverageRatio.toFixed(2),
		degreeDistribution: distributionPct,
	};
};

/**
 * Compare hub-avoidance metrics between two algorithms.
 *
 * Returns which algorithm has better hub avoidance (lower hub traversal).
 *
 * @param metrics1 - First algorithm's metrics
 * @param metrics2 - Second algorithm's metrics
 * @returns Comparison result
 */
export interface HubAvoidanceComparison {
	/** Which metrics have lower hub rate (-1, 0, or 1) */
	lowerHubRate: number;

	/** Difference in hub traversal rate (metrics1 - metrics2) */
	hubRateDelta: number;

	/** Ratio of peripheral coverage (metrics1 / metrics2) */
	peripheralRatioDelta: number;

	/** Whether metrics1 has better hub avoidance overall */
	better: boolean;
}

export const compareHubAvoidance = (metrics1: HubAvoidanceMetrics, metrics2: HubAvoidanceMetrics): HubAvoidanceComparison => {
	const hubRateDelta = metrics1.hubTraversalRate - metrics2.hubTraversalRate;
	const peripheralRatioDelta = metrics1.peripheralCoverageRatio - metrics2.peripheralCoverageRatio;

	// Lower hub rate is better, higher peripheral ratio is better
	const betterByHubRate = hubRateDelta < 0;
	const betterByPeripheralRatio = peripheralRatioDelta > 0;

	return {
		lowerHubRate: hubRateDelta < 0 ? -1 : (hubRateDelta > 0 ? 1 : 0),
		hubRateDelta,
		peripheralRatioDelta,
		better: betterByHubRate && betterByPeripheralRatio,
	};
};

/**
 * Compute hub-avoidance metrics for table rendering.
 *
 * This function aggregates degree distribution data into a format
 * suitable for LaTeX table generation.
 *
 * @param statsArray - Array of expansion stats from multiple runs
 * @param hubThreshold - Hub threshold (default: 100)
 * @returns Aggregated hub-avoidance metrics
 */
export interface AggregatedHubAvoidanceMetrics {
	meanHubTraversalRate: number;
	meanPeripheralCoverageRatio: number;
	degreeDistributionPct: Record<string, number>;
	totalRuns: number;
}

export const aggregateHubAvoidanceMetrics = (statsArray: Array<BfsExpansionStats | ExpansionStats>, hubThreshold: number = DEFAULT_THRESHOLDS.hubThreshold): AggregatedHubAvoidanceMetrics => {
	if (statsArray.length === 0) {
		return {
			meanHubTraversalRate: 0,
			meanPeripheralCoverageRatio: 0,
			degreeDistributionPct: {},
			totalRuns: 0,
		};
	}

	const individualMetrics = statsArray.map((stats) =>
		calculateHubAvoidanceMetrics(stats, hubThreshold)
	);

	// Aggregate hub traversal rate
	const totalHubRate = individualMetrics.reduce((sum, m) => sum + m.hubTraversalRate, 0);
	const meanHubTraversalRate = totalHubRate / individualMetrics.length;

	// Aggregate peripheral coverage ratio
	const totalPeripheralRatio = individualMetrics.reduce((sum, m) => sum + m.peripheralCoverageRatio, 0);
	const meanPeripheralCoverageRatio = totalPeripheralRatio / individualMetrics.length;

	// Aggregate degree distribution as average percentage
	const degreeDistributionPct: Record<string, number> = {};
	const allBuckets = new Set<string>();
	for (const metrics of individualMetrics) {
		for (const bucket of metrics.degreeDistribution.keys()) {
			allBuckets.add(bucket);
		}
	}

	for (const bucket of allBuckets) {
		let totalPct = 0;
		let count = 0;
		for (const metrics of individualMetrics) {
			const bucketCount = metrics.degreeDistribution.get(bucket) ?? 0;
			if (metrics.totalExpanded > 0) {
				totalPct += (bucketCount / metrics.totalExpanded) * 100;
				count++;
			}
		}
		degreeDistributionPct[bucket] = count > 0 ? totalPct / count : 0;
	}

	return {
		meanHubTraversalRate,
		meanPeripheralCoverageRatio,
		degreeDistributionPct,
		totalRuns: statsArray.length,
	};
};
