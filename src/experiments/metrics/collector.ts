/**
 * Metrics Collector
 *
 * Standalone metrics collection with no dependencies on test runners.
 * Experiments call record() to add metrics, which are serialized to JSON.
 */

import type {
	Metric,
	MetricCategory,
	MetricsOutput,
} from "./types.js";

export class MetricsCollector {
	private metrics: Map<MetricCategory, Metric[]> = new Map();

	/**
	 * Record a metric entry.
	 *
	 * @param category - The metric category (e.g., "hub-traversal")
	 * @param data - The metric data (typed)
	 */
	record<T extends Metric>(category: MetricCategory, data: T): void {
		if (!this.metrics.has(category)) {
			this.metrics.set(category, []);
		}
		const metrics = this.metrics.get(category);
		if (metrics) {
			metrics.push(data);
		}
	}

	/**
	 * Record multiple metrics of the same category at once.
	 * @param category
	 * @param data
	 */
	recordBatch<T extends Metric>(category: MetricCategory, data: T[]): void {
		if (!this.metrics.has(category)) {
			this.metrics.set(category, []);
		}
		const metrics = this.metrics.get(category);
		if (metrics) {
			metrics.push(...data);
		}
	}

	/**
	 * Get all metrics for a category.
	 * @param category
	 */
	get(category: MetricCategory): Metric[] {
		return this.metrics.get(category) || [];
	}

	/**
	 * Get all metrics as a record.
	 */
	getAll(): Record<MetricCategory, Metric[]> {
		const result: Record<string, Metric[]> = {};
		for (const [category, metrics] of this.metrics.entries()) {
			result[category] = metrics;
		}
		return result as Record<MetricCategory, Metric[]>;
	}

	/**
	 * Clear all metrics (useful for testing).
	 */
	clear(): void {
		this.metrics.clear();
	}

	/**
	 * Check if any metrics have been collected.
	 */
	isEmpty(): boolean {
		return this.metrics.size === 0;
	}

	/**
	 * Get count of metrics by category.
	 * @param category
	 */
	count(category?: MetricCategory): number {
		if (category) {
			return this.metrics.get(category)?.length || 0;
		}
		let total = 0;
		for (const metrics of this.metrics.values()) {
			total += metrics.length;
		}
		return total;
	}

	/**
	 * Serialize to MetricsOutput format for JSON writing.
	 */
	serialize(): MetricsOutput {
		return {
			version: "1.0.0",
			timestamp: new Date().toISOString(),
			metrics: this.getAll(),
		};
	}
}

/**
 * Global singleton instance for convenience.
 * Can also create individual instances for isolation.
 */
export const metrics = new MetricsCollector();
