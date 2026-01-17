import type { GraphGenerationConfig } from "../generator";
import type { GraphSpec } from "../spec";
import { SeededRandom, type TestNode } from "./types";

/**
 * Generate nodes with appropriate types and partitions.
 * @param spec - Graph specification
 * @param config - Generation configuration
 * @param rng - Seeded random number generator
 * @returns Array of generated nodes
 */
export const generateNodes = (
	spec: GraphSpec,
	config: GraphGenerationConfig,
	rng: SeededRandom
): TestNode[] => {
	const nodes: TestNode[] = [];

	// For bipartite graphs, determine partition sizes
	let leftPartitionSize = 0;
	let rightPartitionSize = 0;

	if (spec.partiteness?.kind === "bipartite") {
		// Split roughly 50-50, but handle odd numbers
		leftPartitionSize = Math.floor(config.nodeCount / 2);
		rightPartitionSize = config.nodeCount - leftPartitionSize;
	} else if (spec.completeBipartite?.kind === "complete_bipartite") {
		// Use specified m, n sizes
		const { m, n } = spec.completeBipartite;
		leftPartitionSize = Math.min(m, config.nodeCount);
		rightPartitionSize = Math.min(n, config.nodeCount - leftPartitionSize);
	}

	for (let index = 0; index < config.nodeCount; index++) {
		const node: TestNode = {
			id: `N${index}`,
		};

		// Assign bipartite partition if needed
		if (spec.partiteness?.kind === "bipartite" || spec.completeBipartite?.kind === "complete_bipartite") {
			if (index < leftPartitionSize) {
				node.partition = "left";
			} else if (index < leftPartitionSize + rightPartitionSize) {
				node.partition = "right";
			}
		}

		if (spec.schema.kind === "heterogeneous" && config.nodeTypes) {
			// Assign type based on proportions
			const rand = rng.next();
			let cumulative = 0;
			for (const { type, proportion } of config.nodeTypes) {
				cumulative += proportion;
				if (rand < cumulative) {
					node.type = type;
					break;
				}
			}
			if (!node.type) {
				const lastType = config.nodeTypes.at(-1);
				node.type = lastType?.type ?? "default";
			}
		}

		nodes.push(node);
	}

	return nodes;
};
