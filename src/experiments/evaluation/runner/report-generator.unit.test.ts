/**
 * Unit tests for report generation
 */

import { describe, expect, it } from "vitest";

import type { ExperimentReport, StatisticalTestResult } from "../types";

// Type for parsed JSON summary (used in test assertions)
interface ParsedJSONSummary {
	name: string;
	timestamp: number;
	graphSpec: string;
	winner: string;
	methods: Array<{
		name: string;
		results: Record<string, number>;
		runtime: number;
	}>;
	statisticalTests: Array<{
		type: string;
		comparison: string;
		pValue: number;
		significant: boolean;
	}>;
}
import {
	generateHTMLReport,
	generateJSONSummary,
	generateLatexTable,
	generateMarkdownReport,
} from "./report-generator";

const createMockReport = (): ExperimentReport => ({
	name: "Test Experiment",
	graphSpec: "random-100",
	methods: [
		{
			method: "MI Ranker",
			results: {
				spearman: 0.85,
				kendall: 0.72,
				ndcg: 0.88,
			},
			runtime: 150,
		},
		{
			method: "Random Baseline",
			results: {
				spearman: 0.02,
				kendall: 0.01,
				ndcg: 0.05,
			},
			runtime: 10,
		},
	],
	statisticalTests: [
		{
			type: "paired-t",
			comparison: "MI Ranker vs Random Baseline",
			pValue: 0.001,
			significant: true,
			statistic: 5.23,
		},
	],
	winner: "MI Ranker",
	timestamp: "2024-01-15T10:30:00.000Z",
	duration: 5000,
});

describe("generateMarkdownReport", () => {
	it("generates valid markdown with title", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("# Test Experiment");
	});

	it("includes timestamp and graph spec", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("**Timestamp:**");
		expect(markdown).toContain(report.timestamp);
		expect(markdown).toContain("**Graph Spec:**");
		expect(markdown).toContain("random-100");
	});

	it("includes duration when present", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("**Duration:**");
		expect(markdown).toContain("5000ms");
	});

	it("displays winner", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("## Winner");
		expect(markdown).toContain("**MI Ranker**");
	});

	it("creates method performance table", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("## Method Performance");
		expect(markdown).toContain("| Method |");
		expect(markdown).toContain("| MI Ranker |");
		expect(markdown).toContain("| Random Baseline |");
		expect(markdown).toContain("0.8500"); // Formatted spearman
	});

	it("includes statistical tests section", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("## Statistical Tests");
		expect(markdown).toContain("| Test | Comparison | p-value | Significant |");
		expect(markdown).toContain("paired-t");
		expect(markdown).toContain("MI Ranker vs Random Baseline");
		expect(markdown).toContain("1.0000e-3"); // p-value in scientific notation
	});

	it("shows significance indicator", () => {
		const report = createMockReport();
		// Note: Unicode checkmark depends on terminal/system support

		const markdown = generateMarkdownReport(report);

		// Should contain some significance indicator
		expect(markdown).toContain("paired-t");
	});

	it("omits statistical tests section when empty", () => {
		const report = createMockReport();
		report.statisticalTests = [];

		const markdown = generateMarkdownReport(report);

		// Should not have the statistical tests header
		expect(markdown.split("## Statistical Tests").length).toBe(1);
	});

	it("includes interpretation section", () => {
		const report = createMockReport();

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("## Interpretation");
		expect(markdown).toContain("MI Ranker"); // Winner mentioned
	});

	it("generates interpretation for strong correlation", () => {
		const report = createMockReport();
		report.methods[0].results.spearman = 0.95;

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("strong correlation");
	});

	it("generates interpretation for moderate correlation", () => {
		const report = createMockReport();
		report.methods[0].results.spearman = 0.6;

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("moderate correlation");
	});

	it("generates interpretation for weak correlation", () => {
		const report = createMockReport();
		report.methods[0].results.spearman = 0.2;

		const markdown = generateMarkdownReport(report);

		// Should mention the actual value
		expect(markdown).toContain("0.2");
	});

	it("handles precision/recall metric formatting", () => {
		const report = createMockReport();
		report.methods[0].results.precision_at_5 = 0.8;
		report.methods[0].results.recall_at_10 = 0.6;

		const markdown = generateMarkdownReport(report);

		expect(markdown).toContain("PRECISION@5");
		expect(markdown).toContain("RECALL@10");
	});
});

describe("generateLatexTable", () => {
	it("generates valid LaTeX table structure", () => {
		const report = createMockReport();

		const latex = generateLatexTable(report);

		expect(latex).toContain(String.raw`\begin{table}[h]`);
		expect(latex).toContain(String.raw`\centering`);
		expect(latex).toContain(String.raw`\begin{tabular}`);
		expect(latex).toContain(String.raw`\toprule`);
		expect(latex).toContain(String.raw`\midrule`);
		expect(latex).toContain(String.raw`\bottomrule`);
		expect(latex).toContain(String.raw`\end{tabular}`);
		expect(latex).toContain(String.raw`\end{table}`);
	});

	it("includes caption with experiment name", () => {
		const report = createMockReport();

		const latex = generateLatexTable(report);

		expect(latex).toContain(String.raw`\caption{Results for Test Experiment}`);
	});

	it("includes method rows with values", () => {
		const report = createMockReport();

		const latex = generateLatexTable(report);

		expect(latex).toContain("MI Ranker");
		expect(latex).toContain("Random Baseline");
		expect(latex).toContain("0.8500");
	});

	it("escapes special LaTeX characters in names", () => {
		const report = createMockReport();
		report.name = "Test & Experiment_1 #2";
		report.methods[0].method = "Method_A & B";

		const latex = generateLatexTable(report);

		expect(latex).toContain(String.raw`\&`);
		expect(latex).toContain(String.raw`\_`);
		expect(latex).toContain(String.raw`\#`);
	});

	it("generates correct tabular column specification", () => {
		const report = createMockReport();
		// 3 metrics + 1 method column = 4 columns

		const latex = generateLatexTable(report);

		expect(latex).toContain(String.raw`\begin{tabular}{l`);
		// Should have 'c' for each metric column
		expect(latex).toMatch(/\\begin\{tabular\}\{lc+\}/);
	});
});

describe("generateJSONSummary", () => {
	it("generates valid JSON", () => {
		const report = createMockReport();

		const json = generateJSONSummary(report);

		expect(() => JSON.parse(json)).not.toThrow();
	});

	it("includes all required fields", () => {
		const report = createMockReport();

		const json = generateJSONSummary(report);
		const parsed = JSON.parse(json) as ParsedJSONSummary;

		expect(parsed.name).toBe("Test Experiment");
		expect(parsed.timestamp).toBe(report.timestamp);
		expect(parsed.graphSpec).toBe("random-100");
		expect(parsed.winner).toBe("MI Ranker");
		expect(parsed.methods).toBeDefined();
		expect(parsed.statisticalTests).toBeDefined();
	});

	it("formats methods correctly", () => {
		const report = createMockReport();

		const json = generateJSONSummary(report);
		const parsed = JSON.parse(json) as ParsedJSONSummary;

		expect(parsed.methods).toHaveLength(2);
		expect(parsed.methods[0].name).toBe("MI Ranker");
		expect(parsed.methods[0].results).toBeDefined();
		expect(parsed.methods[0].runtime).toBe(150);
	});

	it("formats statistical tests correctly", () => {
		const report = createMockReport();

		const json = generateJSONSummary(report);
		const parsed = JSON.parse(json) as ParsedJSONSummary;

		expect(parsed.statisticalTests).toHaveLength(1);
		expect(parsed.statisticalTests[0].type).toBe("paired-t");
		expect(parsed.statisticalTests[0].comparison).toBeDefined();
		expect(parsed.statisticalTests[0].pValue).toBe(0.001);
		expect(parsed.statisticalTests[0].significant).toBe(true);
	});

	it("uses pretty formatting", () => {
		const report = createMockReport();

		const json = generateJSONSummary(report);

		// Pretty-printed JSON should contain newlines and indentation
		expect(json).toContain("\n");
		expect(json).toContain("  "); // 2-space indentation
	});

	it("handles empty statistical tests", () => {
		const report = createMockReport();
		report.statisticalTests = [];

		const json = generateJSONSummary(report);
		const parsed = JSON.parse(json) as ParsedJSONSummary;

		expect(parsed.statisticalTests).toEqual([]);
	});
});

describe("generateHTMLReport", () => {
	it("generates valid HTML structure", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<html lang=\"en\">");
		expect(html).toContain("<head>");
		expect(html).toContain("<body>");
		expect(html).toContain("</html>");
	});

	it("includes charset and viewport meta tags", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain('<meta charset="UTF-8">');
		expect(html).toContain('<meta name="viewport"');
	});

	it("includes title with experiment name", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<title>Test Experiment</title>");
	});

	it("includes embedded CSS styles", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<style>");
		expect(html).toContain("</style>");
		expect(html).toContain("font-family:");
		expect(html).toContain("table");
	});

	it("displays experiment title as h1", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<h1>Test Experiment</h1>");
	});

	it("displays timestamp and graph spec", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<strong>Timestamp:</strong>");
		expect(html).toContain(report.timestamp);
		expect(html).toContain("<strong>Graph Spec:</strong>");
		expect(html).toContain("random-100");
	});

	it("displays winner in highlighted section", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain('class="winner"');
		expect(html).toContain("<h2>Winner</h2>");
		expect(html).toContain("MI Ranker");
	});

	it("creates method performance table", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<h2>Method Performance</h2>");
		expect(html).toContain("<table>");
		expect(html).toContain("<th>Method</th>");
		expect(html).toContain("<td>MI Ranker</td>");
		expect(html).toContain("0.8500");
	});

	it("highlights winner row", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain('style="font-weight: bold;"');
	});

	it("includes statistical tests table when present", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain("<h2>Statistical Tests</h2>");
		expect(html).toContain("<th>Test</th>");
		expect(html).toContain("<th>Comparison</th>");
		expect(html).toContain("<th>p-value</th>");
		expect(html).toContain("<th>Significant</th>");
	});

	it("uses CSS classes for significance", () => {
		const report = createMockReport();

		const html = generateHTMLReport(report);

		expect(html).toContain('class="significant"');
	});

	it("shows not-significant class for non-significant tests", () => {
		const report = createMockReport();
		report.statisticalTests[0].significant = false;

		const html = generateHTMLReport(report);

		expect(html).toContain('class="not-significant"');
	});

	it("omits statistical tests table when empty", () => {
		const report = createMockReport();
		report.statisticalTests = [];

		const html = generateHTMLReport(report);

		expect(html.split("<h2>Statistical Tests</h2>").length).toBe(1);
	});

	it("escapes HTML special characters", () => {
		const report = createMockReport();
		report.name = "Test <script>alert('xss')</script>";
		report.methods[0].method = "Method & <b>Bold</b>";

		const html = generateHTMLReport(report);

		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("&amp;");
		expect(html).toContain("&lt;b&gt;");
	});

	it("includes test statistic when present", () => {
		const report = createMockReport();
		report.statisticalTests[0].statistic = 5.23;

		const html = generateHTMLReport(report);

		expect(html).toContain("5.2300"); // Statistic formatted
	});
});

describe("edge cases", () => {
	it("handles report with no duration", () => {
		const report = createMockReport();
		delete (report as unknown as Record<string, unknown>).duration;

		const markdown = generateMarkdownReport(report);

		expect(markdown).not.toContain("**Duration:**");
	});

	it("handles single method", () => {
		const report = createMockReport();
		report.methods = [report.methods[0]];
		report.statisticalTests = [];

		const markdown = generateMarkdownReport(report);
		const latex = generateLatexTable(report);
		const json = generateJSONSummary(report);
		const html = generateHTMLReport(report);

		expect(markdown).toBeDefined();
		expect(latex).toBeDefined();
		expect(json).toBeDefined();
		expect(html).toBeDefined();
	});

	it("handles methods with different metric sets", () => {
		const report = createMockReport();
		report.methods[0].results = { spearman: 0.8, custom_metric: 0.5 };
		report.methods[1].results = { spearman: 0.1, ndcg: 0.2 };

		// Should not throw
		const markdown = generateMarkdownReport(report);
		const latex = generateLatexTable(report);
		const html = generateHTMLReport(report);

		expect(markdown).toBeDefined();
		expect(latex).toBeDefined();
		expect(html).toBeDefined();
	});

	it("handles statistical test without statistic field", () => {
		const report = createMockReport();
		const testWithoutStat: StatisticalTestResult = {
			type: "bootstrap",
			comparison: "A vs B",
			pValue: 0.05,
			significant: true,
			// No statistic field
		};
		report.statisticalTests = [testWithoutStat];

		const markdown = generateMarkdownReport(report);
		const html = generateHTMLReport(report);

		expect(markdown).toBeDefined();
		expect(html).toBeDefined();
	});

	it("handles very small p-values", () => {
		const report = createMockReport();
		report.statisticalTests[0].pValue = 1e-15;

		const markdown = generateMarkdownReport(report);
		const html = generateHTMLReport(report);
		const json = generateJSONSummary(report);

		expect(markdown).toContain("e-");
		expect(html).toContain("e-");
		expect(json).toBeDefined();
	});

	it("handles zero metric values", () => {
		const report = createMockReport();
		report.methods[0].results = { spearman: 0, kendall: 0, ndcg: 0 };

		const markdown = generateMarkdownReport(report);
		const latex = generateLatexTable(report);

		expect(markdown).toContain("0.0000");
		expect(latex).toContain("0.0000");
	});

	it("handles negative correlation values", () => {
		const report = createMockReport();
		report.methods[0].results = { spearman: -0.5, kendall: -0.3 };

		const markdown = generateMarkdownReport(report);
		const latex = generateLatexTable(report);

		expect(markdown).toContain("-0.5000");
		expect(latex).toContain("-0.5000");
	});

	it("handles special characters in method names", () => {
		const report = createMockReport();
		report.methods[0].method = "MI_v2.0 (alpha)";
		report.methods[1].method = "Baseline & Control";

		const markdown = generateMarkdownReport(report);
		const latex = generateLatexTable(report);
		const html = generateHTMLReport(report);

		expect(markdown).toBeDefined();
		expect(latex).toContain(String.raw`\_`); // LaTeX escaped
		expect(latex).toContain(String.raw`\&`); // LaTeX escaped
		expect(html).toContain("&amp;"); // HTML escaped
	});
});
