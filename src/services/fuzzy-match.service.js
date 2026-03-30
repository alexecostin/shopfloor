/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Find the best match for `value` among `candidates`.
 * @param {string} value
 * @param {string[]} candidates
 * @param {number} threshold - minimum similarity score (0-1)
 * @returns {{ match: string, score: number, isExact: boolean } | null}
 */
export function findBestMatch(value, candidates, threshold = 0.7) {
  if (!value || !candidates.length) return null;
  const v = String(value).toLowerCase().trim();

  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const c = String(candidate).toLowerCase().trim();
    if (v === c) return { match: candidate, score: 1, isExact: true };
    const maxLen = Math.max(v.length, c.length);
    if (maxLen === 0) continue;
    const dist = levenshtein(v, c);
    const score = 1 - dist / maxLen;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestScore >= threshold) {
    return { match: bestMatch, score: Math.round(bestScore * 100) / 100, isExact: false };
  }
  return null;
}
