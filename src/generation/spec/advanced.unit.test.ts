/**
 * Unit tests for advanced graph properties.
 */

import { describe, expect, it } from "vitest";

import type {
	DegreeConstraint,
	EdgeArity,
	EdgeData,
	EdgeOrdering,
	Embedding,
	Layering,
	MeasureSemantics,
	Observability,
	OperationalSemantics,
	Partiteness,
	Ports,
	Rooting,
	Signedness,
	Temporal,
	Uncertainty,
	VertexCardinality,
	VertexData,
	VertexIdentity,
	VertexOrdering,
} from "./advanced";

describe("advanced graph properties", () => {
	describe("VertexCardinality", () => {
		it("should support finite cardinality", () => {
			const finite: VertexCardinality = { kind: "finite", n: 10 };
			expect(finite.kind).toBe("finite");
			expect(finite.n).toBe(10);
		});

		it("should support finite cardinality without explicit count", () => {
			const finite: VertexCardinality = { kind: "finite" };
			expect(finite.kind).toBe("finite");
		});

		it("should support countably infinite cardinality", () => {
			const countable: VertexCardinality = { kind: "countably_infinite" };
			expect(countable.kind).toBe("countably_infinite");
		});

		it("should support uncountably infinite cardinality", () => {
			const uncountable: VertexCardinality = { kind: "uncountably_infinite" };
			expect(uncountable.kind).toBe("uncountably_infinite");
		});
	});

	describe("VertexIdentity", () => {
		it("should support distinguishable vertices", () => {
			const distinguishable: VertexIdentity = { kind: "distinguishable" };
			expect(distinguishable.kind).toBe("distinguishable");
		});

		it("should support indistinguishable vertices", () => {
			const indistinguishable: VertexIdentity = { kind: "indistinguishable" };
			expect(indistinguishable.kind).toBe("indistinguishable");
		});
	});

	describe("VertexOrdering", () => {
		it("should support unordered vertices", () => {
			const unordered: VertexOrdering = { kind: "unordered" };
			expect(unordered.kind).toBe("unordered");
		});

		it("should support total order", () => {
			const total: VertexOrdering = { kind: "total_order" };
			expect(total.kind).toBe("total_order");
		});

		it("should support partial order", () => {
			const partial: VertexOrdering = { kind: "partial_order" };
			expect(partial.kind).toBe("partial_order");
		});
	});

	describe("EdgeArity", () => {
		it("should support binary edges", () => {
			const binary: EdgeArity = { kind: "binary" };
			expect(binary.kind).toBe("binary");
		});

		it("should support k-ary edges (hypergraph)", () => {
			const kAry: EdgeArity = { kind: "k_ary", k: 3 };
			expect(kAry.kind).toBe("k_ary");
			expect(kAry.k).toBe(3);
		});
	});

	describe("Signedness", () => {
		it("should support unsigned edges", () => {
			const unsigned: Signedness = { kind: "unsigned" };
			expect(unsigned.kind).toBe("unsigned");
		});

		it("should support signed edges", () => {
			const signed: Signedness = { kind: "signed" };
			expect(signed.kind).toBe("signed");
		});

		it("should support multi-signed edges", () => {
			const multiSigned: Signedness = { kind: "multi_signed" };
			expect(multiSigned.kind).toBe("multi_signed");
		});
	});

	describe("Uncertainty", () => {
		it("should support deterministic graphs", () => {
			const deterministic: Uncertainty = { kind: "deterministic" };
			expect(deterministic.kind).toBe("deterministic");
		});

		it("should support probabilistic graphs", () => {
			const probabilistic: Uncertainty = { kind: "probabilistic" };
			expect(probabilistic.kind).toBe("probabilistic");
		});

		it("should support fuzzy graphs", () => {
			const fuzzy: Uncertainty = { kind: "fuzzy" };
			expect(fuzzy.kind).toBe("fuzzy");
		});
	});

	describe("VertexData", () => {
		it("should support unlabelled vertices", () => {
			const unlabelled: VertexData = { kind: "unlabelled" };
			expect(unlabelled.kind).toBe("unlabelled");
		});

		it("should support labelled vertices", () => {
			const labelled: VertexData = { kind: "labelled" };
			expect(labelled.kind).toBe("labelled");
		});

		it("should support attributed vertices", () => {
			const attributed: VertexData = { kind: "attributed" };
			expect(attributed.kind).toBe("attributed");
		});
	});

	describe("EdgeData", () => {
		it("should support unlabelled edges", () => {
			const unlabelled: EdgeData = { kind: "unlabelled" };
			expect(unlabelled.kind).toBe("unlabelled");
		});

		it("should support labelled edges", () => {
			const labelled: EdgeData = { kind: "labelled" };
			expect(labelled.kind).toBe("labelled");
		});

		it("should support attributed edges", () => {
			const attributed: EdgeData = { kind: "attributed" };
			expect(attributed.kind).toBe("attributed");
		});
	});

	describe("DegreeConstraint", () => {
		it("should support unconstrained degrees", () => {
			const unconstrained: DegreeConstraint = { kind: "unconstrained" };
			expect(unconstrained.kind).toBe("unconstrained");
		});

		it("should support bounded degrees", () => {
			const bounded: DegreeConstraint = { kind: "bounded", max: 5 };
			expect(bounded.kind).toBe("bounded");
			expect(bounded.max).toBe(5);
		});

		it("should support regular degrees", () => {
			const regular: DegreeConstraint = { kind: "regular", degree: 3 };
			expect(regular.kind).toBe("regular");
			expect(regular.degree).toBe(3);
		});

		it("should support degree sequence", () => {
			const sequence: DegreeConstraint = {
				kind: "degree_sequence",
				sequence: [3, 3, 2, 2, 2, 2],
			};
			expect(sequence.kind).toBe("degree_sequence");
			expect(sequence.sequence).toEqual([3, 3, 2, 2, 2, 2]);
		});
	});

	describe("Partiteness", () => {
		it("should support unrestricted partiteness", () => {
			const unrestricted: Partiteness = { kind: "unrestricted" };
			expect(unrestricted.kind).toBe("unrestricted");
		});

		it("should support bipartite graphs", () => {
			const bipartite: Partiteness = { kind: "bipartite" };
			expect(bipartite.kind).toBe("bipartite");
		});

		it("should support k-partite graphs", () => {
			const kPartite: Partiteness = { kind: "k_partite", k: 3 };
			expect(kPartite.kind).toBe("k_partite");
			expect(kPartite.k).toBe(3);
		});
	});

	describe("Embedding", () => {
		it("should support abstract graphs", () => {
			const abstract: Embedding = { kind: "abstract" };
			expect(abstract.kind).toBe("abstract");
		});

		it("should support planar embedding", () => {
			const planar: Embedding = { kind: "planar" };
			expect(planar.kind).toBe("planar");
		});

		it("should support surface embedding", () => {
			const surface: Embedding = { kind: "surface_embedded" };
			expect(surface.kind).toBe("surface_embedded");
		});

		it("should support geometric metric space", () => {
			const geometric: Embedding = { kind: "geometric_metric_space" };
			expect(geometric.kind).toBe("geometric_metric_space");
		});

		it("should support 2D spatial coordinates", () => {
			const spatial2D: Embedding = { kind: "spatial_coordinates", dims: 2 };
			expect(spatial2D.kind).toBe("spatial_coordinates");
			expect(spatial2D.dims).toBe(2);
		});

		it("should support 3D spatial coordinates", () => {
			const spatial3D: Embedding = { kind: "spatial_coordinates", dims: 3 };
			expect(spatial3D.kind).toBe("spatial_coordinates");
			expect(spatial3D.dims).toBe(3);
		});
	});

	describe("Rooting", () => {
		it("should support unrooted trees", () => {
			const unrooted: Rooting = { kind: "unrooted" };
			expect(unrooted.kind).toBe("unrooted");
		});

		it("should support rooted trees", () => {
			const rooted: Rooting = { kind: "rooted" };
			expect(rooted.kind).toBe("rooted");
		});

		it("should support multi-rooted trees", () => {
			const multiRooted: Rooting = { kind: "multi_rooted" };
			expect(multiRooted.kind).toBe("multi_rooted");
		});
	});

	describe("Temporal", () => {
		it("should support static graphs", () => {
			const staticGraph: Temporal = { kind: "static" };
			expect(staticGraph.kind).toBe("static");
		});

		it("should support dynamic structure", () => {
			const dynamic: Temporal = { kind: "dynamic_structure" };
			expect(dynamic.kind).toBe("dynamic_structure");
		});

		it("should support temporal edges", () => {
			const temporalEdges: Temporal = { kind: "temporal_edges" };
			expect(temporalEdges.kind).toBe("temporal_edges");
		});

		it("should support temporal vertices", () => {
			const temporalVertices: Temporal = { kind: "temporal_vertices" };
			expect(temporalVertices.kind).toBe("temporal_vertices");
		});

		it("should support time-ordered graphs", () => {
			const timeOrdered: Temporal = { kind: "time_ordered" };
			expect(timeOrdered.kind).toBe("time_ordered");
		});
	});

	describe("Layering", () => {
		it("should support single layer", () => {
			const single: Layering = { kind: "single_layer" };
			expect(single.kind).toBe("single_layer");
		});

		it("should support multi-layer", () => {
			const multi: Layering = { kind: "multi_layer" };
			expect(multi.kind).toBe("multi_layer");
		});

		it("should support multiplex networks", () => {
			const multiplex: Layering = { kind: "multiplex" };
			expect(multiplex.kind).toBe("multiplex");
		});

		it("should support interdependent networks", () => {
			const interdependent: Layering = { kind: "interdependent" };
			expect(interdependent.kind).toBe("interdependent");
		});
	});

	describe("EdgeOrdering", () => {
		it("should support unordered edges", () => {
			const unordered: EdgeOrdering = { kind: "unordered" };
			expect(unordered.kind).toBe("unordered");
		});

		it("should support ordered edges", () => {
			const ordered: EdgeOrdering = { kind: "ordered" };
			expect(ordered.kind).toBe("ordered");
		});
	});

	describe("Ports", () => {
		it("should support no ports", () => {
			const none: Ports = { kind: "none" };
			expect(none.kind).toBe("none");
		});

		it("should support port-labelled vertices", () => {
			const portLabelled: Ports = { kind: "port_labelled_vertices" };
			expect(portLabelled.kind).toBe("port_labelled_vertices");
		});
	});

	describe("Observability", () => {
		it("should support fully specified graphs", () => {
			const fullySpecified: Observability = { kind: "fully_specified" };
			expect(fullySpecified.kind).toBe("fully_specified");
		});

		it("should support partially observed graphs", () => {
			const partial: Observability = { kind: "partially_observed" };
			expect(partial.kind).toBe("partially_observed");
		});

		it("should support latent/inferred graphs", () => {
			const latent: Observability = { kind: "latent_or_inferred" };
			expect(latent.kind).toBe("latent_or_inferred");
		});
	});

	describe("OperationalSemantics", () => {
		it("should support structural only", () => {
			const structural: OperationalSemantics = { kind: "structural_only" };
			expect(structural.kind).toBe("structural_only");
		});

		it("should support annotated with functions", () => {
			const annotated: OperationalSemantics = {
				kind: "annotated_with_functions",
			};
			expect(annotated.kind).toBe("annotated_with_functions");
		});

		it("should support executable semantics", () => {
			const executable: OperationalSemantics = { kind: "executable" };
			expect(executable.kind).toBe("executable");
		});
	});

	describe("MeasureSemantics", () => {
		it("should support no measure", () => {
			const none: MeasureSemantics = { kind: "none" };
			expect(none.kind).toBe("none");
		});

		it("should support metric measure", () => {
			const metric: MeasureSemantics = { kind: "metric" };
			expect(metric.kind).toBe("metric");
		});

		it("should support cost measure", () => {
			const cost: MeasureSemantics = { kind: "cost" };
			expect(cost.kind).toBe("cost");
		});

		it("should support utility measure", () => {
			const utility: MeasureSemantics = { kind: "utility" };
			expect(utility.kind).toBe("utility");
		});
	});
});
