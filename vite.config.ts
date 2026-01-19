import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import pkg from "./package.json";

const isCliBuild = process.env.BUILD_TARGET === "cli";
const isCI = process.env.CI === "true";

export default defineConfig({
	define: {
		__VERSION__: JSON.stringify(pkg.version),
	},
	plugins: isCliBuild
		? []
		: [
				dts({
					include: ["src/**/*"],
					exclude: ["src/cli.ts"],
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
					external: [
						"node:fs",
						"node:path",
						"node:process",
						"node:module",
					],
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
						id.includes("/experiments/evaluation/fixtures/") ||
						id.includes("/experiments/evaluation/loaders/"),
				},
			},
	test: {
		globals: true,
		environment: "node",
		testTimeout: 10000, // 10s for integration tests
		include: [
			"src/**/*.unit.test.ts",
			"src/**/*.integration.test.ts",
			"src/**/*.component.test.ts",
		],
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			reporter: isCI ? ["text", "json", "html"] : ["text"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/fixtures/**"],
		},
	},
});
