/** count peaks separated by ≥30 % troughs in a daily series (5-day smoothing) */
export function countPeaksDaily(xs: number[]): number {
  if (xs.length < 10) return 0;
  const s = xs.map((_, i) => {
    let a = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(xs.length - 1, i + 2); k++) {
      a += xs[k]!;
      n++;
    }
    return a / n;
  });
  let peaks = 0;
  let hi = s[0]!;
  let lo = s[0]!;
  let rising = true;
  for (const v of s) {
    if (rising) {
      if (v > hi) hi = v;
      else if (v < hi * 0.7) {
        peaks++;
        rising = false;
        lo = v;
      }
    } else {
      if (v < lo) lo = v;
      else if (v > lo * 1.3 + 2) {
        rising = true;
        hi = v;
      }
    }
  }
  return peaks;
}
