/**
 * Unit tests for path and cycle properties.
 */

import { describe, expect, it } from "vitest";

import type { Hamiltonian, Traceable } from "./path-cycle";

describe("path and cycle properties", () => {
	describe("Hamiltonian", () => {
		it("should support Hamiltonian graphs (has cycle visiting every vertex)", () => {
			const hamiltonian: Hamiltonian = { kind: "hamiltonian" };
			expect(hamiltonian.kind).toBe("hamiltonian");
		});

		it("should support non-Hamiltonian graphs", () => {
			const nonHamiltonian: Hamiltonian = { kind: "non_hamiltonian" };
			expect(nonHamiltonian.kind).toBe("non_hamiltonian");
		});

		it("should support unconstrained Hamiltonian property", () => {
			const unconstrained: Hamiltonian = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("Traceable", () => {
		it("should support traceable graphs (has path visiting every vertex)", () => {
			const traceable: Traceable = { kind: "traceable" };
			expect(traceable.kind).toBe("traceable");
		});

		it("should support non-traceable graphs", () => {
			const nonTraceable: Traceable = { kind: "non_traceable" };
			expect(nonTraceable.kind).toBe("non_traceable");
		});

		it("should support unconstrained traceable property", () => {
			const unconstrained: Traceable = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});
	});

	describe("type narrowing", () => {
		it("should narrow Hamiltonian based on kind", () => {
			const values: Hamiltonian[] = [
				{ kind: "hamiltonian" },
				{ kind: "non_hamiltonian" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "hamiltonian") {
					expect(property.kind).toBe("hamiltonian");
				} else if (property.kind === "non_hamiltonian") {
					expect(property.kind).toBe("non_hamiltonian");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});

		it("should narrow Traceable based on kind", () => {
			const values: Traceable[] = [
				{ kind: "traceable" },
				{ kind: "non_traceable" },
				{ kind: "unconstrained" },
			];

			for (const property of values) {
				if (property.kind === "traceable") {
					expect(property.kind).toBe("traceable");
				} else if (property.kind === "non_traceable") {
					expect(property.kind).toBe("non_traceable");
				} else {
					expect(property.kind).toBe("unconstrained");
				}
			}
		});
	});

	describe("property implications", () => {
		it("should allow representing Hamiltonian implies Traceable", () => {
			// If a graph is Hamiltonian, it is also Traceable
			// (removing one edge from Hamiltonian cycle gives Hamiltonian path)
			const hamiltonian: Hamiltonian = { kind: "hamiltonian" };
			const traceable: Traceable = { kind: "traceable" };

			// Both properties can be specified
			expect(hamiltonian.kind).toBe("hamiltonian");
			expect(traceable.kind).toBe("traceable");
		});

		it("should allow representing Traceable without Hamiltonian", () => {
			// A graph can be Traceable but not Hamiltonian
			// (e.g., a path graph Pn for n >= 2)
			const hamiltonian: Hamiltonian = { kind: "non_hamiltonian" };
			const traceable: Traceable = { kind: "traceable" };

			expect(hamiltonian.kind).toBe("non_hamiltonian");
			expect(traceable.kind).toBe("traceable");
		});

		it("should allow representing neither Traceable nor Hamiltonian", () => {
			// A disconnected graph is neither
			const hamiltonian: Hamiltonian = { kind: "non_hamiltonian" };
			const traceable: Traceable = { kind: "non_traceable" };

			expect(hamiltonian.kind).toBe("non_hamiltonian");
			expect(traceable.kind).toBe("non_traceable");
		});
	});

	describe("example graphs", () => {
		it("should represent cycle graph Cn (Hamiltonian)", () => {
			// Cycle graphs are Hamiltonian by definition
			const cycleGraph: Hamiltonian = { kind: "hamiltonian" };
			expect(cycleGraph.kind).toBe("hamiltonian");
		});

		it("should represent complete graph Kn for n >= 3 (Hamiltonian)", () => {
			// Complete graphs are Hamiltonian for n >= 3
			const completeGraph: Hamiltonian = { kind: "hamiltonian" };
			expect(completeGraph.kind).toBe("hamiltonian");
		});

		it("should represent path graph Pn (Traceable but not Hamiltonian for n >= 2)", () => {
			// Path graphs have Hamiltonian path but no Hamiltonian cycle
			const pathGraphHamiltonian: Hamiltonian = { kind: "non_hamiltonian" };
			const pathGraphTraceable: Traceable = { kind: "traceable" };

			expect(pathGraphHamiltonian.kind).toBe("non_hamiltonian");
			expect(pathGraphTraceable.kind).toBe("traceable");
		});

		it("should represent Petersen graph (non-Hamiltonian)", () => {
			// The Petersen graph is a famous non-Hamiltonian graph
			const petersenGraph: Hamiltonian = { kind: "non_hamiltonian" };
			expect(petersenGraph.kind).toBe("non_hamiltonian");
		});
	});
});
