import { describe, expect, it } from "vitest";

import { type Edge } from "../types/graph";
import {
	validateEdgeWeight,
	validateNonNegativeWeight,
	validateNotNull,
} from "./validators";

// Test edge type
interface TestEdge extends Edge {
	id: string;
	source: string;
	target: string;
	type: string;
	weight?: number;
}

// Helper to create a test edge
const createEdge = (id: string, weight?: number): TestEdge => ({
	id,
	source: "A",
	target: "B",
	type: "test",
	weight,
});

describe("validateNotNull", () => {
	it("should return Ok for non-null value", () => {
		const result = validateNotNull("hello", "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Ok for empty string", () => {
		const result = validateNotNull("", "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Ok for zero", () => {
		const result = validateNotNull(0, "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Ok for false", () => {
		const result = validateNotNull(false, "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Ok for empty object", () => {
		const result = validateNotNull({}, "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Ok for empty array", () => {
		const result = validateNotNull([], "testValue");
		expect(result.ok).toBe(true);
	});

	it("should return Err for null", () => {
		const result = validateNotNull(null, "testValue");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-input");
			expect(result.error.message).toContain("testValue");
			expect(result.error.message).toContain("cannot be null or undefined");
		}
	});

	it("should return Err for undefined", () => {
		const result = validateNotNull(undefined, "testValue");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-input");
			expect(result.error.message).toContain("testValue");
		}
	});

	it("should include input name in error message", () => {
		const result = validateNotNull(null, "myParameter");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("myParameter");
		}
	});
});

describe("validateEdgeWeight", () => {
	it("should return Ok for undefined weight", () => {
		const edge = createEdge("E1");
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Ok for positive weight", () => {
		const edge = createEdge("E1", 1.5);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Ok for zero weight", () => {
		const edge = createEdge("E1", 0);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Ok for negative weight", () => {
		// validateEdgeWeight only checks for valid numbers, not sign
		const edge = createEdge("E1", -5);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Err for NaN weight", () => {
		const edge = createEdge("E1", Number.NaN);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-weight");
			expect(result.error.message).toContain("NaN");
			expect(result.error.edgeId).toBe("E1");
		}
	});

	it("should return Err for Infinity weight", () => {
		const edge = createEdge("E1", Infinity);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-weight");
			expect(result.error.message).toContain("Infinity");
			expect(result.error.edgeId).toBe("E1");
		}
	});

	it("should return Err for negative Infinity weight", () => {
		const edge = createEdge("E1", -Infinity);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-weight");
			expect(result.error.edgeId).toBe("E1");
		}
	});

	it("should return Err for non-numeric weight", () => {
		const edge = { id: "E1", source: "A", target: "B", type: "test", weight: "five" as unknown as number };
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("invalid-weight");
			expect(result.error.message).toContain("non-numeric");
		}
	});

	it("should include edge ID in error", () => {
		const edge = createEdge("my-edge-123", Number.NaN);
		const result = validateEdgeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.edgeId).toBe("my-edge-123");
			expect(result.error.message).toContain("my-edge-123");
		}
	});
});

describe("validateNonNegativeWeight", () => {
	it("should return Ok for undefined weight (defaults to 1)", () => {
		const edge = createEdge("E1");
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Ok for positive weight", () => {
		const edge = createEdge("E1", 5.5);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Ok for zero weight", () => {
		const edge = createEdge("E1", 0);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(true);
	});

	it("should return Err for negative weight", () => {
		const edge = createEdge("E1", -1);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("negative-weight");
			expect(result.error.weight).toBe(-1);
			expect(result.error.edgeId).toBe("E1");
		}
	});

	it("should return Err for large negative weight", () => {
		const edge = createEdge("E1", -1000);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.type).toBe("negative-weight");
			expect(result.error.weight).toBe(-1000);
		}
	});

	it("should include Dijkstra mention in error message", () => {
		const edge = createEdge("E1", -0.5);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("Dijkstra");
		}
	});

	it("should include edge ID in error", () => {
		const edge = createEdge("edge-with-bad-weight", -5);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.edgeId).toBe("edge-with-bad-weight");
			expect(result.error.message).toContain("edge-with-bad-weight");
		}
	});

	it("should include weight value in error message", () => {
		const edge = createEdge("E1", -3.14);
		const result = validateNonNegativeWeight(edge);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toContain("-3.14");
		}
	});
});
