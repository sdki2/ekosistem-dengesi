/** localStorage wrapper that never throws (private mode, blocked storage…) */
const KEY = 'ekosistem-dengesi:v1';

export interface SaveData {
  stars: Record<number, number>;
  tutorialDone: boolean;
  tipsSeen: string[];
  sound: boolean;
}

const DEFAULTS: SaveData = { stars: {}, tutorialDone: false, tipsSeen: [], sound: false };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return { ...structuredClone(DEFAULTS), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: progress lives only for this session */
  }
}

export function resetProgress(d: SaveData): void {
  d.stars = {};
  save(d);
}
