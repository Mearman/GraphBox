/**
 * Unit tests for LaTeX renderer
 */

import { describe, expect, it } from "vitest";

import { createMockAggregate, createMockClaimEvaluation, createMockSummaryStats } from "../__tests__/test-helpers.js";
import { escapeLatex, LaTeXRenderer } from "./latex-renderer.js";
import type { TableRenderSpec } from "./types.js";

describe("escapeLatex", () => {
	it("should escape backslash", () => {
		const result = escapeLatex(String.raw`path\to\file`);

		expect(result).toContain("textbackslash");
	});

	it("should escape ampersand", () => {
		const result = escapeLatex("A & B");

		expect(result).toBe(String.raw`A \& B`);
	});

	it("should escape percent", () => {
		const result = escapeLatex("50%");

		expect(result).toBe(String.raw`50\%`);
	});

	it("should escape dollar sign", () => {
		const result = escapeLatex("$100");

		expect(result).toBe(String.raw`\$100`);
	});

	it("should escape hash", () => {
		const result = escapeLatex("#1");

		expect(result).toBe(String.raw`\#1`);
	});

	it("should escape underscore", () => {
		const result = escapeLatex("snake_case");

		expect(result).toBe(String.raw`snake\_case`);
	});

	it("should escape curly braces", () => {
		const result = escapeLatex("{test}");

		expect(result).toBe(String.raw`\{test\}`);
	});

	it("should escape tilde", () => {
		const result = escapeLatex("~approx");

		expect(result).toContain("textasciitilde");
	});

	it("should escape caret", () => {
		const result = escapeLatex("x^2");

		expect(result).toContain("textasciicircum");
	});

	it("should handle multiple special characters", () => {
		const result = escapeLatex("A & B % C $ D # E _ F { G }");

		// Verify each special character is properly escaped
		expect(result).toContain(String.raw`\&`);
		expect(result).toContain(String.raw`\%`);
		expect(result).toContain(String.raw`\$`);
		expect(result).toContain(String.raw`\#`);
		expect(result).toContain(String.raw`\_`);
		expect(result).toContain(String.raw`\{`);
		expect(result).toContain(String.raw`\}`);
	});

	it("should handle empty string", () => {
		const result = escapeLatex("");

		expect(result).toBe("");
	});

	it("should handle string with no special characters", () => {
		const result = escapeLatex("Hello World");

		expect(result).toBe("Hello World");
	});
});

describe("LaTeXRenderer", () => {
	describe("formatNumber", () => {
		it("should format with default decimals (2)", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatNumber(123.456)).toBe("123.46");
		});

		it("should format with custom decimals", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatNumber(123.456, 1)).toBe("123.5");
			expect(renderer.formatNumber(123.456, 4)).toBe("123.4560");
		});

		it("should return '--' for NaN", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatNumber(Number.NaN)).toBe("--");
		});

		it("should return '--' for Infinity", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatNumber(Infinity)).toBe("--");
			expect(renderer.formatNumber(-Infinity)).toBe("--");
		});

		it("should respect custom default decimals", () => {
			const renderer = new LaTeXRenderer({ defaultDecimals: 3 });

			expect(renderer.formatNumber(123.456_789)).toBe("123.457");
		});
	});

	describe("formatSpeedup", () => {
		it(String.raw`should format as $N.NN\times$`, () => {
			const renderer = new LaTeXRenderer();
			const result = renderer.formatSpeedup(2.5);

			expect(result).toBe(String.raw`$2.50\times$`);
		});

		it("should handle small speedups", () => {
			const renderer = new LaTeXRenderer();
			const result = renderer.formatSpeedup(0.5);

			expect(result).toBe(String.raw`$0.50\times$`);
		});

		it("should return '--' for non-finite values", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatSpeedup(Infinity)).toBe("--");
			expect(renderer.formatSpeedup(Number.NaN)).toBe("--");
		});
	});

	describe("formatPercentage", () => {
		it("should format as rounded percentage", () => {
			const renderer = new LaTeXRenderer();
			const result = renderer.formatPercentage(95.5);

			expect(result).toBe(String.raw`96\%`);
		});

		it("should return '--' for non-finite values", () => {
			const renderer = new LaTeXRenderer();

			expect(renderer.formatPercentage(Number.NaN)).toBe("--");
		});
	});

	describe("renderTable", () => {
		it("should produce valid LaTeX table structure", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [
				createMockAggregate("sut-a", "primary", undefined, {
					"execution-time": createMockSummaryStats([100, 110, 105]),
				}),
			];

			const spec: TableRenderSpec = {
				id: "test-table",
				filename: "test-table.tex",
				label: "tab:test",
				caption: "Test Table",
				columns: [
					{ key: "sut", header: "SUT", align: "l" },
					{ key: "time", header: "Time (ms)", align: "r" },
				],
				extractData: (aggs) =>
					aggs.map((a) => ({
						sut: a.sut,
						time: a.metrics["execution-time"]?.mean ?? 0,
					})),
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.id).toBe("test-table");
			expect(output.filename).toBe("test-table.tex");
			expect(output.format).toBe("latex");
			expect(output.content).toContain(String.raw`\begin{table}`);
			expect(output.content).toContain(String.raw`\end{table}`);
			expect(output.content).toContain(String.raw`\caption{Test Table}`);
			expect(output.content).toContain(String.raw`\label{tab:test}`);
			expect(output.content).toContain(String.raw`\begin{tabular}{lr}`);
		});

		it("should apply column formatting", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [
				createMockAggregate("sut-a", "primary", undefined, {
					"execution-time": createMockSummaryStats([100, 100, 100]),
				}),
			];

			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Test",
				columns: [
					{ key: "sut", header: "SUT", align: "l" },
					{
						key: "time",
						header: "Time",
						align: "r",
						format: (v) => `${(v as number).toFixed(0)}ms`,
					},
				],
				extractData: (aggs) =>
					aggs.map((a) => ({
						sut: a.sut,
						time: a.metrics["execution-time"]?.mean ?? 0,
					})),
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.content).toContain("100ms");
		});

		it("should substitute caption placeholders", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [
				createMockAggregate("sut-a", "primary", undefined, {
					"execution-time": createMockSummaryStats([50]),
				}),
				createMockAggregate("sut-b", "baseline", undefined, {
					"execution-time": createMockSummaryStats([100]),
				}),
			];

			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Speedup: {SPEEDUP}x",
				columns: [{ key: "sut", header: "SUT", align: "l" }],
				extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
				captionPlaceholders: {
					SPEEDUP: () => "2.00",
				},
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.content).toContain("Speedup: 2.00x");
		});

		it("should use booktabs rules by default", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [createMockAggregate("sut", "primary")];
			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Test",
				columns: [{ key: "sut", header: "SUT", align: "l" }],
				extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.content).toContain(String.raw`\toprule`);
			expect(output.content).toContain(String.raw`\midrule`);
			expect(output.content).toContain(String.raw`\bottomrule`);
		});

		it("should use hline when booktabs disabled", () => {
			const renderer = new LaTeXRenderer({ booktabs: false });

			const aggregates = [createMockAggregate("sut", "primary")];
			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Test",
				columns: [{ key: "sut", header: "SUT", align: "l" }],
				extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.content).toContain(String.raw`\hline`);
			expect(output.content).not.toContain(String.raw`\toprule`);
		});

		it("should apply sorting", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [
				createMockAggregate("sut-c", "primary"),
				createMockAggregate("sut-a", "primary"),
				createMockAggregate("sut-b", "primary"),
			];

			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Test",
				columns: [{ key: "sut", header: "SUT", align: "l" }],
				extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
				sort: (a, b) => (a.sut as string).localeCompare(b.sut as string),
			};

			const output = renderer.renderTable(aggregates, spec);

			// Verify sorted order in output
			const sutAIndex = output.content.indexOf("sut-a");
			const sutBIndex = output.content.indexOf("sut-b");
			const sutCIndex = output.content.indexOf("sut-c");

			expect(sutAIndex).toBeLessThan(sutBIndex);
			expect(sutBIndex).toBeLessThan(sutCIndex);
		});

		it("should handle bold columns", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [createMockAggregate("sut", "primary")];
			const spec: TableRenderSpec = {
				id: "test",
				filename: "test.tex",
				label: "tab:test",
				caption: "Test",
				columns: [{ key: "sut", header: "SUT", align: "l", bold: true }],
				extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
			};

			const output = renderer.renderTable(aggregates, spec);

			expect(output.content).toContain(String.raw`\textbf{`);
		});
	});

	describe("renderAll", () => {
		it("should render multiple tables", () => {
			const renderer = new LaTeXRenderer();

			const aggregates = [createMockAggregate("sut", "primary")];
			const specs: TableRenderSpec[] = [
				{
					id: "table-1",
					filename: "table-1.tex",
					label: "tab:1",
					caption: "Table 1",
					columns: [{ key: "sut", header: "SUT", align: "l" }],
					extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
				},
				{
					id: "table-2",
					filename: "table-2.tex",
					label: "tab:2",
					caption: "Table 2",
					columns: [{ key: "sut", header: "SUT", align: "l" }],
					extractData: (aggs) => aggs.map((a) => ({ sut: a.sut })),
				},
			];

			const outputs = renderer.renderAll(aggregates, specs);

			expect(outputs).toHaveLength(2);
			expect(outputs[0].id).toBe("table-1");
			expect(outputs[1].id).toBe("table-2");
		});
	});

	describe("renderClaimSummary", () => {
		it("should render claim status table", () => {
			const renderer = new LaTeXRenderer();

			const evaluations = [
				createMockClaimEvaluation("satisfied", { claimId: "C001", description: "Faster execution" }),
				createMockClaimEvaluation("violated", { claimId: "C002", description: "Better diversity" }),
				createMockClaimEvaluation("inconclusive", { claimId: "C003", description: "Missing data" }),
			];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.id).toBe("claim-summary");
			expect(output.filename).toBe("claim-summary.tex");
			expect(output.format).toBe("latex");
			expect(output.content).toContain(String.raw`\begin{table}`);
			expect(output.content).toContain("Claim");
			expect(output.content).toContain("Status");
		});

		it("should include counts in caption", () => {
			const renderer = new LaTeXRenderer();

			const evaluations = [
				createMockClaimEvaluation("satisfied"),
				createMockClaimEvaluation("satisfied"),
				createMockClaimEvaluation("violated"),
				createMockClaimEvaluation("inconclusive"),
			];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.content).toContain("2 satisfied");
			expect(output.content).toContain("1 violated");
			expect(output.content).toContain("1 inconclusive");
		});

		it("should use custom claim status symbols", () => {
			const renderer = new LaTeXRenderer({
				claimStatus: {
					satisfied: "OK",
					violated: "FAIL",
					inconclusive: "N/A",
				},
			});

			const evaluations = [createMockClaimEvaluation("satisfied")];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.content).toContain("$OK$");
		});

		it("should escape special characters in descriptions", () => {
			const renderer = new LaTeXRenderer();

			const evaluations = [
				createMockClaimEvaluation("satisfied", {
					claimId: "C_001",
					description: "Test with & special % chars",
				}),
			];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.content).toContain(String.raw`C\_001`);
			expect(output.content).toContain(String.raw`\&`);
			expect(output.content).toContain(String.raw`\%`);
		});

		it("should handle empty evaluations", () => {
			const renderer = new LaTeXRenderer();

			const output = renderer.renderClaimSummary([]);

			expect(output.content).toContain("0 satisfied");
			expect(output.content).toContain("0 violated");
			expect(output.content).toContain("0 inconclusive");
		});

		it("should format delta and p-value correctly", () => {
			const renderer = new LaTeXRenderer();

			const evaluations = [
				createMockClaimEvaluation("satisfied", undefined, {
					delta: -40.5,
					pValue: 0.0123,
				}),
			];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.content).toContain("-40.500"); // 3 decimals for delta
			expect(output.content).toContain("0.0123"); // 4 decimals for p-value
		});

		it("should show '--' for undefined p-value", () => {
			const renderer = new LaTeXRenderer();

			const evaluations = [
				createMockClaimEvaluation("satisfied", undefined, {
					delta: -40,
					pValue: undefined,
				}),
			];

			const output = renderer.renderClaimSummary(evaluations);

			expect(output.content).toContain("--");
		});
	});
});
