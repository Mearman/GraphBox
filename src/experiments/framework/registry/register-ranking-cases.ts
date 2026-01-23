/**
 * Ranking Case Registration
 *
 * Registers path ranking evaluation cases with the global registry.
 * Each case represents a graph with source and target nodes for path discovery.
 *
 * Domain-specific types:
 * - Uses RankingInputs from register-ranking-suts.ts
 * - getInput() loads BenchmarkGraphExpander
 * - getInputs() returns source and target nodes
 */

import { createHash } from "node:crypto";

import { BenchmarkGraphExpander } from "../../evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../../evaluation/fixtures/index.js";
import type { CaseDefinition, CaseInputs, EvaluationCase } from "../types/case.js";
import { CaseRegistry } from "./case-registry.js";
import type { RankingInputs } from "./register-ranking-suts.js";

/**
 * Create a typed case registry for path ranking.
 *
 * The registry is parameterized with:
 * - TInput = BenchmarkGraphExpander (graph resource)
 * - TInputs = RankingInputs (domain-specific inputs with source/target)
 */
export type RankingCaseRegistry = CaseRegistry<BenchmarkGraphExpander, RankingInputs>;

/**
 * Ranking case specifications with source and target nodes.
 */
interface RankingCaseSpec {
	id: string;
	name: string;
	source: string;
	target: string;
	maxPaths?: number;
}

/**
 * Generate a deterministic case ID from inputs.
 * @param name
 * @param inputs
 */
const generateCaseId = (name: string, inputs: CaseInputs): string => {
	const canonical = JSON.stringify({ name, inputs });
	return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
};

/**
 * Ranking benchmark cases for evaluation.
 *
 * Each case specifies a graph with source and target nodes.
 */
export const RANKING_CASES: RankingCaseSpec[] = [
	{ id: "karate", name: "Karate Club", source: "1", target: "34", maxPaths: 15 },
	{ id: "lesmis", name: "Les Misérables", source: "Myriel", target: "Marius", maxPaths: 18 },
	{ id: "cora", name: "Cora", source: "35", target: "1033", maxPaths: 10 },
	{ id: "citeseer", name: "CiteSeer", source: "100157", target: "364207", maxPaths: 10 },
	{ id: "facebook", name: "Facebook", source: "0", target: "4000", maxPaths: 15 },
];

/**
 * Create ranking case definitions.
 *
 * Each case provides a graph expander with source/target nodes.
 */
const createRankingCaseDefinitions = async (): Promise<CaseDefinition<BenchmarkGraphExpander, RankingInputs>[]> => {
	const cases: CaseDefinition<BenchmarkGraphExpander, RankingInputs>[] = [];

	for (const caseSpec of RANKING_CASES) {
		// Load benchmark data
		const benchmarkData = await loadBenchmarkByIdFromUrl(caseSpec.id);

		// Get graph size from expander
		const expander = new BenchmarkGraphExpander(benchmarkData.graph, benchmarkData.meta.directed);
		const nodes = expander.getNodeCount();
		const edges = benchmarkData.graph.getAllEdges().length;

		// Adaptive maxPaths based on graph size
		// Large graphs need fewer paths to avoid computational explosion
		let adaptiveMaxPaths = caseSpec.maxPaths ?? 10;
		if (edges > 100_000) {
			// Very large graphs (Facebook, etc.): limit to 3 paths
			adaptiveMaxPaths = Math.min(adaptiveMaxPaths, 3);
		} else if (edges > 10_000) {
			// Large graphs (CiteSeer, Cora): limit to 5 paths
			adaptiveMaxPaths = Math.min(adaptiveMaxPaths, 5);
		}

		const inputs: CaseInputs = {
			summary: {
				datasetId: caseSpec.id,
				source: caseSpec.source,
				target: caseSpec.target,
				maxPaths: adaptiveMaxPaths,
				nodes,
				edges,
			},
			artefacts: [
				{
					type: "graph",
					uri: `benchmark://${caseSpec.id}`,
				},
			],
		};

		const caseSpec_: EvaluationCase = {
			caseId: generateCaseId(`${caseSpec.name}-${caseSpec.source}-${caseSpec.target}`, inputs),
			name: `${caseSpec.name} (${caseSpec.source}→${caseSpec.target})`,
			caseClass: "ranking",
			inputs,
			version: "1.0.0",
			tags: ["ranking", caseSpec.id],
		};

		cases.push({
			case: caseSpec_,
			getInput: async (): Promise<BenchmarkGraphExpander> => {
				// Return the pre-loaded graph expander
				return expander;
			},
			getInputs: (): RankingInputs => {
				// Return ranking inputs
				// input/expander will be added by executor as { input, ...inputs }
				return {
					input: null as unknown as BenchmarkGraphExpander, // Will be replaced by executor
					source: caseSpec.source,
					target: caseSpec.target,
				};
			},
		});
	}

	return cases;
};

/**
 * Register all ranking cases with a registry.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerRankingCases = async (registry: RankingCaseRegistry = new CaseRegistry<BenchmarkGraphExpander, RankingInputs>()): Promise<RankingCaseRegistry> => {
	const rankingCases = await createRankingCaseDefinitions();
	registry.registerAll(rankingCases);

	return registry;
};
