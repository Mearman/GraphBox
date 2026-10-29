/**
 * Seeded graph perturbation helpers for robustness tests.
 *
 * Every random choice is drawn from a caller-supplied generator so a test's
 * perturbed graphs are identical on every run.
 */

export interface PerturbableEdge {
	source: string;
	target: string;
}

/**
 * Pseudo-random source returning values in [0, 1), such as `createSeededRng(seed)`.
 */
export type RandomSource = () => number;

/**
 * Creates a perturbed copy of an edge list by removing a random subset of edges.
 * The subset is chosen by a Fisher-Yates shuffle, so every subset of the kept size is equally likely.
 * @param edges - Original edges, left unmodified
 * @param removeFraction - Fraction of edges to remove, in [0, 1]
 * @param random - Source of randomness
 * @returns The `floor(edges.length * (1 - removeFraction))` kept edges, in shuffled order
 */
export const perturbEdges = <E extends PerturbableEdge>(
	edges: readonly E[],
	removeFraction: number,
	random: RandomSource,
): E[] => {
	const shuffled = [...edges];
	for (let index = shuffled.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}

	return shuffled.slice(0, Math.floor(edges.length * (1 - removeFraction)));
};

/**
 * Creates a perturbed copy of an edge list by adding random non-loop edges that are not already present.
 * Gives up after ten attempts per requested edge, so a near-complete graph may gain fewer edges than requested.
 * @param edges - Original edges, left unmodified
 * @param nodeIds - Nodes new edges may connect
 * @param addFraction - Number of edges to add as a fraction of `edges.length`
 * @param random - Source of randomness
 * @returns The original edges followed by the added edges
 */
export const addRandomEdges = <E extends PerturbableEdge>(
	edges: readonly E[],
	nodeIds: readonly string[],
	addFraction: number,
	random: RandomSource,
): Array<E | PerturbableEdge> => {
	const addCount = Math.floor(edges.length * addFraction);
	const newEdges: Array<E | PerturbableEdge> = [...edges];
	const existing = new Set(edges.map((e) => `${e.source}-${e.target}`));

	let added = 0;
	let attempts = 0;
	const maxAttempts = addCount * 10;

	while (added < addCount && attempts < maxAttempts) {
		const source = nodeIds[Math.floor(random() * nodeIds.length)];
		const target = nodeIds[Math.floor(random() * nodeIds.length)];
		const key = `${source}-${target}`;

		if (source !== target && !existing.has(key)) {
			newEdges.push({ source, target });
			existing.add(key);
			added++;
		}
		attempts++;
	}

	return newEdges;
};
