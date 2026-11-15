export type Save = { version: 1; bestDepth: number; bestPearls: number };

const KEY = "lumen-drift-v1";

const empty = (): Save => ({ version: 1, bestDepth: 0, bestPearls: 0 });

export function readSave(): Save {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.version !== 1) return empty();
    return {
      version: 1,
      bestDepth: Number(parsed.bestDepth) || 0,
      bestPearls: Number(parsed.bestPearls) || 0,
    };
  } catch {
    return empty();
  }
}

export function writeSave(save: Save) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode */
  }
}
