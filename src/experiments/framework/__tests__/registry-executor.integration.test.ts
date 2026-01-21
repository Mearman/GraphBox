/**
 * Integration tests for SUT Registry and Case Registry
 */

import { beforeEach,describe, expect, it } from "vitest";

import { CaseRegistry } from "../registry/case-registry.js";
import { SUTRegistry } from "../registry/sut-registry.js";
import type { CaseDefinition } from "../types/case.js";
import type { SutRegistration } from "../types/sut.js";

describe("Registry + Executor Integration", () => {
	describe("SUTRegistry", () => {
		let sutRegistry: SUTRegistry<unknown, { result: string }>;

		beforeEach(() => {
			sutRegistry = new SUTRegistry();
		});

		it("should register and retrieve SUTs", () => {
			const registration: SutRegistration = {
				id: "test-sut-v1.0.0",
				name: "Test SUT",
				version: "1.0.0",
				role: "primary",
				config: { maxDepth: 3 },
				tags: ["test", "primary"],
			};

			const factory = () => ({
				run: async () => ({ result: "success" }),
			});

			sutRegistry.register(registration, factory);

			expect(sutRegistry.has("test-sut-v1.0.0")).toBe(true);
			expect(sutRegistry.size).toBe(1);

			const retrieved = sutRegistry.get("test-sut-v1.0.0");
			expect(retrieved?.registration.name).toBe("Test SUT");
			expect(retrieved?.registration.role).toBe("primary");
		});

		it("should prevent duplicate registration", () => {
			const registration: SutRegistration = {
				id: "duplicate-sut",
				name: "Duplicate",
				version: "1.0.0",
				role: "primary",
				config: {},
				tags: [],
			};

			const factory = () => ({ run: async () => ({ result: "ok" }) });

			sutRegistry.register(registration, factory);

			expect(() => sutRegistry.register(registration, factory)).toThrow("already registered");
		});

		it("should filter by role", () => {
			sutRegistry
				.register(
					{ id: "primary-1", name: "P1", version: "1.0.0", role: "primary", config: {}, tags: [] },
					() => ({ run: async () => ({ result: "p1" }) })
				)
				.register(
					{ id: "primary-2", name: "P2", version: "1.0.0", role: "primary", config: {}, tags: [] },
					() => ({ run: async () => ({ result: "p2" }) })
				)
				.register(
					{ id: "baseline-1", name: "B1", version: "1.0.0", role: "baseline", config: {}, tags: [] },
					() => ({ run: async () => ({ result: "b1" }) })
				);

			const primarySuts = sutRegistry.getByRole("primary");
			const baselineSuts = sutRegistry.getByRole("baseline");

			expect(primarySuts).toHaveLength(2);
			expect(baselineSuts).toHaveLength(1);
		});

		it("should filter by tag", () => {
			sutRegistry
				.register(
					{ id: "sut-1", name: "S1", version: "1.0.0", role: "primary", config: {}, tags: ["expansion", "bidirectional"] },
					() => ({ run: async () => ({ result: "s1" }) })
				)
				.register(
					{ id: "sut-2", name: "S2", version: "1.0.0", role: "primary", config: {}, tags: ["expansion"] },
					() => ({ run: async () => ({ result: "s2" }) })
				)
				.register(
					{ id: "sut-3", name: "S3", version: "1.0.0", role: "baseline", config: {}, tags: ["ranking"] },
					() => ({ run: async () => ({ result: "s3" }) })
				);

			const expansionSuts = sutRegistry.getByTag("expansion");
			const bidirectionalSuts = sutRegistry.getByTag("bidirectional");

			expect(expansionSuts).toHaveLength(2);
			expect(bidirectionalSuts).toHaveLength(1);
		});

		it("should throw for unknown SUT in getOrThrow", () => {
			expect(() => sutRegistry.getOrThrow("nonexistent")).toThrow("SUT not found");
		});

		it("should create SUT instances", () => {
			let capturedConfig: Record<string, unknown> | undefined;

			sutRegistry.register(
				{ id: "configurable-sut", name: "Config", version: "1.0.0", role: "primary", config: {}, tags: [] },
				(_expander, _seeds, config) => {
					capturedConfig = config;
					return { run: async () => ({ result: "configured" }) };
				}
			);

			const instance = sutRegistry.createInstance(
				"configurable-sut",
				{}, // expander
				["seed-a", "seed-b"], // seeds
				{ maxDepth: 5 } // config
			);

			expect(instance).toBeDefined();
			expect(capturedConfig).toEqual({ maxDepth: 5 });
		});

		it("should list all registrations", () => {
			sutRegistry
				.register(
					{ id: "sut-a", name: "A", version: "1.0.0", role: "primary", config: {}, tags: [] },
					() => ({ run: async () => ({ result: "a" }) })
				)
				.register(
					{ id: "sut-b", name: "B", version: "1.0.0", role: "baseline", config: {}, tags: [] },
					() => ({ run: async () => ({ result: "b" }) })
				);

			const ids = sutRegistry.list();
			const registrations = sutRegistry.listRegistrations();

			expect(ids).toContain("sut-a");
			expect(ids).toContain("sut-b");
			expect(registrations).toHaveLength(2);
			expect(registrations.find((r) => r.id === "sut-a")?.name).toBe("A");
		});

		it("should clear all registrations", () => {
			sutRegistry.register(
				{ id: "sut", name: "S", version: "1.0.0", role: "primary", config: {}, tags: [] },
				() => ({ run: async () => ({ result: "s" }) })
			);

			expect(sutRegistry.size).toBe(1);

			sutRegistry.clear();

			expect(sutRegistry.size).toBe(0);
			expect(sutRegistry.has("sut")).toBe(false);
		});
	});

	describe("CaseRegistry", () => {
		let caseRegistry: CaseRegistry<{ nodes: string[] }>;

		beforeEach(() => {
			caseRegistry = new CaseRegistry();
		});

		const createTestCase = (id: string, caseClass?: string, tags?: string[]): CaseDefinition<{ nodes: string[] }> => ({
			case: {
				caseId: id,
				name: `Test Case ${id}`,
				caseClass,
				inputs: { summary: { graphName: id } },
				tags,
			},
			createExpander: async () => ({ nodes: ["a", "b", "c"] }),
			getSeeds: () => ["a", "b"],
		});

		it("should register and retrieve cases", () => {
			const caseDefinition = createTestCase("case-001", "scale-free");

			caseRegistry.register(caseDefinition);

			expect(caseRegistry.has("case-001")).toBe(true);
			expect(caseRegistry.size).toBe(1);

			const retrieved = caseRegistry.get("case-001");
			expect(retrieved?.case.name).toBe("Test Case case-001");
			expect(retrieved?.case.caseClass).toBe("scale-free");
		});

		it("should prevent duplicate case registration", () => {
			const caseDefinition = createTestCase("duplicate-case");

			caseRegistry.register(caseDefinition);

			expect(() => caseRegistry.register(caseDefinition)).toThrow("already registered");
		});

		it("should register multiple cases", () => {
			const cases = [
				createTestCase("case-1", "scale-free"),
				createTestCase("case-2", "scale-free"),
				createTestCase("case-3", "random"),
			];

			caseRegistry.registerAll(cases);

			expect(caseRegistry.size).toBe(3);
		});

		it("should filter by case class", () => {
			caseRegistry.registerAll([
				createTestCase("sf-1", "scale-free"),
				createTestCase("sf-2", "scale-free"),
				createTestCase("rand-1", "random"),
			]);

			const scaleFree = caseRegistry.getByClass("scale-free");
			const random = caseRegistry.getByClass("random");

			expect(scaleFree).toHaveLength(2);
			expect(random).toHaveLength(1);
		});

		it("should filter by tag", () => {
			caseRegistry.registerAll([
				createTestCase("case-1", undefined, ["small", "synthetic"]),
				createTestCase("case-2", undefined, ["large", "real-world"]),
				createTestCase("case-3", undefined, ["small"]),
			]);

			const smallCases = caseRegistry.getByTag("small");
			const realWorldCases = caseRegistry.getByTag("real-world");

			expect(smallCases).toHaveLength(2);
			expect(realWorldCases).toHaveLength(1);
		});

		it("should list unique case classes", () => {
			caseRegistry.registerAll([
				createTestCase("c1", "scale-free"),
				createTestCase("c2", "scale-free"),
				createTestCase("c3", "random"),
				createTestCase("c4", "small-world"),
			]);

			const classes = caseRegistry.listClasses();

			expect(classes).toHaveLength(3);
			expect(classes).toContain("scale-free");
			expect(classes).toContain("random");
			expect(classes).toContain("small-world");
		});

		it("should create expander from case", async () => {
			caseRegistry.register(createTestCase("expandable-case"));

			const expander = await caseRegistry.createExpander("expandable-case");

			expect(expander.nodes).toEqual(["a", "b", "c"]);
		});

		it("should get seeds from case", () => {
			caseRegistry.register(createTestCase("seeded-case"));

			const seeds = caseRegistry.getSeeds("seeded-case");

			expect(seeds).toEqual(["a", "b"]);
		});

		it("should throw for unknown case in getOrThrow", () => {
			expect(() => caseRegistry.getOrThrow("nonexistent")).toThrow("Case not found");
		});

		it("should list all cases", () => {
			caseRegistry.registerAll([
				createTestCase("c1"),
				createTestCase("c2"),
			]);

			const ids = caseRegistry.list();
			const cases = caseRegistry.listCases();

			expect(ids).toContain("c1");
			expect(ids).toContain("c2");
			expect(cases).toHaveLength(2);
		});

		it("should clear all cases", () => {
			caseRegistry.register(createTestCase("c1"));

			expect(caseRegistry.size).toBe(1);

			caseRegistry.clear();

			expect(caseRegistry.size).toBe(0);
		});
	});

	describe("Combined Registry Usage", () => {
		it("should support typical experiment setup pattern", async () => {
			// Create registries
			const sutRegistry = new SUTRegistry<{ nodes: string[] }, { paths: string[][] }>();
			const caseRegistry = new CaseRegistry<{ nodes: string[] }>();

			// Register SUTs
			sutRegistry
				.register(
					{
						id: "degree-prioritised-v1.0.0",
						name: "Degree-Prioritised Expansion",
						version: "1.0.0",
						role: "primary",
						config: { hubThreshold: 0.9 },
						tags: ["expansion", "bidirectional"],
					},
					(expander, seeds) => ({
						run: async () => ({
							paths: seeds.map((s) => [s, ...expander.nodes.slice(0, 2)]),
						}),
					})
				)
				.register(
					{
						id: "standard-bfs-v1.0.0",
						name: "Standard BFS",
						version: "1.0.0",
						role: "baseline",
						config: {},
						tags: ["expansion"],
					},
					(expander, seeds) => ({
						run: async () => ({
							paths: seeds.map((s) => [s, ...expander.nodes]),
						}),
					})
				);

			// Register cases
			caseRegistry.registerAll([
				{
					case: {
						caseId: "karate-v1",
						name: "Zachary Karate Club",
						caseClass: "social-network",
						inputs: { summary: { nodes: 34, edges: 78 } },
					},
					createExpander: async () => ({ nodes: ["1", "2", "3", "34"] }),
					getSeeds: () => ["1", "34"],
				},
				{
					case: {
						caseId: "dolphins-v1",
						name: "Dolphin Network",
						caseClass: "social-network",
						inputs: { summary: { nodes: 62, edges: 159 } },
					},
					createExpander: async () => ({ nodes: ["beak", "fin", "tail"] }),
					getSeeds: () => ["beak", "tail"],
				},
			]);

			// Verify setup
			expect(sutRegistry.size).toBe(2);
			expect(caseRegistry.size).toBe(2);

			// Get primary and baselines
			const primarySuts = sutRegistry.getByRole("primary");
			const baselineSuts = sutRegistry.getByRole("baseline");

			expect(primarySuts).toHaveLength(1);
			expect(primarySuts[0].registration.id).toBe("degree-prioritised-v1.0.0");
			expect(baselineSuts).toHaveLength(1);

			// Execute for one case
			const _testCase = caseRegistry.getOrThrow("karate-v1");
			const expander = await caseRegistry.createExpander("karate-v1");
			const seeds = caseRegistry.getSeeds("karate-v1");

			const instance = sutRegistry.createInstance(
				"degree-prioritised-v1.0.0",
				expander,
				seeds
			);

			const result = await instance.run();

			expect(result.paths).toHaveLength(2); // One path per seed
			expect(result.paths[0][0]).toBe("1"); // First seed
		});

		it("should verify registration data is accessible", () => {
			const sutRegistry = new SUTRegistry();

			sutRegistry.register(
				{
					id: "dp-v1.0.0",
					name: "Degree-Prioritised",
					version: "1.0.0",
					role: "primary",
					config: { maxDepth: 3, hubThreshold: 0.9 },
					tags: ["bidirectional"],
					description: "Hub-avoiding expansion algorithm",
				},
				() => ({ run: async () => ({}) })
			);

			const dp = sutRegistry.get("dp-v1.0.0");

			expect(dp?.registration.role).toBe("primary");
			expect(dp?.registration.config.maxDepth).toBe(3);
			expect(dp?.registration.config.hubThreshold).toBe(0.9);
			expect(dp?.registration.tags).toContain("bidirectional");
			expect(dp?.registration.description).toBe("Hub-avoiding expansion algorithm");
		});
	});
});
