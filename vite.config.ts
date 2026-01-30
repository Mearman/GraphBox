import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import pkg from "./package.json";

const isCliBuild = process.env.BUILD_TARGET === "cli";
const isCI = process.env.CI === "true";

export default defineConfig({
	define: {
		__VERSION__: JSON.stringify(pkg.version),
	},
	// Use cacheDir only for Vitest, not for build
	cacheDir: process.env.VITEST ? "node_modules/.vitest" : undefined,
	plugins: isCliBuild
		? []
		: [
				dts({
					include: ["src/**/*"],
					exclude: ["src/cli.ts", "**/*.diagnostic.test.ts"],
					outDir: "dist",
				}),
			],
	build: isCliBuild
		? {
				// CLI build: ESM only
				lib: {
					entry: "src/cli.ts",
					fileName: () => "cli.js",
					formats: ["es"],
				},
				outDir: "dist",
				emptyOutDir: false,
				target: "node18",
				modulePreload: false,
				rollupOptions: {
					external: (id: string) => id.startsWith("node:") || id.startsWith("ppef"),
				},
			}
		: {
				// Library build: ES, CJS, UMD
				lib: {
					entry: "src/index.ts",
					name: "GraphBox",
					fileName: (format) => {
						const extensions: Record<string, string> = {
							es: "index.js",
							cjs: "index.cjs",
							umd: "index.umd.js",
						};
						return extensions[format] ?? `index.${format}.js`;
					},
					formats: ["es", "cjs", "umd"],
				},
				outDir: "dist",
				emptyOutDir: true,
				target: "ES2022",
				modulePreload: false,
				rollupOptions: {
					// Externalize Node.js modules for browser compatibility
					external: (id: string) =>
						id.startsWith("node:") ||
						id.startsWith("ppef") ||
						id.includes("/experiments/evaluation/fixtures/") ||
						id.includes("/experiments/evaluation/loaders/"),
				},
			},
	test: {
		globals: true,
		environment: "node",
		fileParallelism: false,
		testTimeout: 30000,
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			reporter: isCI ? ["text", "json", "html"] : ["text"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/fixtures/**"],
			// Coverage thresholds for test infrastructure validation
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 85,
				statements: 90,
			},
		},
		projects: [
			{
				plugins: [tsconfigPaths()],
				test: {
					name: "exp",
					include: ["src/**/*.exp.*.test.ts"],
					testTimeout: 30_000,
				},
			},
			{
				plugins: [tsconfigPaths()],
				test: {
					name: "unit",
					include: ["src/**/*.unit.test.ts", "src/**/*.integration.test.ts"],
					testTimeout: 30_000,
				},
			},
		],
	},
});
