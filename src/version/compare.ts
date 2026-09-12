/**
 * Compare two semver-ish strings. Returns negative if a < b, 0 if equal,
 * positive if a > b. Only major.minor.patch parts are considered; pre-release
 * suffixes are ignored.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (s: string) =>
    s
      .split("-")[0]!
      .split(".")
      .slice(0, 3)
      .map((x) => Number.parseInt(x, 10) || 0);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return (aMaj ?? 0) - (bMaj ?? 0);
  if (aMin !== bMin) return (aMin ?? 0) - (bMin ?? 0);
  return (aPat ?? 0) - (bPat ?? 0);
}
