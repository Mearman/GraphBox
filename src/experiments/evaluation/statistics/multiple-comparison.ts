/**
 * Multiple comparison correction for controlling family-wise error rate
 */

/**
 * Bonferroni correction for multiple comparisons.
 *
 * Controls family-wise error rate (FWER) by dividing alpha by the
 * number of tests. Very conservative but simple.
 *
 * @param pValues - Array of p-values from multiple tests
 * @param alpha - Original significance level (default: 0.05)
 * @returns Corrected alpha threshold and which tests are significant
 *
 * @example
 * ```typescript
 * const pValues = [0.001, 0.02, 0.045, 0.08, 0.12];
 * const result = bonferroniCorrection(pValues, 0.05);
 * console.log(result.correctedAlpha); // 0.01 (0.05 / 5 tests)
 * console.log(result.significant);     // [true, false, false, false, false]
 * ```
 */
export const bonferroniCorrection = (pValues: number[], alpha: number = 0.05): { correctedAlpha: number; significant: boolean[] } => {
	if (pValues.length === 0) {
		return { correctedAlpha: alpha, significant: [] };
	}

	// Divide alpha by number of tests
	const correctedAlpha = alpha / pValues.length;

	// Determine which tests are significant
	const significant = pValues.map(p => p < correctedAlpha);

	return { correctedAlpha, significant };
};

/**
 * Benjamini-Hochberg FDR correction.
 *
 * Controls false discovery rate (FDR) rather than FWER. Less conservative
 * than Bonferroni, making it more powerful for large numbers of tests.
 *
 * Procedure:
 * 1. Sort p-values in ascending order
 * 2. Find largest k such that p_k ≤ (k/m) * FDR
 * 3. Reject all hypotheses 1, 2, ..., k
 *
 * @param pValues - Array of p-values from multiple tests
 * @param fdr - Target false discovery rate (default: 0.05)
 * @returns Adjusted p-values and which tests are significant
 *
 * @example
 * ```typescript
 * const pValues = [0.001, 0.02, 0.045, 0.08, 0.12];
 * const result = benjaminiHochberg(pValues, 0.05);
 * console.log(result.adjustedPValues); // [0.005, 0.05, 0.075, 0.1, 0.12]
 * console.log(result.significant);     // [true, true, false, false, false]
 * ```
 */
export const benjaminiHochberg = (pValues: number[], fdr: number = 0.05): { adjustedPValues: number[]; significant: boolean[] } => {
	if (pValues.length === 0) {
		return { adjustedPValues: [], significant: [] };
	}

	const m = pValues.length;

	// Create indexed p-values for sorting
	const indexed = pValues.map((p, index) => ({ p, i: index }));

	// Sort by p-value
	indexed.sort((a, b) => a.p - b.p);

	// Calculate adjusted p-values
	const adjusted: Array<{ p: number; i: number; adjusted: number }> = [];
	for (const [index, element] of indexed.entries()) {
		const { p, i } = element;
		// BH adjustment: p_adjusted = p * m / (j + 1)
		const adjustedP = p * m / (index + 1);
		adjusted.push({ p, i, adjusted: Math.min(adjustedP, 1) });
	}

	// Ensure monotonicity (adjusted p-values should be non-decreasing)
	for (let index = adjusted.length - 2; index >= 0; index--) {
		adjusted[index].adjusted = Math.min(adjusted[index].adjusted, adjusted[index + 1].adjusted);
	}

	// Create result array in original order
	const adjustedPValues: number[] = Array.from({length: pValues.length});
	const significant: boolean[] = Array.from({length: pValues.length});

	for (const { i, adjusted: adjP } of adjusted) {
		adjustedPValues[i] = adjP;
		significant[i] = adjP < fdr;
	}

	return { adjustedPValues, significant };
};

/**
 * Holm-Bonferroni method (step-down procedure).
 *
 * Less conservative than Bonferroni but still controls FWER.
 * More powerful than Bonferroni when not all hypotheses are rejected.
 *
 * Procedure:
 * 1. Sort p-values in ascending order
 * 2. Compare smallest p-value to α/m, next to α/(m-1), etc.
 * 3. Stop when you find first non-significant p-value
 *
 * @param pValues - Array of p-values from multiple tests
 * @param alpha - Original significance level (default: 0.05)
 * @returns Adjusted p-values and which tests are significant
 *
 * @example
 * ```typescript
 * const pValues = [0.001, 0.02, 0.045, 0.08, 0.12];
 * const result = holmBonferroni(pValues, 0.05);
 * console.log(result.significant); // [true, false, false, false, false]
 * ```
 */
export const holmBonferroni = (pValues: number[], alpha: number = 0.05): { adjustedPValues: number[]; significant: boolean[] } => {
	if (pValues.length === 0) {
		return { adjustedPValues: [], significant: [] };
	}

	const m = pValues.length;

	// Create indexed p-values for sorting
	const indexed = pValues.map((p, index) => ({ p, i: index }));

	// Sort by p-value
	indexed.sort((a, b) => a.p - b.p);

	// Calculate adjusted p-values using step-down procedure
	const adjusted: Array<{ i: number; adjusted: number }> = [];
	let previousAdjusted = 0;

	for (const [index, element] of indexed.entries()) {
		const { p, i } = element;
		// Holm adjustment: p_adjusted = max(p * (m - j), previous)
		const adjustedP = Math.max(p * (m - index), previousAdjusted);
		adjusted.push({ i, adjusted: Math.min(adjustedP, 1) });
		previousAdjusted = adjustedP;
	}

	// Determine significance (step-down procedure)
	const significantMap = new Map<number, boolean>();
	let rejectThreshold = m;

	for (let index = 0; index < indexed.length; index++) {
		const { p, i } = indexed[index];
		if (p < alpha / rejectThreshold) {
			significantMap.set(i, true);
			rejectThreshold--;
		} else {
			// Stop rejecting
			significantMap.set(i, false);
			for (let k = index + 1; k < indexed.length; k++) {
				significantMap.set(indexed[k].i, false);
			}
			break;
		}
	}

	// Create result array in original order
	const adjustedPValues: number[] = Array.from({length: pValues.length});
	const significant: boolean[] = Array.from({length: pValues.length});

	for (const { i, adjusted: adjP } of adjusted) {
		adjustedPValues[i] = adjP;
		significant[i] = significantMap.get(i) ?? false;
	}

	return { adjustedPValues, significant };
};

/**
 * Storey's q-value method (FDR-based with estimation of true nulls).
 *
 * More powerful than BH when many hypotheses are truly null.
 * Estimates π₀ (proportion of true null hypotheses) from data.
 *
 * @param pValues - Array of p-values from multiple tests
 * @param fdr - Target false discovery rate (default: 0.05)
 * @param lambda - Tuning parameter for π₀ estimation (default: 0.5)
 * @returns Q-values and which tests are significant
 *
 * @example
 * ```typescript
 * const pValues = [0.001, 0.02, 0.045, 0.08, 0.12, 0.35, 0.42, 0.55];
 * const result = storeyQValues(pValues, 0.05, 0.5);
 * console.log(result.qValues); // Estimated q-values
 * console.log(result.significant); // Which tests are significant at FDR=0.05
 * ```
 */
export const storeyQValues = (pValues: number[], fdr: number = 0.05, lambda: number = 0.5): { qValues: number[]; significant: boolean[]; pi0: number } => {
	if (pValues.length === 0) {
		return { qValues: [], significant: [], pi0: 1 };
	}

	const m = pValues.length;

	// Estimate π₀ (proportion of true nulls)
	const pValuesAboveLambda = pValues.filter(p => p > lambda);
	const pi0 = Math.min(1, (pValuesAboveLambda.length / m) / (1 - lambda));

	// Create indexed p-values for sorting
	const indexed = pValues.map((p, index) => ({ p, i: index }));

	// Sort by p-value
	indexed.sort((a, b) => a.p - b.p);

	// Calculate q-values
	const qValues: number[] = Array.from({length: pValues.length});
	const significant: boolean[] = Array.from({length: pValues.length});

	let previousQ = 0;
	for (let index = indexed.length - 1; index >= 0; index--) {
		const { p, i } = indexed[index];
		// q-value = p * m * π₀ / (j + 1)
		const q = Math.min(1, (p * m * pi0) / (index + 1));
		const qValue = Math.max(q, previousQ);
		qValues[i] = qValue;
		previousQ = qValue;
	}

	// Determine significance
	for (let index = 0; index < pValues.length; index++) {
		significant[index] = (qValues[index] ?? 0) < fdr;
	}

	return { qValues, significant, pi0 };
};
