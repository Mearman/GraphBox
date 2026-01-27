import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		environment: "node",
		fileParallelism: false,
		testTimeout: 60000, // 60 seconds for mutation testing
		include: [
			"src/experiments/evaluation/__tests__/validation/common/*.unit.test.ts",
			"src/experiments/evaluation/__tests__/validation/*.unit.test.ts",
			"src/experiments/evaluation/metrics/*.property.unit.test.ts",
			"src/experiments/evaluation/metrics/*.unit.test.ts",
		],
		exclude: [
			"node_modules",
			"dist",
			"**/*.exp.*.test.ts", // Exclude expensive experimental tests
			"**/*.integration.test.ts", // Exclude slow integration tests  except validation
		],
	},
});
