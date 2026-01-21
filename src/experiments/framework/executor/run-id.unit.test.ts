/**
 * Unit tests for deterministic run ID generation
 */

import { describe, expect, it } from "vitest";

import { generateConfigHash, generateRunId, parseRunId, validateRunId } from "./run-id.js";

describe("generateRunId", () => {
	it("should produce deterministic ID for same inputs", () => {
		const inputs = {
			sutId: "degree-prioritised-v1.0.0",
			caseId: "karate-v1",
			seed: 42,
			repetition: 1,
		};

		const id1 = generateRunId(inputs);
		const id2 = generateRunId(inputs);

		expect(id1).toBe(id2);
	});

	it("should produce different ID for different inputs", () => {
		const inputs1 = {
			sutId: "degree-prioritised-v1.0.0",
			caseId: "karate-v1",
		};

		const inputs2 = {
			sutId: "standard-bfs-v1.0.0",
			caseId: "karate-v1",
		};

		const id1 = generateRunId(inputs1);
		const id2 = generateRunId(inputs2);

		expect(id1).not.toBe(id2);
	});

	it("should be 16 characters (hex)", () => {
		const id = generateRunId({
			sutId: "test-sut",
			caseId: "test-case",
		});

		expect(id).toHaveLength(16);
		expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
	});

	it("should handle complex config objects", () => {
		const inputs = {
			sutId: "test-sut",
			caseId: "test-case",
			configHash: "abc123",
			seed: 12_345,
			repetition: 5,
		};

		const id = generateRunId(inputs);

		expect(id).toHaveLength(16);
		expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
	});

	it("should produce same ID regardless of property order", () => {
		const inputs1 = {
			sutId: "test-sut",
			caseId: "test-case",
			seed: 42,
		};

		const inputs2 = {
			seed: 42,
			caseId: "test-case",
			sutId: "test-sut",
		};

		const id1 = generateRunId(inputs1);
		const id2 = generateRunId(inputs2);

		expect(id1).toBe(id2);
	});

	it("should differentiate by seed value", () => {
		const base = {
			sutId: "test-sut",
			caseId: "test-case",
		};

		const id1 = generateRunId({ ...base, seed: 1 });
		const id2 = generateRunId({ ...base, seed: 2 });

		expect(id1).not.toBe(id2);
	});

	it("should differentiate by repetition number", () => {
		const base = {
			sutId: "test-sut",
			caseId: "test-case",
			seed: 42,
		};

		const id1 = generateRunId({ ...base, repetition: 1 });
		const id2 = generateRunId({ ...base, repetition: 2 });

		expect(id1).not.toBe(id2);
	});

	it("should handle missing optional fields", () => {
		const id = generateRunId({
			sutId: "test-sut",
			caseId: "test-case",
		});

		expect(id).toHaveLength(16);
	});
});

describe("generateConfigHash", () => {
	it("should produce deterministic hash for same config", () => {
		const config = { maxDepth: 3, hubThreshold: 0.1 };

		const hash1 = generateConfigHash(config);
		const hash2 = generateConfigHash(config);

		expect(hash1).toBe(hash2);
	});

	it("should be 8 characters (hex)", () => {
		const hash = generateConfigHash({ test: "value" });

		expect(hash).toHaveLength(8);
		expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true);
	});

	it("should produce different hash for different config", () => {
		const hash1 = generateConfigHash({ maxDepth: 3 });
		const hash2 = generateConfigHash({ maxDepth: 4 });

		expect(hash1).not.toBe(hash2);
	});

	it("should handle nested objects", () => {
		const config = {
			nested: {
				value: 123,
				deep: { key: "test" },
			},
		};

		const hash = generateConfigHash(config);

		expect(hash).toHaveLength(8);
	});
});

describe("validateRunId", () => {
	it("should return true for matching run ID", () => {
		const inputs = {
			sutId: "test-sut",
			caseId: "test-case",
			seed: 42,
		};

		const runId = generateRunId(inputs);
		const isValid = validateRunId(runId, inputs);

		expect(isValid).toBe(true);
	});

	it("should return false for non-matching run ID", () => {
		const inputs = {
			sutId: "test-sut",
			caseId: "test-case",
		};

		const isValid = validateRunId("0000000000000000", inputs);

		expect(isValid).toBe(false);
	});
});

describe("parseRunId", () => {
	it("should validate correct run ID format", () => {
		const validId = generateRunId({ sutId: "test", caseId: "test" });
		const result = parseRunId(validId);

		expect(result.valid).toBe(true);
		expect(result.length).toBe(16);
	});

	it("should reject run ID with wrong length", () => {
		const result = parseRunId("abc123");

		expect(result.valid).toBe(false);
		expect(result.length).toBe(6);
	});

	it("should reject non-hex characters", () => {
		const result = parseRunId("ghijklmnopqrstuv");

		expect(result.valid).toBe(false);
	});

	it("should reject empty string", () => {
		const result = parseRunId("");

		expect(result.valid).toBe(false);
		expect(result.length).toBe(0);
	});
});
