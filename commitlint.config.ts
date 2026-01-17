import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ReleaseRule {
	type: string;
	release: string;
}

interface ReleaseConfig {
	plugins: Array<string | [string, Record<string, unknown>]>;
}

// Read release config to keep commit types in sync
const releaseConfig: ReleaseConfig = JSON.parse(
	readFileSync(resolve(__dirname, ".releaserc.json"), "utf8")
);

// Extract types from commit-analyzer releaseRules
const commitAnalyzerPlugin = releaseConfig.plugins.find(
	(plugin): plugin is [string, { releaseRules?: ReleaseRule[] }] =>
		Array.isArray(plugin) && plugin[0] === "@semantic-release/commit-analyzer"
);

const releaseRules = commitAnalyzerPlugin?.[1]?.releaseRules;
const types = releaseRules?.map((rule: ReleaseRule) => rule.type) ?? [
	"feat",
	"fix",
	"docs",
	"style",
	"refactor",
	"perf",
	"test",
	"build",
	"ci",
	"chore",
	"revert",
];

export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [2, "always", types],
		"subject-case": [2, "always", "lower-case"],
		"header-max-length": [2, "always", 100],
	},
};
