import type { MapKind } from '../sim/grid';
import type { ScheduledEvent } from '../sim/world';

export type Goal =
  | { kind: 'survive'; days: number }
  /** all species alive at `days` and mean plant cover of the last 15 days ≥ minCover */
  | { kind: 'recover'; days: number; minCover: number }
  /** all species alive at `days` and rabbit CV (day 20 → days) ≤ maxCv */
  | { kind: 'stable'; days: number; maxCv: number };

export interface LevelDef {
  id: number;
  map: MapKind;
  seed: number;
  rabbits: number;
  wolves: number;
  initialPlant?: [number, number];
  seasons: boolean;
  randomEvents: boolean;
  scheduled: ScheduledEvent[];
  budget: number;
  goal: Goal;
  stars: { diversity: number; budgetFrac: number };
  /** intended solution, shown nowhere in-game; documents solvability */
  solution: string;
}

/**
 * Scenario levels. Titles/intros live in i18n (STR.levels.list[id-1]).
 * Solvability is checked by tests/balance/runBalance.ts with a scripted player.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 1, map: 'forest', seed: 1201, rabbits: 60, wolves: 6,
    seasons: false, randomEvents: false, scheduled: [],
    budget: 60, goal: { kind: 'survive', days: 50 },
    stars: { diversity: 55, budgetFrac: 0.3 },
    solution: 'Do nothing; the default setup cycles. Add a wolf if they drop below 3.',
  },
  {
    id: 2, map: 'forest', seed: 2202, rabbits: 220, wolves: 0, initialPlant: [20, 50],
    seasons: false, randomEvents: false, scheduled: [],
    budget: 120, goal: { kind: 'recover', days: 60, minCover: 30 },
    stars: { diversity: 50, budgetFrac: 0.6 },
    solution: 'Place 5–8 wolves early (day 1–5) in rabbit-dense areas; optionally cull rabbits.',
  },
  {
    id: 3, map: 'river', seed: 3303, rabbits: 60, wolves: 6,
    seasons: false, randomEvents: false, scheduled: [{ day: 15, kind: 'drought' }],
    budget: 80, goal: { kind: 'survive', days: 60 },
    stars: { diversity: 50, budgetFrac: 0.5 },
    solution: 'Keep wolves ≥3 and rabbits ≥25 through the drought; plant near the river.',
  },
  {
    id: 4, map: 'forest', seed: 4404, rabbits: 60, wolves: 6,
    seasons: false, randomEvents: false, scheduled: [],
    budget: 100, goal: { kind: 'stable', days: 120, maxCv: 0.55 },
    stars: { diversity: 60, budgetFrac: 0.5 },
    solution: 'Cull rabbits above ~350 (free) and keep 4+ wolves, which flattens the peaks.',
  },
  {
    id: 5, map: 'river', seed: 5505, rabbits: 30, wolves: 3,
    seasons: false, randomEvents: false, scheduled: [],
    budget: 35, goal: { kind: 'survive', days: 80 },
    stars: { diversity: 50, budgetFrac: 0.6 },
    solution: 'Spend almost nothing early; save points for a wolf in the first trough (~day 50).',
  },
  {
    id: 6, map: 'forest', seed: 6606, rabbits: 60, wolves: 6,
    seasons: true, randomEvents: false, scheduled: [],
    budget: 80, goal: { kind: 'survive', days: 120 },
    stars: { diversity: 50, budgetFrac: 0.5 },
    solution: 'Winters crash rabbits: before winter, remove surplus wolves; in spring re-add.',
  },
  {
    id: 7, map: 'river', seed: 7707, rabbits: 70, wolves: 7,
    seasons: false, randomEvents: true, scheduled: [{ day: 30, kind: 'disease', species: 0 }],
    budget: 80, goal: { kind: 'survive', days: 100 },
    stars: { diversity: 50, budgetFrac: 0.5 },
    solution: 'After the rabbit epidemic, thin the wolves temporarily and restock rabbits.',
  },
  {
    id: 8, map: 'river', seed: 8808, rabbits: 70, wolves: 7,
    seasons: true, randomEvents: true, scheduled: [],
    budget: 60, goal: { kind: 'survive', days: 150 },
    stars: { diversity: 50, budgetFrac: 0.5 },
    solution: 'Combine all of the above; keep a reserve of points for emergencies.',
  },
];
