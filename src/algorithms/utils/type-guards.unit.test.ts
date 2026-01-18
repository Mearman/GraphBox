import { describe, expect, it } from "vitest";

import { type GraphError } from "../types/errors";
import { type Edge, type Node } from "../types/graph";
import { None, type Option, Some } from "../types/option";
import { Err as Error_,Ok, type Result } from "../types/result";
import {
	isEdge,
	isErr as isError,
	isGraphErrorType,
	isNode,
	isNone,
	isOk,
	isSome,
} from "./type-guards";

describe("isNode", () => {
	it("should return true for valid Node", () => {
		const node: Node = { id: "N1", type: "test" };
		expect(isNode(node)).toBe(true);
	});

	it("should return true for Node with extra properties", () => {
		const node = { id: "N1", type: "test", label: "My Node", value: 42 };
		expect(isNode(node)).toBe(true);
	});

	it("should return false for null", () => {
		expect(isNode(null)).toBe(false);
	});

	it("should return false for undefined", () => {
		// eslint-disable-next-line unicorn/no-useless-undefined -- Testing explicit undefined handling
		expect(isNode(undefined)).toBe(false);
	});

	it("should return false for non-object", () => {
		expect(isNode("string")).toBe(false);
		expect(isNode(123)).toBe(false);
		expect(isNode(true)).toBe(false);
	});

	it("should return false for object missing id", () => {
		const object = { type: "test" };
		expect(isNode(object)).toBe(false);
	});

	it("should return false for object missing type", () => {
		const object = { id: "N1" };
		expect(isNode(object)).toBe(false);
	});

	it("should return false for object with non-string id", () => {
		const object = { id: 123, type: "test" };
		expect(isNode(object)).toBe(false);
	});

	it("should return false for object with non-string type", () => {
		const object = { id: "N1", type: 123 };
		expect(isNode(object)).toBe(false);
	});

	it("should return false for empty object", () => {
		expect(isNode({})).toBe(false);
	});

	it("should return false for array", () => {
		expect(isNode([])).toBe(false);
	});
});

describe("isEdge", () => {
	it("should return true for valid Edge", () => {
		const edge: Edge = { id: "E1", source: "A", target: "B", type: "test" };
		expect(isEdge(edge)).toBe(true);
	});

	it("should return true for Edge with weight", () => {
		const edge = { id: "E1", source: "A", target: "B", type: "test", weight: 1.5 };
		expect(isEdge(edge)).toBe(true);
	});

	it("should return true for Edge with extra properties", () => {
		const edge = { id: "E1", source: "A", target: "B", type: "test", label: "My Edge" };
		expect(isEdge(edge)).toBe(true);
	});

	it("should return false for null", () => {
		expect(isEdge(null)).toBe(false);
	});

	it("should return false for undefined", () => {
		// eslint-disable-next-line unicorn/no-useless-undefined -- Testing explicit undefined handling
		expect(isEdge(undefined)).toBe(false);
	});

	it("should return false for non-object", () => {
		expect(isEdge("string")).toBe(false);
		expect(isEdge(123)).toBe(false);
	});

	it("should return false for object missing id", () => {
		const object = { source: "A", target: "B", type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object missing source", () => {
		const object = { id: "E1", target: "B", type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object missing target", () => {
		const object = { id: "E1", source: "A", type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object missing type", () => {
		const object = { id: "E1", source: "A", target: "B" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object with non-string id", () => {
		const object = { id: 123, source: "A", target: "B", type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object with non-string source", () => {
		const object = { id: "E1", source: 123, target: "B", type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object with non-string target", () => {
		const object = { id: "E1", source: "A", target: 123, type: "test" };
		expect(isEdge(object)).toBe(false);
	});

	it("should return false for object with non-string type", () => {
		const object = { id: "E1", source: "A", target: "B", type: 123 };
		expect(isEdge(object)).toBe(false);
	});
});

describe("isOk", () => {
	it("should return true for Ok result", () => {
		const result: Result<number, string> = Ok(42);
		expect(isOk(result)).toBe(true);
	});

	it("should return false for Err result", () => {
		const result: Result<number, string> = Error_("error");
		expect(isOk(result)).toBe(false);
	});

	it("should narrow type correctly", () => {
		const result: Result<number, string> = Ok(42);
		if (isOk(result)) {
			// TypeScript should know result.value is number
			const value: number = result.value;
			expect(value).toBe(42);
		}
	});
});

describe("isErr", () => {
	it("should return true for Err result", () => {
		const result: Result<number, string> = Error_("error");
		expect(isError(result)).toBe(true);
	});

	it("should return false for Ok result", () => {
		const result: Result<number, string> = Ok(42);
		expect(isError(result)).toBe(false);
	});

	it("should narrow type correctly", () => {
		const result: Result<number, string> = Error_("something went wrong");
		if (isError(result)) {
			// TypeScript should know result.error is string
			const error: string = result.error;
			expect(error).toBe("something went wrong");
		}
	});
});

describe("isSome", () => {
	it("should return true for Some option", () => {
		const option: Option<number> = Some(42);
		expect(isSome(option)).toBe(true);
	});

	it("should return false for None option", () => {
		const option: Option<number> = None();
		expect(isSome(option)).toBe(false);
	});

	it("should narrow type correctly", () => {
		const option: Option<string> = Some("hello");
		if (isSome(option)) {
			// TypeScript should know option.value is string
			const value: string = option.value;
			expect(value).toBe("hello");
		}
	});
});

describe("isNone", () => {
	it("should return true for None option", () => {
		const option: Option<number> = None();
		expect(isNone(option)).toBe(true);
	});

	it("should return false for Some option", () => {
		const option: Option<number> = Some(42);
		expect(isNone(option)).toBe(false);
	});

	it("should narrow type correctly", () => {
		const option: Option<number> = None();
		if (isNone(option)) {
			// TypeScript should know option.some is false
			expect(option.some).toBe(false);
		}
	});
});

describe("isGraphErrorType", () => {
	it("should return true for matching error type", () => {
		const error: GraphError = {
			type: "duplicate-node",
			message: "Node already exists",
			nodeId: "N1",
		};
		expect(isGraphErrorType(error, "duplicate-node")).toBe(true);
	});

	it("should return false for non-matching error type", () => {
		const error: GraphError = {
			type: "duplicate-node",
			message: "Node already exists",
			nodeId: "N1",
		};
		expect(isGraphErrorType(error, "invalid-input")).toBe(false);
	});

	it("should narrow type correctly for invalid-input", () => {
		const error: GraphError = {
			type: "invalid-input",
			message: "Invalid input provided",
			input: { foo: "bar" },
		};
		if (isGraphErrorType(error, "invalid-input")) {
			// TypeScript should know error has input property
			expect(error.input).toEqual({ foo: "bar" });
		}
	});

	it("should narrow type correctly for negative-weight", () => {
		const error: GraphError = {
			type: "negative-weight",
			message: "Negative weight not allowed",
			weight: -1,
			edgeId: "E1",
		};
		if (isGraphErrorType(error, "negative-weight")) {
			// TypeScript should know error has weight and edgeId properties
			expect(error.weight).toBe(-1);
			expect(error.edgeId).toBe("E1");
		}
	});

	it("should narrow type correctly for cycle-detected", () => {
		const error: GraphError = {
			type: "cycle-detected",
			message: "Cycle found",
			cyclePath: ["A", "B", "C", "A"],
		};
		if (isGraphErrorType(error, "cycle-detected")) {
			// TypeScript should know error has cyclePath property
			expect(error.cyclePath).toEqual(["A", "B", "C", "A"]);
		}
	});

	it("should narrow type correctly for invalid-weight", () => {
		const error: GraphError = {
			type: "invalid-weight",
			message: "Invalid weight",
			weight: Number.NaN,
			edgeId: "E1",
		};
		if (isGraphErrorType(error, "invalid-weight")) {
			expect(error.edgeId).toBe("E1");
		}
	});
});
