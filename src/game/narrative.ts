import { STR, fmt } from '../content/i18n';
import { Species } from '../sim/agents';
import { countPeaksDaily } from './peaks';
import type { World } from '../sim/world';

/**
 * Turn recorded data into a plain-language story of a collapse, e.g.
 * "Kurt sayısı 40. günde 35'e yükseldi. Tavşanlar 52. günde tükendi…"
 */
export function collapseNarrative(w: World, species: Species, day: number): { lines: string[]; lesson: string } {
  const C = STR.collapse;
  const days = w.history.days;
  const lines: string[] = [];
  if (!days.length) return { lines: [fmt(species === Species.Rabbit ? C.rabbitsGoneOther : C.wolvesGoneOther, { day })], lesson: '' };

  // look back over the last ~60 days for the story
  const from = Math.max(0, days.length - 60);
  const recent = days.slice(from);
  const peakR = recent.reduce((a, d) => (d.rabbits > a.rabbits ? d : a), recent[0]!);
  const peakW = recent.reduce((a, d) => (d.wolves > a.wolves ? d : a), recent[0]!);
  const minP = recent.reduce((a, d) => (d.plantCover < a.plantCover ? d : a), recent[0]!);

  if (peakR.rabbits > 0) lines.push(fmt(C.rabbitPeak, { day: peakR.day, n: peakR.rabbits }));
  if (minP.plantCover < 20 && minP.day >= peakR.day - 5) lines.push(fmt(C.overgrazing, { day: minP.day, p: minP.plantCover.toFixed(0) }));
  if (peakW.wolves > 0) lines.push(fmt(C.wolfPeak, { day: peakW.day, n: peakW.wolves }));

  // causes over the last 15 days
  const tail = days.slice(-15);
  const sum = (k: 'rabbitDeaths' | 'wolfDeaths', c: 'starved' | 'eaten' | 'thirst' | 'old') => tail.reduce((a, d) => a + d[k][c], 0);
  if (species === Species.Rabbit) {
    const eaten = sum('rabbitDeaths', 'eaten');
    const starved = sum('rabbitDeaths', 'starved');
    const thirst = sum('rabbitDeaths', 'thirst');
    const top = Math.max(eaten, starved, thirst);
    const key = top === 0 ? C.rabbitsGoneOther : top === eaten ? C.rabbitsGoneEaten : top === starved ? C.rabbitsGoneStarved : C.rabbitsGoneThirst;
    lines.push(fmt(key, { day }));
  } else {
    const starved = sum('wolfDeaths', 'starved');
    const old = sum('wolfDeaths', 'old');
    const key = starved === 0 && old === 0 ? C.wolvesGoneOther : starved >= old ? C.wolvesGoneStarved : C.wolvesGoneOld;
    lines.push(fmt(key, { day }));
  }
  // keep chronological order
  const dayOf = (s: string) => Number(/(\d+)\. günde/.exec(s)?.[1] ?? 0);
  lines.sort((a, b) => dayOf(a) - dayOf(b));
  return { lines, lesson: species === Species.Rabbit ? C.lesson.rabbit : C.lesson.wolf };
}

/** end-of-level summary bullets */
export function levelSummary(w: World, spentFrac: number, meanDiversity: number, negativeEvents: number): { good: string[]; bad: string[] } {
  const S = STR.summary;
  const days = w.history.days;
  const good: string[] = [];
  const bad: string[] = [];
  if (meanDiversity >= 55) good.push(fmt(S.goodDiversity, { n: meanDiversity.toFixed(0) }));
  const peaks = countPeaksDaily(days.map((d) => d.rabbits));
  if (peaks >= 2) good.push(fmt(S.goodCycle, { n: peaks }));
  if (isFinite(spentFrac) && spentFrac <= 0.3) good.push(Math.round(spentFrac * 100) === 0 ? S.goodNoSpend : fmt(S.goodBudget, { n: Math.round(spentFrac * 100) }));
  const minP = days.reduce((a, d) => (d.plantCover < a.plantCover ? d : a), days[0] ?? { plantCover: 100, day: 0 } as never);
  if (minP && minP.plantCover >= 20) good.push(fmt(S.goodPlants, { n: Math.floor(minP.plantCover) }));
  else if (minP) bad.push(fmt(S.badPlants, { day: minP.day, p: minP.plantCover.toFixed(0) }));
  const after = days.filter((d) => d.day > 5);
  if (after.length) {
    const minW = after.reduce((a, d) => (d.wolves < a.wolves ? d : a), after[0]!);
    const minR = after.reduce((a, d) => (d.rabbits < a.rabbits ? d : a), after[0]!);
    if (minW.wolves <= 3) bad.push(fmt(S.badWolvesLow, { day: minW.day, n: minW.wolves }));
    if (minR.rabbits <= 20) bad.push(fmt(S.badRabbitsLow, { day: minR.day, n: minR.rabbits }));
  }
  if (negativeEvents > 0) good.push(fmt(S.badEvents, { n: negativeEvents }));
  if (!bad.length) bad.push(S.nothingBad);
  return { good, bad };
}
