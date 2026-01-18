/**
 * Auto-detection of graph file formats.
 *
 * Supports: JSON, GML, Pajek (.net), SNAP (.edges, .txt), UCINET (.dl)
 */

export type GraphFormat = "json" | "gml" | "pajek" | "snap" | "ucinet";

/**
 * Detect format from file extension.
 * @param filename
 */
export const detectFormatFromExtension = (filename: string): GraphFormat | null => {
	const extension = filename.toLowerCase().split(".").pop();

	switch (extension) {
		case "json": {
			return "json";
		}
		case "gml": {
			return "gml";
		}
		case "net": {
			return "pajek";
		}
		case "edges":
		case "txt": {
			return "snap";
		}
		case "dl": {
			return "ucinet";
		}
		default: {
			return null;
		}
	}
};

/**
 * Detect format from file content.
 * Examines the first few lines to identify the format.
 * @param content
 */
export const detectFormatFromContent = (content: string): GraphFormat | null => {
	const trimmed = content.trim();
	const firstLines = trimmed.split("\n").slice(0, 10);
	const firstNonEmpty = firstLines.find(line => line.trim().length > 0) ?? "";

	// JSON: starts with { or [
	if (firstNonEmpty.startsWith("{") || firstNonEmpty.startsWith("[")) {
		try {
			JSON.parse(trimmed);
			return "json";
		} catch {
			// Not valid JSON
		}
	}

	// GML: contains "graph [" or starts with "Creator"
	if (
		trimmed.includes("graph [") ||
		trimmed.includes("graph[") ||
		firstNonEmpty.toLowerCase().startsWith("creator")
	) {
		return "gml";
	}

	// Pajek: starts with *Vertices or *vertices
	if (/^\*vertices/i.test(firstNonEmpty)) {
		return "pajek";
	}

	// UCINET: starts with dl or DL
	if (/^dl\s/i.test(firstNonEmpty)) {
		return "ucinet";
	}

	// SNAP: simple edge list format (two integers per line)
	// Check if first few lines look like "source target" format
	const nonCommentLines = firstLines
		.filter(line => line.trim().length > 0 && !line.trim().startsWith("#"))
		.slice(0, 5);

	const looksLikeSNAP = nonCommentLines.length > 0 && nonCommentLines
		.every(line => {
			const parts = line.trim().split(/\s+/);
			return parts.length >= 2 && parts.every(p => /^\d+$/.test(p));
		});

	if (looksLikeSNAP) {
		return "snap";
	}

	return null;
};

/**
 * Detect format from filename and optionally content.
 * Tries extension first, then falls back to content analysis.
 * @param filename
 * @param content
 */
export const detectFormat = (filename: string, content?: string): GraphFormat | null => {
	// Try extension first
	const extensionFormat = detectFormatFromExtension(filename);
	if (extensionFormat !== null) {
		return extensionFormat;
	}

	// Fall back to content if provided
	if (content !== undefined) {
		return detectFormatFromContent(content);
	}

	return null;
};
