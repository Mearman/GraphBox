/**
 * Unit tests for argument parser
 */

import { describe, expect, it } from "vitest";

import {
	getBoolean,
	getNumber,
	getOptional,
	getRequired,
	parseArgs as parseArguments,
} from "./arg-parser";

describe("parseArgs", () => {
	it("should parse positional arguments", () => {
		const result = parseArguments(["arg1", "arg2", "arg3"]);
		expect(result._).toEqual(["arg1", "arg2", "arg3"]);
	});

	it("should parse boolean flags", () => {
		const result = parseArguments(["--flag", "--another-flag"]);
		expect(result.flag).toBe(true);
		expect(result["another-flag"]).toBe(true);
	});

	it("should parse negated boolean flags", () => {
		const result = parseArguments(["--no-flag", "--no-another-flag"]);
		expect(result.flag).toBe(false);
		expect(result["another-flag"]).toBe(false);
	});

	it("should parse key-value with equals", () => {
		const result = parseArguments(["--key=value", "--number=42"]);
		expect(result.key).toBe("value");
		expect(result.number).toBe(42);
	});

	it("should parse key-value with space", () => {
		const result = parseArguments(["--key", "value", "--number", "42"]);
		expect(result.key).toBe("value");
		expect(result.number).toBe(42);
	});

	it("should parse short flags", () => {
		const result = parseArguments(["-f", "-v", "-o", "output.txt"]);
		expect(result.f).toBe(true);
		expect(result.v).toBe(true);
		expect(result.o).toBe("output.txt");
	});

	it("should parse mixed positional and named args", () => {
		const result = parseArguments(["input.txt", "--format", "json", "output.txt"]);
		expect(result._).toEqual(["input.txt", "output.txt"]);
		expect(result.format).toBe("json");
	});

	it("should parse numbers correctly", () => {
		const result = parseArguments(["--int=42", "--float=3.14", "--negative=-10"]);
		expect(result.int).toBe(42);
		expect(result.float).toBe(3.14);
		expect(result.negative).toBe(-10);
	});

	it("should parse boolean values", () => {
		const result = parseArguments(["--yes=true", "--no=false"]);
		expect(result.yes).toBe(true);
		expect(result.no).toBe(false);
	});

	it("should handle equals signs in values", () => {
		const result = parseArguments(["--url=https://example.com?foo=bar"]);
		expect(result.url).toBe("https://example.com?foo=bar");
	});

	it("should handle empty args", () => {
		const result = parseArguments([]);
		expect(result._).toEqual([]);
	});
});

describe("getRequired", () => {
	it("should return required string argument", () => {
		const arguments_ = parseArguments(["--name", "test"]);
		expect(getRequired(arguments_, "name")).toBe("test");
	});

	it("should throw if required argument missing", () => {
		const arguments_ = parseArguments([]);
		expect(() => getRequired(arguments_, "name")).toThrow("Missing required argument: --name");
	});

	it("should throw if argument is not a string", () => {
		const arguments_ = parseArguments(["--count", "42"]);
		expect(() => getRequired(arguments_, "count")).toThrow("Argument --count must be a string");
	});
});

describe("getOptional", () => {
	it("should return optional argument if present", () => {
		const arguments_ = parseArguments(["--name", "test"]);
		expect(getOptional(arguments_, "name", "default")).toBe("test");
	});

	it("should return default if argument missing", () => {
		const arguments_ = parseArguments([]);
		expect(getOptional(arguments_, "name", "default")).toBe("default");
	});
});

describe("getNumber", () => {
	it("should return numeric argument", () => {
		const arguments_ = parseArguments(["--count", "42"]);
		expect(getNumber(arguments_, "count")).toBe(42);
	});

	it("should return default if argument missing", () => {
		const arguments_ = parseArguments([]);
		expect(getNumber(arguments_, "count", 10)).toBe(10);
	});

	it("should throw if required numeric argument missing", () => {
		const arguments_ = parseArguments([]);
		expect(() => getNumber(arguments_, "count")).toThrow("Missing required numeric argument: --count");
	});

	it("should throw if argument is not a number", () => {
		const arguments_ = parseArguments(["--count", "abc"]);
		expect(() => getNumber(arguments_, "count")).toThrow("Argument --count must be a number");
	});
});

describe("getBoolean", () => {
	it("should return boolean argument", () => {
		const arguments_ = parseArguments(["--verbose"]);
		expect(getBoolean(arguments_, "verbose")).toBe(true);
	});

	it("should return false for negated flag", () => {
		const arguments_ = parseArguments(["--no-verbose"]);
		expect(getBoolean(arguments_, "verbose")).toBe(false);
	});

	it("should return default if argument missing", () => {
		const arguments_ = parseArguments([]);
		expect(getBoolean(arguments_, "verbose", false)).toBe(false);
		expect(getBoolean(arguments_, "verbose", true)).toBe(true);
	});

	it("should throw if argument is not a boolean", () => {
		const arguments_ = parseArguments(["--verbose", "yes"]);
		expect(() => getBoolean(arguments_, "verbose")).toThrow("Argument --verbose must be a boolean");
	});
});
