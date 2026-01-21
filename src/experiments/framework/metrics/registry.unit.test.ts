/**
 * Unit tests for metric registry
 */

import { describe, expect, it } from "vitest";

import {
	formatMetricValue,
	getMetricDefinition,
	getMetricsByCategory,
	getNegativeMetrics,
	getPositiveMetrics,
	isRegisteredMetric,
	METRIC_REGISTRY,
} from "./registry.js";

describe("METRIC_REGISTRY", () => {
	it("should contain expected core metrics", () => {
		const expectedMetrics = [
			"path-diversity",
			"unique-paths",
			"node-coverage",
			"structural-coverage",
			"hub-coverage",
			"bucket-coverage",
			"hub-traversal",
			"hub-ratio",
			"execution-time",
			"nodes-expanded",
			"iterations",
			"speedup",
			"mean-mi",
			"ndcg-at-k",
			"p-value",
			"cohens-d",
			"variance-under-perturbation",
			"ranking-stability",
		];

		for (const metric of expectedMetrics) {
			expect(METRIC_REGISTRY).toHaveProperty(metric);
		}
	});

	it("should have valid categories for all metrics", () => {
		const validCategories = ["correctness", "quality", "efficiency", "stability"];

		for (const [name, definition] of Object.entries(METRIC_REGISTRY)) {
			expect(validCategories).toContain(definition.category);
			expect(definition.name).toBe(name);
		}
	});

	it("should have display names for all metrics", () => {
		for (const definition of Object.values(METRIC_REGISTRY)) {
			expect(definition.displayName).toBeDefined();
			expect(definition.displayName.length).toBeGreaterThan(0);
		}
	});

	it("should have descriptions for all metrics", () => {
		for (const definition of Object.values(METRIC_REGISTRY)) {
			expect(definition.description).toBeDefined();
			expect(definition.description.length).toBeGreaterThan(0);
		}
	});
});

describe("getMetricDefinition", () => {
	it("should return definition for valid metric", () => {
		const definition = getMetricDefinition("execution-time");

		expect(definition).toBeDefined();
		expect(definition?.name).toBe("execution-time");
		expect(definition?.category).toBe("efficiency");
		expect(definition?.higherIsBetter).toBe(false);
	});

	it("should return undefined for unknown metric", () => {
		const definition = getMetricDefinition("nonexistent-metric");

		expect(definition).toBeUndefined();
	});

	it("should return ratio metric correctly", () => {
		const definition = getMetricDefinition("path-diversity");

		expect(definition).toBeDefined();
		expect(definition?.isRatio).toBe(true);
	});

	it("should return percentage metric correctly", () => {
		const definition = getMetricDefinition("hub-coverage");

		expect(definition).toBeDefined();
		expect(definition?.isPercentage).toBe(true);
	});
});

describe("getMetricsByCategory", () => {
	it("should filter by quality category", () => {
		const qualityMetrics = getMetricsByCategory("quality");

		expect(qualityMetrics.length).toBeGreaterThan(0);
		expect(qualityMetrics.every((m) => m.category === "quality")).toBe(true);
	});

	it("should filter by efficiency category", () => {
		const efficiencyMetrics = getMetricsByCategory("efficiency");

		expect(efficiencyMetrics.length).toBeGreaterThan(0);
		expect(efficiencyMetrics.every((m) => m.category === "efficiency")).toBe(true);
		expect(efficiencyMetrics.some((m) => m.name === "execution-time")).toBe(true);
	});

	it("should filter by correctness category", () => {
		const correctnessMetrics = getMetricsByCategory("correctness");

		expect(correctnessMetrics.length).toBeGreaterThan(0);
		expect(correctnessMetrics.every((m) => m.category === "correctness")).toBe(true);
	});

	it("should filter by stability category", () => {
		const stabilityMetrics = getMetricsByCategory("stability");

		expect(stabilityMetrics.length).toBeGreaterThan(0);
		expect(stabilityMetrics.every((m) => m.category === "stability")).toBe(true);
	});
});

describe("getPositiveMetrics", () => {
	it("should return only metrics where higher is better", () => {
		const positiveMetrics = getPositiveMetrics();

		expect(positiveMetrics.length).toBeGreaterThan(0);
		expect(positiveMetrics.every((m) => m.higherIsBetter)).toBe(true);
	});

	it("should include path-diversity", () => {
		const positiveMetrics = getPositiveMetrics();

		expect(positiveMetrics.some((m) => m.name === "path-diversity")).toBe(true);
	});
});

describe("getNegativeMetrics", () => {
	it("should return only metrics where lower is better", () => {
		const negativeMetrics = getNegativeMetrics();

		expect(negativeMetrics.length).toBeGreaterThan(0);
		expect(negativeMetrics.every((m) => !m.higherIsBetter)).toBe(true);
	});

	it("should include execution-time", () => {
		const negativeMetrics = getNegativeMetrics();

		expect(negativeMetrics.some((m) => m.name === "execution-time")).toBe(true);
	});
});

describe("isRegisteredMetric", () => {
	it("should return true for registered metric", () => {
		expect(isRegisteredMetric("execution-time")).toBe(true);
		expect(isRegisteredMetric("path-diversity")).toBe(true);
	});

	it("should return false for unregistered metric", () => {
		expect(isRegisteredMetric("fake-metric")).toBe(false);
		expect(isRegisteredMetric("")).toBe(false);
	});
});

describe("formatMetricValue", () => {
	it("should format ratio metrics with 3 decimals", () => {
		const formatted = formatMetricValue("path-diversity", 0.75);

		expect(formatted).toBe("0.750");
	});

	it("should format percentage metrics", () => {
		const formatted = formatMetricValue("hub-coverage", 25.5);

		expect(formatted).toBe("25.5%");
	});

	it("should format execution time with unit", () => {
		const formatted = formatMetricValue("execution-time", 123.456);

		expect(formatted).toBe("123.46ms");
	});

	it("should format integer counts without decimals", () => {
		const formatted = formatMetricValue("nodes-expanded", 100);

		expect(formatted).toBe("100");
	});

	it("should return string representation for unknown metrics", () => {
		const formatted = formatMetricValue("unknown-metric", 42);

		expect(formatted).toBe("42");
	});

	it("should format speedup metric", () => {
		const formatted = formatMetricValue("speedup", 2.5);

		expect(formatted).toBe("2.50x");
	});

	it("should format effect size (Cohen's d)", () => {
		const formatted = formatMetricValue("cohens-d", 0.8);

		expect(formatted).toBe("0.800");
	});

	it("should format p-value with 4 decimals", () => {
		const formatted = formatMetricValue("p-value", 0.0321);

		expect(formatted).toBe("0.032");
	});
});
