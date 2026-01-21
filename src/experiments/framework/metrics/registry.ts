/**
 * Metric Registry
 *
 * Normative definitions for all metrics used in the evaluation framework.
 * Each metric has semantic information including direction preference,
 * category, and unit for proper aggregation and rendering.
 */

/**
 * Category of metric.
 */
export type MetricCategory = "correctness" | "quality" | "efficiency" | "stability";

/**
 * Definition of a metric.
 */
export interface MetricDefinition {
	/** Unique metric name */
	name: string;

	/** Human-readable display name */
	displayName: string;

	/** Unit of measurement */
	unit?: string;

	/** Whether higher values are better */
	higherIsBetter: boolean;

	/** Metric category */
	category: MetricCategory;

	/** Description of what the metric measures */
	description: string;

	/** Dependencies for derived metrics */
	dependencies?: string[];

	/** Format string for display (e.g., "%.2f", "%.0f%%") */
	formatString?: string;

	/** Whether this metric is a ratio (0-1 scale) */
	isRatio?: boolean;

	/** Whether this metric is a percentage (0-100 scale) */
	isPercentage?: boolean;
}

/**
 * Normative metric definitions for GraphBox evaluation.
 */
export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
	// Quality Metrics
	"path-diversity": {
		name: "path-diversity",
		displayName: "Path Diversity",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Ratio of unique intermediate nodes to total path nodes",
		formatString: "%.3f",
		isRatio: true,
	},
	"unique-paths": {
		name: "unique-paths",
		displayName: "Unique Paths",
		unit: "count",
		higherIsBetter: true,
		category: "quality",
		description: "Number of distinct paths found between seeds",
		formatString: "%.0f",
	},
	"node-coverage": {
		name: "node-coverage",
		displayName: "Node Coverage",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Fraction of graph nodes covered by sampled subgraph",
		formatString: "%.2f",
		isRatio: true,
	},
	"structural-coverage": {
		name: "structural-coverage",
		displayName: "Structural Coverage",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Fraction of oracle ego-network covered by sample",
		formatString: "%.3f",
		isRatio: true,
	},
	"hub-coverage": {
		name: "hub-coverage",
		displayName: "Hub Coverage",
		unit: "percentage",
		higherIsBetter: false,
		category: "quality",
		description: "Percentage of high-degree nodes included in sample",
		formatString: "%.1f%%",
		isPercentage: true,
	},
	"bucket-coverage": {
		name: "bucket-coverage",
		displayName: "Degree Bucket Coverage",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Fraction of degree buckets represented in sample",
		formatString: "%.2f",
		isRatio: true,
	},

	// Hub Avoidance Metrics
	"hub-traversal": {
		name: "hub-traversal",
		displayName: "Hub Traversal",
		unit: "percentage",
		higherIsBetter: false,
		category: "quality",
		description: "Percentage of high-degree nodes visited during expansion",
		formatString: "%.1f%%",
		isPercentage: true,
	},
	"hub-ratio": {
		name: "hub-ratio",
		displayName: "Hub Ratio",
		unit: "ratio",
		higherIsBetter: false,
		category: "quality",
		description: "Ratio of hubs expanded to total nodes expanded",
		formatString: "%.3f",
		isRatio: true,
	},

	// Hub-Avoidance Metrics (for degree-prioritised evaluation)
	"hub-avoidance-rate": {
		name: "hub-avoidance-rate",
		displayName: "Hub Traversal Rate",
		unit: "percentage",
		higherIsBetter: false,
		category: "quality",
		description: "Proportion of expanded nodes that are hubs (lower is better for hub avoidance)",
		formatString: "%.1f%%",
		isPercentage: true,
	},
	"peripheral-coverage-ratio": {
		name: "peripheral-coverage-ratio",
		displayName: "Peripheral Coverage Ratio",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Ratio of peripheral nodes expanded to hub nodes expanded (higher is better)",
		formatString: "%.2f",
		isRatio: true,
	},

	// Efficiency Metrics
	"execution-time": {
		name: "execution-time",
		displayName: "Execution Time",
		unit: "milliseconds",
		higherIsBetter: false,
		category: "efficiency",
		description: "Algorithm execution time",
		formatString: "%.2fms",
	},
	"nodes-expanded": {
		name: "nodes-expanded",
		displayName: "Nodes Expanded",
		unit: "count",
		higherIsBetter: false,
		category: "efficiency",
		description: "Total nodes expanded during traversal",
		formatString: "%.0f",
	},
	"iterations": {
		name: "iterations",
		displayName: "Iterations",
		unit: "count",
		higherIsBetter: false,
		category: "efficiency",
		description: "Total iterations performed",
		formatString: "%.0f",
	},
	"speedup": {
		name: "speedup",
		displayName: "Speedup",
		unit: "ratio",
		higherIsBetter: true,
		category: "efficiency",
		description: "Baseline time / treatment time",
		dependencies: ["execution-time"],
		formatString: "%.2fx",
	},

	// Ranking Metrics
	"mean-mi": {
		name: "mean-mi",
		displayName: "Mean Mutual Information",
		unit: "bits",
		higherIsBetter: true,
		category: "quality",
		description: "Average mutual information of ranked paths",
		formatString: "%.2f",
	},
	"ndcg-at-k": {
		name: "ndcg-at-k",
		displayName: "NDCG@k",
		unit: "ratio",
		higherIsBetter: true,
		category: "quality",
		description: "Normalized discounted cumulative gain at k",
		formatString: "%.3f",
		isRatio: true,
	},

	// Statistical Metrics
	"p-value": {
		name: "p-value",
		displayName: "P-Value",
		unit: "probability",
		higherIsBetter: false,
		category: "correctness",
		description: "Statistical significance p-value",
		formatString: "%.4f",
		isRatio: true,
	},
	"cohens-d": {
		name: "cohens-d",
		displayName: "Cohen's d",
		unit: "effect size",
		higherIsBetter: true,
		category: "correctness",
		description: "Effect size measure",
		formatString: "%.3f",
	},

	// Robustness Metrics
	"variance-under-perturbation": {
		name: "variance-under-perturbation",
		displayName: "Variance Under Perturbation",
		unit: "variance",
		higherIsBetter: false,
		category: "stability",
		description: "Variance of metric under perturbation",
		formatString: "%.4f",
	},
	"ranking-stability": {
		name: "ranking-stability",
		displayName: "Ranking Stability",
		unit: "correlation",
		higherIsBetter: true,
		category: "stability",
		description: "Kendall's tau between perturbed rankings",
		formatString: "%.3f",
		isRatio: true,
	},
};

/**
 * Get metric definition by name.
 *
 * @param name - Metric name
 * @returns Metric definition or undefined
 */
export const getMetricDefinition = (name: string): MetricDefinition | undefined => METRIC_REGISTRY[name];

/**
 * Get all metrics in a category.
 *
 * @param category - Metric category
 * @returns Array of metric definitions
 */
export const getMetricsByCategory = (category: MetricCategory): MetricDefinition[] => Object.values(METRIC_REGISTRY).filter((m) => m.category === category);

/**
 * Get all metrics where higher is better.
 */
export const getPositiveMetrics = (): MetricDefinition[] => Object.values(METRIC_REGISTRY).filter((m) => m.higherIsBetter);

/**
 * Get all metrics where lower is better.
 */
export const getNegativeMetrics = (): MetricDefinition[] => Object.values(METRIC_REGISTRY).filter((m) => !m.higherIsBetter);

/**
 * Check if a metric name is registered.
 *
 * @param name - Metric name
 * @returns true if registered
 */
export const isRegisteredMetric = (name: string): boolean => name in METRIC_REGISTRY;

/**
 * Format a metric value according to its definition.
 *
 * @param name - Metric name
 * @param value - Value to format
 * @returns Formatted string
 */
export const formatMetricValue = (name: string, value: number): string => {
	const definition = METRIC_REGISTRY[name];
	if (!definition) {
		return String(value);
	}

	if (definition.isPercentage) {
		return `${value.toFixed(1)}%`;
	}

	if (definition.isRatio) {
		return value.toFixed(3);
	}

	if (definition.formatString) {
		// Simple format string parsing
		const match = definition.formatString.match(/%\.(\d+)f/);
		if (match) {
			const decimals = Number.parseInt(match[1], 10);
			const suffix = definition.formatString.replace(/%\.\d+f/, "");
			return value.toFixed(decimals) + suffix;
		}
	}

	return value.toFixed(2);
};
