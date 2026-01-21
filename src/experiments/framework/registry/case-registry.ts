/**
 * Case Registry
 *
 * Central registry for evaluation case definitions. Cases are registered
 * with their factories, enabling lazy loading of graph data during
 * experiment execution.
 */

import type { CaseDefinition, EvaluationCase } from "../types/case.js";

/**
 * Registry for evaluation case definitions.
 */
export class CaseRegistry<TExpander = unknown> {
	private readonly definitions = new Map<string, CaseDefinition<TExpander>>();

	/**
	 * Register a new case.
	 *
	 * @param definition - Case definition including metadata and factories
	 * @throws Error if case with same ID already registered
	 */
	register(definition: CaseDefinition<TExpander>): this {
		const caseId = definition.case.caseId;
		if (this.definitions.has(caseId)) {
			throw new Error(`Case already registered: ${caseId}`);
		}

		this.definitions.set(caseId, definition);
		return this;
	}

	/**
	 * Register multiple cases at once.
	 *
	 * @param definitions - Array of case definitions
	 */
	registerAll(definitions: CaseDefinition<TExpander>[]): this {
		for (const definition of definitions) {
			this.register(definition);
		}
		return this;
	}

	/**
	 * Get a case definition by ID.
	 *
	 * @param caseId - Case identifier
	 * @returns Case definition or undefined
	 */
	get(caseId: string): CaseDefinition<TExpander> | undefined {
		return this.definitions.get(caseId);
	}

	/**
	 * Get a case definition by ID, throwing if not found.
	 *
	 * @param caseId - Case identifier
	 * @returns Case definition
	 * @throws Error if case not found
	 */
	getOrThrow(caseId: string): CaseDefinition<TExpander> {
		const definition = this.definitions.get(caseId);
		if (!definition) {
			throw new Error(`Case not found: ${caseId}`);
		}
		return definition;
	}

	/**
	 * Get all cases with a specific class.
	 *
	 * @param caseClass - Class to filter by
	 * @returns Array of matching case definitions
	 */
	getByClass(caseClass: string): CaseDefinition<TExpander>[] {
		return [...this.definitions.values()].filter(
			(d) => d.case.caseClass === caseClass
		);
	}

	/**
	 * Get all cases with a specific tag.
	 *
	 * @param tag - Tag to filter by
	 * @returns Array of matching case definitions
	 */
	getByTag(tag: string): CaseDefinition<TExpander>[] {
		return [...this.definitions.values()].filter(
			(d) => d.case.tags?.includes(tag)
		);
	}

	/**
	 * List all registered case IDs.
	 *
	 * @returns Array of case identifiers
	 */
	list(): string[] {
		return [...this.definitions.keys()];
	}

	/**
	 * List all registered case specifications.
	 *
	 * @returns Array of case specifications
	 */
	listCases(): EvaluationCase[] {
		return [...this.definitions.values()].map((d) => d.case);
	}

	/**
	 * List all unique case classes.
	 *
	 * @returns Array of case class names
	 */
	listClasses(): string[] {
		const classes = new Set<string>();
		for (const definition of this.definitions.values()) {
			if (definition.case.caseClass) {
				classes.add(definition.case.caseClass);
			}
		}
		return [...classes];
	}

	/**
	 * Check if a case is registered.
	 *
	 * @param caseId - Case identifier
	 * @returns true if registered
	 */
	has(caseId: string): boolean {
		return this.definitions.has(caseId);
	}

	/**
	 * Get the number of registered cases.
	 */
	get size(): number {
		return this.definitions.size;
	}

	/**
	 * Clear all registrations.
	 */
	clear(): void {
		this.definitions.clear();
	}

	/**
	 * Create a graph expander for a case.
	 *
	 * @param caseId - Case identifier
	 * @returns Promise resolving to graph expander
	 */
	async createExpander(caseId: string): Promise<TExpander> {
		const definition = this.getOrThrow(caseId);
		return definition.createExpander(definition.case.inputs);
	}

	/**
	 * Get seed nodes for a case.
	 *
	 * @param caseId - Case identifier
	 * @returns Array of seed node IDs
	 */
	getSeeds(caseId: string): string[] {
		const definition = this.getOrThrow(caseId);
		return definition.getSeeds(definition.case.inputs);
	}
}

/**
 * Global case registry instance.
 *
 * Use this for standard registration, or create instances for isolation.
 */
export const caseRegistry = new CaseRegistry();
