export const COMPLEX_COURT_IDS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Extracts the numeric court ID from strings like "4", "Cancha 4", "Cancha 5: Final", etc.
 */
export function extractCourtNumber(canchaText: string | number | null | undefined): number | null {
  if (typeof canchaText === "number" && Number.isFinite(canchaText) && canchaText > 0) {
    return Math.trunc(canchaText);
  }
  if (!canchaText) return null;
  const trimmed = String(canchaText).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Parses and normalizes an array of active court IDs (or comma-separated query param string).
 * Returns a sorted, deduplicated array of positive integers.
 */
export function normalizeActiveCourtIds(
  raw: unknown,
  fallback: number[] = [...COMPLEX_COURT_IDS],
): number[] {
  let values: number[] = [];

  if (Array.isArray(raw)) {
    values = raw
      .map((item) => extractCourtNumber(item as string | number))
      .filter((num): num is number => num !== null);
  } else if (typeof raw === "string" && raw.trim().length > 0) {
    values = raw
      .split(",")
      .map((part) => extractCourtNumber(part))
      .filter((num): num is number => num !== null);
  }

  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a - b);
  return uniqueSorted.length > 0 ? uniqueSorted : [...fallback].sort((a, b) => a - b);
}

/**
 * Checks whether a match's `cancha` value belongs to the set of active court IDs.
 */
export function isCourtActive(
  canchaText: string | number | null | undefined,
  activeCourtIds: number[],
): boolean {
  if (!activeCourtIds || activeCourtIds.length === 0) return true;
  const num = extractCourtNumber(canchaText);
  if (num === null) return false;
  return activeCourtIds.includes(num);
}

/**
 * Returns responsive Tailwind grid classes tailored to the exact count of active courts
 * so there are never empty slots or unbalanced columns in TV or Admin views.
 */
export function getResponsiveCourtGridClass(
  count: number,
  variant: "tv-canchas" | "tv-zonas" | "tv-desafio" | "admin",
  options?: { withSidebar?: boolean },
): string {
  const safeCount = Math.max(1, count);

  if (variant === "tv-canchas") {
    if (safeCount === 1) return "grid-cols-1 max-w-3xl mx-auto w-full";
    if (safeCount === 2) return "grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto w-full";
    if (safeCount === 3) return "grid-cols-1 md:grid-cols-3 w-full";
    if (safeCount === 4) return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 w-full";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full";
  }

  if (variant === "tv-zonas") {
    if (safeCount === 1) return "grid-cols-1 max-w-xl mx-auto";
    if (safeCount === 2) return "grid-cols-1 sm:grid-cols-2";
    if (safeCount === 3) return "grid-cols-1 sm:grid-cols-3";
    if (safeCount === 4) return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  }

  if (variant === "tv-desafio") {
    const withSidebar = options?.withSidebar ?? true;
    if (safeCount === 1) return "grid-cols-1 max-w-2xl mx-auto w-full";
    if (safeCount === 2) return "grid-cols-1 lg:grid-cols-2";
    if (safeCount === 3) return withSidebar ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-3";
    if (safeCount === 4) return "grid-cols-1 md:grid-cols-2";
    return withSidebar
      ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  }

  // variant === "admin"
  if (safeCount === 1) return "grid-cols-1 max-w-xl";
  if (safeCount === 2) return "grid-cols-1 md:grid-cols-2";
  if (safeCount === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  if (safeCount === 4) return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}

