/**
 * Case Registration for Expansion Algorithms
 *
 * Registers all evaluation cases for graph expansion with the global registry.
 * Cases are lazily loaded when needed during experiment execution.
 *
 * Domain-specific types:
 * - Uses ExpansionInputs from register-suts.ts
 * - getInput() loads BenchmarkGraphExpander
 * - getInputs() returns seed node IDs
 */

import { createHash } from "node:crypto";

import { CaseRegistry } from "ppef/registry";
import type { CaseDefinition, CaseInputs, EvaluationCase } from "ppef/types/case";

import { BenchmarkGraphExpander } from "../experiments/evaluation/__tests__/validation/common/benchmark-graph-expander.js";
import { loadBenchmarkByIdFromUrl } from "../experiments/evaluation/fixtures/index.js";
import type { ExpansionInputs } from "./register-suts.js";

/**
 * Extended expander interface that includes methods for seed retrieval.
 */
export interface ExpanderWithNodeAccess {
	getAllNodeIds(): string[];
	getDegree(nodeId: string): number;
}

/**
 * Create a typed case registry for expansion algorithms.
 *
 * The registry is parameterized with:
 * - TInput = BenchmarkGraphExpander (graph resource)
 * - TInputs = ExpansionInputs (domain-specific inputs with seeds)
 */
export type GraphCaseRegistry = CaseRegistry<BenchmarkGraphExpander, ExpansionInputs>;

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
 * Benchmark case definitions.
 *
 * Small graphs (for quick testing): karate, lesmis
 * Medium graphs (with hubs): facebook, cora, citeseer, ca-astroph, ca-condmat, ca-hepph
 * Large graphs (significant hubs): cit-hepph, cit-hepth, dblp
 */
export const BENCHMARK_CASES: Array<{
	id: string;
	name: string;
	caseClass: string;
	expectedNodes: number;
	tags: string[];
}> = [
	// Small social networks
	{ id: "karate", name: "Karate Club", caseClass: "social", expectedNodes: 34, tags: ["small", "social", "undirected"] },
	{ id: "lesmis", name: "Les Misérables", caseClass: "social", expectedNodes: 77, tags: ["small", "social", "undirected"] },

	// Medium social graphs
	{ id: "facebook", name: "Facebook", caseClass: "social", expectedNodes: 4039, tags: ["medium", "social", "undirected"] },

	// Citation networks
	{ id: "cora", name: "Cora", caseClass: "citation", expectedNodes: 2708, tags: ["medium", "citation", "directed"] },
	{ id: "citeseer", name: "CiteSeer", caseClass: "citation", expectedNodes: 3327, tags: ["medium", "citation", "directed"] },

	// SNAP Collaboration networks (scale-free, hub-heavy)
	{ id: "ca-astroph", name: "CA-Astroph", caseClass: "collaboration", expectedNodes: 18_772, tags: ["medium", "collaboration", "undirected"] },
	{ id: "ca-condmat", name: "CA-CondMat", caseClass: "collaboration", expectedNodes: 23_133, tags: ["medium", "collaboration", "undirected"] },
	{ id: "ca-hepph", name: "CA-HepPh", caseClass: "collaboration", expectedNodes: 9877, tags: ["medium", "collaboration", "undirected"] },

	// SNAP Citation networks (heavy-tailed)
	{ id: "cit-hepph", name: "Cit-HepPH", caseClass: "citation", expectedNodes: 27_400, tags: ["large", "citation", "directed"] },
	{ id: "cit-hepth", name: "Cit-HepTH", caseClass: "citation", expectedNodes: 27_770, tags: ["large", "citation", "directed"] },

	// Large co-authorship network
	{ id: "dblp", name: "DBLP", caseClass: "coauthorship", expectedNodes: 317_080, tags: ["large", "coauthorship", "undirected"] },
];

/**
 * Seed count variants for testing.
 * N=1: ego-graph (single source)
 * N=2: bidirectional (first + last node)
 * N=3: multi-seed (distributed)
 */
export const SEED_VARIANTS = [1, 2, 3] as const;
export type SeedVariant = typeof SEED_VARIANTS[number];

/**
 * Get variant display name.
 * @param n - Number of seeds
 */
const getVariantDisplayName = (n: number): string => {
	switch (n) {
		case 1: {
			return "ego-graph";
		}
		case 2: {
			return "bidirectional";
		}
		default: {
			return `multi-seed-${n}`;
		}
	}
};

/**
 * Create case definitions for benchmark graphs with multiple seed variants.
 * Pre-loads benchmark data to determine seed nodes for each variant.
 */
const createBenchmarkCaseDefinitions = async (): Promise<CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>[]> => {
	const cases: CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>[] = [];

	for (const benchmark of BENCHMARK_CASES) {
		// Load benchmark data once to get node IDs
		const benchmarkData = await loadBenchmarkByIdFromUrl(benchmark.id);
		const nodes = benchmarkData.graph.getAllNodes();

		// Create a case for each seed variant
		for (const seedCount of SEED_VARIANTS) {
			// Determine seed nodes based on variant
			let seeds: string[];
			if (seedCount === 1) {
				seeds = [nodes[0].id];
			} else if (seedCount === 2) {
				const lastNode = nodes.at(-1);
				seeds = lastNode ? [nodes[0].id, lastNode.id] : [nodes[0].id];
			} else {
				// For N > 2, distribute seeds evenly across the node list
				const step = Math.floor(nodes.length / seedCount);
				seeds = [];
				for (let index_ = 0; index_ < seedCount; index_++) {
					const index = Math.min(index_ * step, nodes.length - 1);
					seeds.push(nodes[index].id);
				}
			}

			const variantName = getVariantDisplayName(seedCount);
			const inputs: CaseInputs = {
				summary: {
					datasetId: benchmark.id,
					variant: variantName,
					seedCount,
					expectedNodes: benchmark.expectedNodes,
					seeds, // Store seeds in inputs
				},
				artefacts: [
					{
						type: "graph",
						uri: `benchmark://${benchmark.id}`,
					},
				],
			};

			const caseSpec: EvaluationCase = {
				caseId: generateCaseId(`${benchmark.name}-${variantName}`, inputs),
				name: `${benchmark.name} (${variantName})`,
				caseClass: `${benchmark.caseClass}-${variantName}`, // Include variant in caseClass for separate aggregation
				inputs,
				version: "1.0.0",
				tags: [...benchmark.tags, variantName, `n-${seedCount}`],
			};

			cases.push({
				case: caseSpec,
				getInput: async (): Promise<BenchmarkGraphExpander> => {
					// Return the pre-loaded graph expander
					return new BenchmarkGraphExpander(benchmarkData.graph, benchmarkData.meta.directed);
				},
				getInputs: (): ExpansionInputs => {
					// Return expansion inputs with the pre-computed seeds
					return { expander: null as unknown as BenchmarkGraphExpander, seeds };
				},
			});
		}
	}

	return cases;
};

/**
 * Synthetic graph case class types.
 */
export type SyntheticGraphType = "star" | "scale-free" | "complete" | "path" | "cycle";

/**
 * Create a synthetic graph case definition.
 * @param type
 * @param nodes
 * @param additionalParams
 * @param additionalParameters
 */
export const createSyntheticCaseDefinition = (
	type: SyntheticGraphType,
	nodes: number,
	additionalParameters?: Record<string, unknown>
): CaseDefinition<BenchmarkGraphExpander, ExpansionInputs> => {
	const inputs: CaseInputs = {
		summary: {
			type,
			nodes,
			...additionalParameters,
		},
	};

	const caseId = generateCaseId(`${type}-${nodes}`, inputs);

	return {
		case: {
			caseId,
			name: `${type.charAt(0).toUpperCase() + type.slice(1)} Graph (${nodes} nodes)`,
			caseClass: type,
			inputs,
			version: "1.0.0",
			tags: ["synthetic", type],
		},
		getInput: async () => {
			// Synthetic graph generation would be implemented here
			throw new Error(`Synthetic graph generation for ${type} not yet implemented`);
		},
		getInputs: () => ({ expander: null as unknown as BenchmarkGraphExpander, seeds: [] }),
	};
};

/**
 * Register all cases with a registry (sync version, doesn't pre-load seeds).
 * Use this for backward compatibility when seeds aren't needed upfront.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerCasesSync = (registry: GraphCaseRegistry = new CaseRegistry<BenchmarkGraphExpander, ExpansionInputs>()): GraphCaseRegistry => {
	// Register benchmark cases (without seed pre-loading)
	const cases: CaseDefinition<BenchmarkGraphExpander, ExpansionInputs>[] = BENCHMARK_CASES.map((benchmark) => {
		const inputs: CaseInputs = {
			summary: {
				datasetId: benchmark.id,
				expectedNodes: benchmark.expectedNodes,
			},
			artefacts: [
				{
					type: "graph",
					uri: `benchmark://${benchmark.id}`,
				},
			],
		};

		const caseSpec: EvaluationCase = {
			caseId: generateCaseId(benchmark.name, inputs),
			name: benchmark.name,
			caseClass: benchmark.caseClass,
			inputs,
			version: "1.0.0",
			tags: benchmark.tags,
		};

		return {
			case: caseSpec,
			getInput: async (): Promise<BenchmarkGraphExpander> => {
				const datasetId = inputs.summary?.datasetId as string;
				const benchmarkData = await loadBenchmarkByIdFromUrl(datasetId);
				return new BenchmarkGraphExpander(benchmarkData.graph, benchmarkData.meta.directed);
			},
			getInputs: (): ExpansionInputs => {
				// Seeds will be determined from the expander after creation
				// The SUT factory should handle empty seeds
				return { expander: null as unknown as BenchmarkGraphExpander, seeds: [] };
			},
		};
	});

	registry.registerAll(cases);
	return registry;
};

/**
 * Register all cases with a registry (async version, pre-loads seeds).
 * This version loads benchmark data during registration to determine seed nodes.
 *
 * @param registry - Registry to populate (defaults to new instance)
 * @returns The populated registry
 */
export const registerCases = async (registry: GraphCaseRegistry = new CaseRegistry<BenchmarkGraphExpander, ExpansionInputs>()): Promise<GraphCaseRegistry> => {
	// Register benchmark cases (async now, pre-loads seeds)
	const benchmarkCases = await createBenchmarkCaseDefinitions();
	registry.registerAll(benchmarkCases);

	return registry;
};

/**
 * Global case registry with all cases registered (sync version).
 * For async version with pre-loaded seeds, use `await registerCases()` instead.
 */
export const graphCaseRegistry = registerCasesSync(new CaseRegistry<BenchmarkGraphExpander, ExpansionInputs>());

/**
 * Get seeds for a benchmark graph.
 * This is a utility function that returns first and last node IDs.
 *
 * @param expander - Graph expander with getAllNodeIds method
 * @returns Tuple of [first, last] node IDs
 */
export const getBenchmarkSeeds = (expander: ExpanderWithNodeAccess): [string, string] => {
	const allNodes = expander.getAllNodeIds();
	return [allNodes[0], allNodes.at(-1) ?? allNodes[0]];
};

/**
 * Get N seeds from a benchmark graph.
 *
 * @param expander - Graph expander with getAllNodeIds method
 * @param n - Number of seeds
 * @returns Array of seed node IDs
 */
export const getNSeeds = (expander: ExpanderWithNodeAccess, n: number): string[] => {
	const allNodes = expander.getAllNodeIds();
	if (n <= 0) return [];
	if (n === 1) return [allNodes[0]];
	if (n === 2) return [allNodes[0], allNodes.at(-1) ?? allNodes[0]];

	// For N > 2, distribute evenly across the node list
	const step = Math.floor(allNodes.length / n);
	const seeds: string[] = [];
	for (let index_ = 0; index_ < n; index_++) {
		const index = Math.min(index_ * step, allNodes.length - 1);
		seeds.push(allNodes[index]);
	}
	return seeds;
};
