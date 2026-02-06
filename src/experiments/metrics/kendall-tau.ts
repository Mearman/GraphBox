/**
 * Kendall's Tau-b Rank Correlation
 *
 * Implements Kendall's tau-b statistic for comparing two rankings.
 * Tau-b corrects for ties, making it suitable for centrality-based
 * rankings where tied scores are common.
 */

/**
 * Compute Kendall's tau-b rank correlation between two score arrays.
 *
 * Tau-b adjusts the denominator to account for ties in either ranking,
 * giving a value in [-1, 1]:
 *   - 1: perfect agreement
 *   - 0: no association
 *   - -1: perfect disagreement
 *
 * Both arrays must have the same length and represent scores for the
 * same items in the same order. Rankings are derived from scores
 * (higher score = better rank).
 *
 * @param scoresA - Scores from ranking method A
 * @param scoresB - Scores from ranking method B
 * @returns Kendall's tau-b correlation coefficient
 */
export const kendallTauB = (scoresA: number[], scoresB: number[]): number => {
	const n = scoresA.length;
	if (n < 2) return 0;

	let concordant = 0;
	let discordant = 0;
	let tiedA = 0;
	let tiedB = 0;

	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const diffA = scoresA[i] - scoresA[j];
			const diffB = scoresB[i] - scoresB[j];

			if (diffA === 0 && diffB === 0) {
				// Tied in both: contributes to neither concordant nor discordant
				continue;
			}

			if (diffA === 0) {
				tiedA++;
				continue;
			}

			if (diffB === 0) {
				tiedB++;
				continue;
			}

			if (Math.sign(diffA) === Math.sign(diffB)) {
				concordant++;
			} else {
				discordant++;
			}
		}
	}

	const n0 = concordant + discordant + tiedA + tiedB;
	if (n0 === 0) return 0;

	const denominator = Math.sqrt(
		(concordant + discordant + tiedA) * (concordant + discordant + tiedB),
	);

	if (denominator === 0) return 0;

	return (concordant - discordant) / denominator;
};
