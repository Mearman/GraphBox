/**
 * Unit tests for graph products and related structures.
 */

import { describe, expect, it } from "vitest";

import type {
	BinaryTree,
	Branchwidth,
	Cage,
	CartesianProduct,
	Chordal,
	ChromaticNumber,
	Comparability,
	CompleteBipartite,
	Eulerian,
	FlowNetwork,
	Grid,
	Integrity,
	Interval,
	KColorable,
	KEdgeConnected,
	KVertexConnected,
	LexicographicProduct,
	MinorFree,
	MooreGraph,
	PerfectMatching,
	Permutation,
	Ramanujan,
	SpanningTree,
	Star,
	StrongProduct,
	TensorProduct,
	TopologicalMinorFree,
	Toroidal,
	Toughness,
	Tournament,
	Treewidth,
	Wheel,
} from "./products";

describe("graph products and related structures", () => {
	describe("Robustness Measures", () => {
		describe("Toughness", () => {
			it("should support specific toughness value", () => {
				const tough: Toughness = { kind: "toughness", value: 1.5 };
				expect(tough.kind).toBe("toughness");
				expect(tough.value).toBe(1.5);
			});

			it("should support unconstrained toughness", () => {
				const unconstrained: Toughness = { kind: "unconstrained" };
				expect(unconstrained.kind).toBe("unconstrained");
			});
		});

		describe("Integrity", () => {
			it("should support specific integrity value", () => {
				const integrity: Integrity = { kind: "integrity", value: 5 };
				expect(integrity.kind).toBe("integrity");
				expect(integrity.value).toBe(5);
			});

			it("should support unconstrained integrity", () => {
				const unconstrained: Integrity = { kind: "unconstrained" };
				expect(unconstrained.kind).toBe("unconstrained");
			});
		});
	});

	describe("Extremal Graphs", () => {
		describe("Cage", () => {
			it("should support cage specification", () => {
				const cage: Cage = { kind: "cage", girth: 5, degree: 3 };
				expect(cage.kind).toBe("cage");
				expect(cage.girth).toBe(5);
				expect(cage.degree).toBe(3);
			});

			it("should support not_cage", () => {
				const notCage: Cage = { kind: "not_cage" };
				expect(notCage.kind).toBe("not_cage");
			});

			it("should support unconstrained", () => {
				const unconstrained: Cage = { kind: "unconstrained" };
				expect(unconstrained.kind).toBe("unconstrained");
			});
		});

		describe("MooreGraph", () => {
			it("should support Moore graph specification", () => {
				const moore: MooreGraph = { kind: "moore", diameter: 2, degree: 3 };
				expect(moore.kind).toBe("moore");
				expect(moore.diameter).toBe(2);
				expect(moore.degree).toBe(3);
			});

			it("should support not_moore", () => {
				const notMoore: MooreGraph = { kind: "not_moore" };
				expect(notMoore.kind).toBe("not_moore");
			});
		});

		describe("Ramanujan", () => {
			it("should support Ramanujan graph specification", () => {
				const ramanujan: Ramanujan = { kind: "ramanujan", degree: 3 };
				expect(ramanujan.kind).toBe("ramanujan");
				expect(ramanujan.degree).toBe(3);
			});

			it("should support not_ramanujan", () => {
				const notRamanujan: Ramanujan = { kind: "not_ramanujan" };
				expect(notRamanujan.kind).toBe("not_ramanujan");
			});
		});
	});

	describe("Graph Products", () => {
		describe("CartesianProduct", () => {
			it("should support Cartesian product specification", () => {
				const product: CartesianProduct = {
					kind: "cartesian_product",
					leftFactors: 3,
					rightFactors: 4,
				};
				expect(product.kind).toBe("cartesian_product");
				expect(product.leftFactors).toBe(3);
				expect(product.rightFactors).toBe(4);
			});

			it("should support not_cartesian_product", () => {
				const notProduct: CartesianProduct = { kind: "not_cartesian_product" };
				expect(notProduct.kind).toBe("not_cartesian_product");
			});
		});

		describe("TensorProduct", () => {
			it("should support tensor product specification", () => {
				const product: TensorProduct = {
					kind: "tensor_product",
					leftFactors: 2,
					rightFactors: 3,
				};
				expect(product.kind).toBe("tensor_product");
				expect(product.leftFactors).toBe(2);
				expect(product.rightFactors).toBe(3);
			});
		});

		describe("StrongProduct", () => {
			it("should support strong product specification", () => {
				const product: StrongProduct = {
					kind: "strong_product",
					leftFactors: 4,
					rightFactors: 5,
				};
				expect(product.kind).toBe("strong_product");
				expect(product.leftFactors).toBe(4);
				expect(product.rightFactors).toBe(5);
			});
		});

		describe("LexicographicProduct", () => {
			it("should support lexicographic product specification", () => {
				const product: LexicographicProduct = {
					kind: "lexicographic_product",
					leftFactors: 3,
					rightFactors: 2,
				};
				expect(product.kind).toBe("lexicographic_product");
				expect(product.leftFactors).toBe(3);
				expect(product.rightFactors).toBe(2);
			});
		});
	});

	describe("Minor-Free Graphs", () => {
		describe("MinorFree", () => {
			it("should support minor-free with forbidden minors", () => {
				const minorFree: MinorFree = {
					kind: "minor_free",
					forbiddenMinors: ["K5", "K3,3"],
				};
				expect(minorFree.kind).toBe("minor_free");
				expect(minorFree.forbiddenMinors).toEqual(["K5", "K3,3"]);
			});

			it("should support not_minor_free", () => {
				const notMinorFree: MinorFree = { kind: "not_minor_free" };
				expect(notMinorFree.kind).toBe("not_minor_free");
			});
		});

		describe("TopologicalMinorFree", () => {
			it("should support topological minor-free", () => {
				const topoMinorFree: TopologicalMinorFree = {
					kind: "topological_minor_free",
					forbiddenMinors: ["K4"],
				};
				expect(topoMinorFree.kind).toBe("topological_minor_free");
				expect(topoMinorFree.forbiddenMinors).toEqual(["K4"]);
			});
		});
	});

	describe("Special Bipartite Properties", () => {
		describe("CompleteBipartite", () => {
			it("should support complete bipartite K_{m,n}", () => {
				const bipartite: CompleteBipartite = {
					kind: "complete_bipartite",
					m: 3,
					n: 4,
				};
				expect(bipartite.kind).toBe("complete_bipartite");
				expect(bipartite.m).toBe(3);
				expect(bipartite.n).toBe(4);
			});

			it("should support star graph K_{1,n}", () => {
				const star: CompleteBipartite = { kind: "complete_bipartite", m: 1, n: 5 };
				expect(star.kind).toBe("complete_bipartite");
				expect(star.m).toBe(1);
				expect(star.n).toBe(5);
			});
		});
	});

	describe("Eulerian Properties", () => {
		describe("Eulerian", () => {
			it("should support Eulerian circuit", () => {
				const eulerian: Eulerian = { kind: "eulerian" };
				expect(eulerian.kind).toBe("eulerian");
			});

			it("should support semi-Eulerian (trail)", () => {
				const semiEulerian: Eulerian = { kind: "semi_eulerian" };
				expect(semiEulerian.kind).toBe("semi_eulerian");
			});

			it("should support non-Eulerian", () => {
				const nonEulerian: Eulerian = { kind: "non_eulerian" };
				expect(nonEulerian.kind).toBe("non_eulerian");
			});
		});
	});

	describe("Advanced Connectivity", () => {
		describe("KVertexConnected", () => {
			it("should support k-vertex-connected", () => {
				const kConnected: KVertexConnected = {
					kind: "k_vertex_connected",
					k: 3,
				};
				expect(kConnected.kind).toBe("k_vertex_connected");
				expect(kConnected.k).toBe(3);
			});
		});

		describe("KEdgeConnected", () => {
			it("should support k-edge-connected", () => {
				const kEdgeConnected: KEdgeConnected = {
					kind: "k_edge_connected",
					k: 2,
				};
				expect(kEdgeConnected.kind).toBe("k_edge_connected");
				expect(kEdgeConnected.k).toBe(2);
			});
		});
	});

	describe("Special Graph Structures", () => {
		describe("Wheel", () => {
			it("should support wheel graph", () => {
				const wheel: Wheel = { kind: "wheel" };
				expect(wheel.kind).toBe("wheel");
			});

			it("should support not_wheel", () => {
				const notWheel: Wheel = { kind: "not_wheel" };
				expect(notWheel.kind).toBe("not_wheel");
			});
		});

		describe("Grid", () => {
			it("should support grid graph", () => {
				const grid: Grid = { kind: "grid", rows: 3, cols: 4 };
				expect(grid.kind).toBe("grid");
				expect(grid.rows).toBe(3);
				expect(grid.cols).toBe(4);
			});
		});

		describe("Toroidal", () => {
			it("should support toroidal graph", () => {
				const toroidal: Toroidal = { kind: "toroidal", rows: 5, cols: 6 };
				expect(toroidal.kind).toBe("toroidal");
				expect(toroidal.rows).toBe(5);
				expect(toroidal.cols).toBe(6);
			});
		});

		describe("Star", () => {
			it("should support star graph", () => {
				const star: Star = { kind: "star" };
				expect(star.kind).toBe("star");
			});
		});
	});

	describe("Comparison and Order Graphs", () => {
		describe("Comparability", () => {
			it("should support comparability graph", () => {
				const comparability: Comparability = { kind: "comparability" };
				expect(comparability.kind).toBe("comparability");
			});

			it("should support incomparability graph", () => {
				const incomparability: Comparability = { kind: "incomparability" };
				expect(incomparability.kind).toBe("incomparability");
			});
		});

		describe("Interval", () => {
			it("should support interval graph", () => {
				const interval: Interval = { kind: "interval" };
				expect(interval.kind).toBe("interval");
			});
		});

		describe("Permutation", () => {
			it("should support permutation graph", () => {
				const permutation: Permutation = { kind: "permutation" };
				expect(permutation.kind).toBe("permutation");
			});
		});

		describe("Chordal", () => {
			it("should support chordal graph", () => {
				const chordal: Chordal = { kind: "chordal" };
				expect(chordal.kind).toBe("chordal");
			});

			it("should support non-chordal graph", () => {
				const nonChordal: Chordal = { kind: "non_chordal" };
				expect(nonChordal.kind).toBe("non_chordal");
			});
		});
	});

	describe("Matching Properties", () => {
		describe("PerfectMatching", () => {
			it("should support perfect matching", () => {
				const perfect: PerfectMatching = { kind: "perfect_matching" };
				expect(perfect.kind).toBe("perfect_matching");
			});

			it("should support near-perfect matching", () => {
				const nearPerfect: PerfectMatching = { kind: "near_perfect" };
				expect(nearPerfect.kind).toBe("near_perfect");
			});

			it("should support no perfect matching", () => {
				const noPerfect: PerfectMatching = { kind: "no_perfect_matching" };
				expect(noPerfect.kind).toBe("no_perfect_matching");
			});
		});
	});

	describe("Coloring Properties", () => {
		describe("KColorable", () => {
			it("should support k-colorable", () => {
				const kColorable: KColorable = { kind: "k_colorable", k: 3 };
				expect(kColorable.kind).toBe("k_colorable");
				expect(kColorable.k).toBe(3);
			});

			it("should support bipartite colorable", () => {
				const bipartite: KColorable = { kind: "bipartite_colorable" };
				expect(bipartite.kind).toBe("bipartite_colorable");
			});
		});

		describe("ChromaticNumber", () => {
			it("should support chromatic number", () => {
				const chromatic: ChromaticNumber = { kind: "chromatic_number", chi: 4 };
				expect(chromatic.kind).toBe("chromatic_number");
				expect(chromatic.chi).toBe(4);
			});
		});
	});

	describe("Decomposition Properties", () => {
		describe("Treewidth", () => {
			it("should support treewidth", () => {
				const treewidth: Treewidth = { kind: "treewidth", width: 2 };
				expect(treewidth.kind).toBe("treewidth");
				expect(treewidth.width).toBe(2);
			});
		});

		describe("Branchwidth", () => {
			it("should support branchwidth", () => {
				const branchwidth: Branchwidth = { kind: "branchwidth", width: 3 };
				expect(branchwidth.kind).toBe("branchwidth");
				expect(branchwidth.width).toBe(3);
			});
		});
	});

	describe("Flow Networks", () => {
		describe("FlowNetwork", () => {
			it("should support flow network with source and sink", () => {
				const flow: FlowNetwork = { kind: "flow_network", source: "s", sink: "t" };
				expect(flow.kind).toBe("flow_network");
				expect(flow.source).toBe("s");
				expect(flow.sink).toBe("t");
			});

			it("should support not_flow_network", () => {
				const notFlow: FlowNetwork = { kind: "not_flow_network" };
				expect(notFlow.kind).toBe("not_flow_network");
			});
		});
	});

	describe("Specialized Tree Properties", () => {
		describe("BinaryTree", () => {
			it("should support binary tree", () => {
				const binary: BinaryTree = { kind: "binary_tree" };
				expect(binary.kind).toBe("binary_tree");
			});

			it("should support full binary tree", () => {
				const fullBinary: BinaryTree = { kind: "full_binary" };
				expect(fullBinary.kind).toBe("full_binary");
			});

			it("should support complete binary tree", () => {
				const completeBinary: BinaryTree = { kind: "complete_binary" };
				expect(completeBinary.kind).toBe("complete_binary");
			});
		});

		describe("SpanningTree", () => {
			it("should support spanning tree", () => {
				const spanning: SpanningTree = { kind: "spanning_tree", of: "G1" };
				expect(spanning.kind).toBe("spanning_tree");
				expect(spanning.of).toBe("G1");
			});
		});
	});

	describe("Tournament Graphs", () => {
		describe("Tournament", () => {
			it("should support tournament", () => {
				const tournament: Tournament = { kind: "tournament" };
				expect(tournament.kind).toBe("tournament");
			});

			it("should support not_tournament", () => {
				const notTournament: Tournament = { kind: "not_tournament" };
				expect(notTournament.kind).toBe("not_tournament");
			});
		});
	});
});
