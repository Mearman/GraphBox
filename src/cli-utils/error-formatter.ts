/**
 * User-friendly error formatting for CLI.
 *
 * Provides helpful error messages with context and suggestions.
 */

export interface FormattedError {
	/** The error message */
	message: string;

	/** Optional suggestion for fixing the error */
	suggestion?: string;

	/** Exit code to use */
	exitCode: number;
}

/**
 * Format an error for CLI output.
 * @param error
 */
export const formatError = (error: unknown): FormattedError => {
	if (error instanceof Error) {
		return formatKnownError(error);
	}

	if (typeof error === "string") {
		return {
			message: error,
			exitCode: 1,
		};
	}

	return {
		message: "An unknown error occurred",
		exitCode: 1,
	};
};

/**
 * Format known error types with helpful messages.
 * @param error
 */
const formatKnownError = (error: Error): FormattedError => {
	const message = error.message;

	// File not found
	if (message.includes("ENOENT") || message.includes("no such file")) {
		return {
			message: `File not found: ${extractFilePath(message)}`,
			suggestion: "Check that the file path is correct and the file exists",
			exitCode: 1,
		};
	}

	// Parse errors
	if (message.includes("Unexpected token") || message.includes("JSON")) {
		return {
			message: `Failed to parse file: ${message}`,
			suggestion: "Check that the file is valid JSON or the correct format",
			exitCode: 1,
		};
	}

	// Format detection errors
	if (message.includes("Could not detect")) {
		return {
			message: message,
			suggestion: "Specify the format explicitly with --format (json|gml|pajek|snap|ucinet)",
			exitCode: 1,
		};
	}

	// Validation errors
	if (message.includes("invalid") || message.includes("Invalid")) {
		return {
			message: message,
			exitCode: 1,
		};
	}

	// Default
	return {
		message: message,
		exitCode: 1,
	};
};

/**
 * Extract file path from error message.
 * @param message
 */
const extractFilePath = (message: string): string => {
	const match = /['"]([^'"]+)['"]/.exec(message);
	return match?.[1] ?? "unknown file";
};

/**
 * Format validation errors with details.
 * @param errors
 */
export const formatValidationErrors = (
	errors: Array<{ property: string; message: string }>
): FormattedError => {
	const errorList = errors
		.map(error => `  - ${error.property}: ${error.message}`)
		.join("\n");

	return {
		message: `Validation failed:\n${errorList}`,
		exitCode: 1,
	};
};
