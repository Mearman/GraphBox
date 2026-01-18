/**
 * Simple argument parser for CLI commands.
 *
 * Provides parsing for common CLI patterns:
 * - Flags: --flag, --no-flag
 * - Key-value: --key=value, --key value
 * - Positional arguments
 */

export interface ParsedArguments {
	/** Positional arguments */
	_: string[];

	/** Named arguments and flags */
	[key: string]: unknown;
}

/** @deprecated Use ParsedArguments instead */
export type ParsedArgs = ParsedArguments;

/**
 * Parse command-line arguments.
 * @param args
 * @param arguments_
 */
export const parseArgs = (arguments_: string[]): ParsedArguments => {
	const result: ParsedArguments = { _: [] };
	let index = 0;

	while (index < arguments_.length) {
		const argument = arguments_[index];

		if (argument.startsWith("--")) {
			// Long flag: --key or --key=value or --no-key
			const withoutDashes = argument.slice(2);

			if (withoutDashes.includes("=")) {
				// --key=value format
				const [key, ...valueParts] = withoutDashes.split("=");
				result[key] = parseValue(valueParts.join("="));
				index++;
			} else if (withoutDashes.startsWith("no-")) {
				// --no-key format (boolean false)
				const key = withoutDashes.slice(3);
				result[key] = false;
				index++;
			} else {
				// --key or --key value format
				const key = withoutDashes;

				// Check if next arg is a value (not a flag)
				if (index + 1 < arguments_.length && !arguments_[index + 1].startsWith("-")) {
					result[key] = parseValue(arguments_[index + 1]);
					index += 2;
				} else {
					// Boolean flag
					result[key] = true;
					index++;
				}
			}
		} else if (argument.startsWith("-") && argument.length > 1) {
			// Short flag: -x or -x value
			const key = argument.slice(1);

			// Check if next arg is a value
			if (index + 1 < arguments_.length && !arguments_[index + 1].startsWith("-")) {
				result[key] = parseValue(arguments_[index + 1]);
				index += 2;
			} else {
				// Boolean flag
				result[key] = true;
				index++;
			}
		} else {
			// Positional argument
			result._.push(argument);
			index++;
		}
	}

	return result;
};

/**
 * Parse a value string to its appropriate type.
 * @param value
 */
const parseValue = (value: string): string | number | boolean => {
	// Boolean
	if (value === "true") return true;
	if (value === "false") return false;

	// Number
	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}
	if (/^-?\d*\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	// String
	return value;
};

/**
 * Get required argument or throw error.
 * @param args
 * @param arguments_
 * @param key
 */
export const getRequired = (arguments_: ParsedArguments, key: string): string => {
	const value = arguments_[key];
	if (value === undefined) {
		throw new Error(`Missing required argument: --${key}`);
	}
	if (typeof value !== "string") {
		throw new TypeError(`Argument --${key} must be a string`);
	}
	return value;
};

/**
 * Get optional argument with default.
 * @param args
 * @param arguments_
 * @param key
 * @param defaultValue
 */
export function getOptional<T>(
	arguments_: ParsedArguments,
	key: string
): T | undefined;
export function getOptional<T>(
	arguments_: ParsedArguments,
	key: string,
	defaultValue: T
): T;
export function getOptional<T>(
	arguments_: ParsedArguments,
	key: string,
	defaultValue?: T
): T | undefined {
	const value = arguments_[key];
	return value === undefined ? defaultValue : (value as T);
}

/**
 * Get numeric argument.
 * @param args
 * @param arguments_
 * @param key
 * @param defaultValue
 */
export const getNumber = (
	arguments_: ParsedArguments,
	key: string,
	defaultValue?: number
): number => {
	const value = arguments_[key];
	if (value === undefined) {
		if (defaultValue === undefined) {
			throw new Error(`Missing required numeric argument: --${key}`);
		}
		return defaultValue;
	}
	if (typeof value !== "number") {
		throw new TypeError(`Argument --${key} must be a number`);
	}
	return value;
};

/**
 * Get boolean argument.
 * @param args
 * @param arguments_
 * @param key
 * @param defaultValue
 */
export const getBoolean = (
	arguments_: ParsedArguments,
	key: string,
	defaultValue = false
): boolean => {
	const value = arguments_[key];
	if (value === undefined) return defaultValue;
	if (typeof value !== "boolean") {
		throw new TypeError(`Argument --${key} must be a boolean`);
	}
	return value;
};
