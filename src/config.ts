/**
 * Ekosistem Dengesi — every tunable number lives here.
 *
 * Units
 *  - Distance: tiles. Time: ticks (TICKS_PER_DAY ticks = 1 in-game day = 10 s at 1×).
 *  - Plant amount per tile: 0–100 (%).
 *  - Energy: rabbits 0–rabbit.maxEnergy, wolves 0–wolf.maxEnergy.
 *
 * TUNING NOTES (from `npm run balance` + a random/hill-climb parameter search, see README):
 *  Pure agent-based predator–prey systems crash easily: wolves over-hunt, rabbits
 *  vanish, wolves starve. Five realistic damping mechanisms keep the Easy scenario
 *  oscillating instead of collapsing:
 *   1. Plant carrying capacity — limited regrowth caps how many rabbits the land feeds.
 *   2. Wolf satiation / handling time — a fed wolf rests and does not hunt
 *      (Holling type II functional response).
 *   3. Rabbit refuge — rabbits hiding in bushes are only spotted at very short range.
 *   4. Wolf territoriality — wolves do not breed when too many wolves share the area.
 *   5. Rabbit warren crowding and a grass "root reserve" — limit overshoot and let land recover.
 *
 *  The search consistently favoured a short wolf sight radius (~5 tiles) and large,
 *  infrequent meals. That matches Rosenzweig–MacArthur theory: a predator that is a
 *  little *inefficient* keeps the prey above half of its carrying capacity, which
 *  turns a crash into a damped oscillation. Plants regrow at a fixed rate (as in the
 *  design brief) and rabbits follow a "giving-up density" (they leave thin patches),
 *  so a predator-controlled rabbit population leaves the land green (~30 % mean cover).
 *
 *  Result (300 days, 60 rabbits + 6 wolves, no player actions, 40 seeds each):
 *   - Orman: 95 % survive, ~4 rabbit peaks per run (cycle ≈ 60–75 days).
 *   - Nehir: 93 % survive.
 *  Full report: `npm run balance`.
 */

export const TICKS_PER_DAY = 20;

export interface SpeciesConfig {
  maxEnergy: number;
  /** energy lost per tick while active */
  metabolism: number;
  /** multiplier on metabolism while sleeping / resting */
  restMetabolismMul: number;
  walkSpeed: number;
  runSpeed: number;
  /** sight radius in tiles */
  vision: number;
  /** age (days) before the animal can reproduce */
  maturityDays: number;
  /** mean lifespan (days); each animal gets ±lifespanJitter */
  lifespanDays: number;
  lifespanJitter: number;
  /** energy needed to reproduce */
  reproThreshold: number;
  /** days between litters */
  reproCooldownDays: number;
  litterMin: number;
  litterMax: number;
  /** energy each newborn starts with (paid by the parent) */
  birthEnergy: number;
  /** extra energy the parent loses per newborn, on top of birthEnergy */
  birthCost: number;
  /** thirst gained per tick on the river map (dies at 100) */
  thirstPerTick: number;
  /** starts looking for water above this thirst */
  thirstSeek: number;
}

export interface SimConfig {
  ticksPerDay: number;
  width: number;
  height: number;
  /** hard cap on animals (performance budget) */
  maxAnimals: number;
  /** fraction of the day (from the end) that is night */
  nightFraction: number;

  plant: {
    /** fixed regrowth per tick (plant %), before season / water / shade multipliers */
    rate: number;
    /** tiles grazed below minEdible regrow at this fraction of the rate (damaged roots) */
    bareMul: number;
    /** regrowth multiplier for tiles shaded by trees */
    shadeMul: number;
    /** river map: next to water / far from water multipliers */
    nearWaterMul: number;
    farWaterMul: number;
    /** plant units a rabbit bites per tick */
    biteSize: number;
    /** below this amount a tile counts as "bare" for grazing */
    minEdible: number;
    /** global regrowth multiplier (sandbox slider) */
    regrowMul: number;
  };

  rabbit: SpeciesConfig & {
    /** energy gained per plant unit eaten */
    plantEnergy: number;
    /** giving-up density: leaves a patch below this plant % if a better one is nearby */
    giveUp: number;
    /** stops eating above this energy */
    fullEnergy: number;
    /** no breeding when this many rabbits are within crowdRadius (warren density) */
    crowdMax: number;
    crowdRadius: number;
    /** ticks of sprint before tiring */
    stamina: number;
    staminaRegen: number;
    /** extra energy per tick while sprinting */
    sprintCost: number;
  };

  deer: SpeciesConfig & {
    /** energy gained per plant unit eaten */
    plantEnergy: number;
    /** plant units bitten per tick */
    biteSize: number;
    /** leaves a patch below this plant % */
    giveUp: number;
    /** stops eating above this energy */
    fullEnergy: number;
    /** a wolf's catch chance is multiplied by this against deer */
    wolfCatchMul: number;
    /** a wolf's meal from deer = preyEnergy × this */
    wolfEnergyMul: number;
    /** sprint energy cost per tick while fleeing */
    fleeCost: number;
    /** energy per tick from browsing shrubs on a bush tile (deer niche: leaves grass to rabbits) */
    browseEnergy: number;
  };

  wolf: SpeciesConfig & {
    /** energy gained from catching one rabbit */
    preyEnergy: number;
    /** hunts only when energy is below this fraction of maxEnergy (satiation) */
    huntBelow: number;
    /** catch distance (tiles) and success chance per attempt */
    catchDist: number;
    catchChance: number;
    /** ticks a wolf rests after a kill (handling time) */
    handlingTicks: number;
    /** a rabbit hidden in a bush is only noticed within this distance */
    coverDetect: number;
    /** chance per check to sniff out a hidden rabbit beyond coverDetect */
    scentChance: number;
    /** no breeding when this many other wolves are within territoryRadius */
    territoryMax: number;
    territoryRadius: number;
    /** pack cohesion strength (0–1) */
    cohesion: number;
    /** extra energy per tick while chasing */
    chaseCost: number;
  };

  seasons: {
    /** length of one season in days */
    lengthDays: number;
    /** regrowth multipliers: spring, summer, autumn, winter */
    regrow: [number, number, number, number];
  };

  weather: {
    /** a weather spell lasts this many ticks (min..max) */
    minTicks: number;
    maxTicks: number;
    /** soil moisture 0–1 at start */
    moistureStart: number;
    /** regrowth multiplier = moistureBase + moistureGain * moisture */
    moistureBase: number;
    moistureGain: number;
    /** per-tick chance that a storm drops a lightning bolt */
    lightningChance: number;
    /** plants within this radius of a strike are scorched */
    lightningRadius: number;
    /** rabbits shelter in storms above this energy */
    shelterEnergy: number;
    /** wolves only hunt in storms below this energy fraction */
    stormHuntBelow: number;
    /** water level below which shore rank 1 / 2 / 3 tiles dry out */
    dryRank: [number, number, number];
  };

  /** time-of-day behaviour */
  time: {
    /** wolves catch more easily at dusk and night */
    wolfNightCatchMul: number;
    /** rabbits graze faster at dawn and dusk */
    rabbitTwilightBiteMul: number;
    /** hot midday rest window (day fraction) */
    siestaFrom: number;
    siestaTo: number;
  };

  events: {
    /** chance per day of a random event (when none is active) */
    dailyChance: number;
    /** minimum days between random events */
    minGapDays: number;
    droughtDays: number;
    droughtRegrowMul: number;
    winterDays: number;
    winterRegrowMul: number;
    winterMetabolismMul: number;
    diseaseMin: number;
    diseaseMax: number;
  };
}

export const DEFAULT_CONFIG: SimConfig = {
  ticksPerDay: TICKS_PER_DAY,
  width: 64,
  height: 40,
  maxAnimals: 1500,
  nightFraction: 0.3,

  plant: {
    rate: 0.15, // ≈3 %/day: a tile grazed from 100 % to 40 % recovers in ~3 weeks
    bareMul: 0.35, // overgrazed (bare) tiles recover much more slowly
    shadeMul: 0.6,
    nearWaterMul: 2.0,
    farWaterMul: 0.5,
    biteSize: 8,
    minEdible: 6, // "root reserve": rabbits cannot graze a tile below this
    regrowMul: 0.9,
  },

  rabbit: {
    maxEnergy: 100,
    metabolism: 0.5, // 10 energy/day → ~10 days from full to starving
    restMetabolismMul: 0.5,
    walkSpeed: 0.3,
    runSpeed: 0.7, // faster than a running wolf (0.62) …
    vision: 3.9,
    maturityDays: 5,
    lifespanDays: 30,
    lifespanJitter: 0.25,
    reproThreshold: 70,
    reproCooldownDays: 6.3,
    litterMin: 1,
    litterMax: 3,
    birthEnergy: 30,
    birthCost: 5,
    thirstPerTick: 0.4, // rabbits get much of their water from plants
    thirstSeek: 50,
    plantEnergy: 0.65,
    fullEnergy: 95,
    giveUp: 38, // optimal foraging: move on from thin patches instead of eating them bare
    crowdMax: 4, // warren crowding limits breeding at very high density
    crowdRadius: 2.5,
    stamina: 5, // … but only for short bursts (5 ticks), then they tire
    staminaRegen: 0.1,
    sprintCost: 0.4,
  },

  deer: {
    maxEnergy: 140,
    metabolism: 0.4,
    restMetabolismMul: 0.5,
    walkSpeed: 0.26,
    runSpeed: 0.6,
    vision: 4.6,
    maturityDays: 9,
    lifespanDays: 70,
    lifespanJitter: 0.2,
    reproThreshold: 85,
    reproCooldownDays: 13,
    litterMin: 1,
    litterMax: 1,
    birthEnergy: 35,
    birthCost: 8,
    thirstPerTick: 0.3,
    thirstSeek: 38,
    plantEnergy: 0.6,
    biteSize: 10,
    giveUp: 30,
    fullEnergy: 125,
    wolfCatchMul: 0.28,
    wolfEnergyMul: 2.2,
    fleeCost: 0.2,
    browseEnergy: 0.62,
  },

  wolf: {
    maxEnergy: 120,
    metabolism: 0.48, // ~9.6 energy/day → ~12 days from full to starving
    restMetabolismMul: 0.6,
    walkSpeed: 0.28,
    runSpeed: 0.62,
    vision: 5.0, // short sight = a less "perfect" predator; key for stable cycles
    maturityDays: 7.5,
    lifespanDays: 75,
    lifespanJitter: 0.2,
    reproThreshold: 90,
    reproCooldownDays: 8.5,
    litterMin: 1,
    litterMax: 3,
    birthEnergy: 40,
    birthCost: 10,
    thirstPerTick: 0.35,
    thirstSeek: 50,
    preyEnergy: 45, // one rabbit ≈ 4.5 days of food
    huntBelow: 0.5, // satiation: hunts only below 50 % energy
    catchDist: 0.8,
    catchChance: 0.7,
    handlingTicks: 13, // ~2/3 of a day eating/resting after a kill
    coverDetect: 3,
    scentChance: 0.08,
    territoryMax: 5,
    territoryRadius: 7,
    cohesion: 0.35,
    chaseCost: 0.25,
  },

  seasons: {
    lengthDays: 15,
    regrow: [1.5, 1.0, 0.6, 0.25],
  },

  weather: {
    minTicks: 12,
    maxTicks: 40,
    moistureStart: 0.6,
    moistureBase: 0.5,
    moistureGain: 1,
    lightningChance: 0.02,
    lightningRadius: 1.7,
    shelterEnergy: 40,
    stormHuntBelow: 0.3,
    dryRank: [0.5, 0.3, 0.14],
  },

  time: {
    wolfNightCatchMul: 1.1,
    rabbitTwilightBiteMul: 1.1,
    siestaFrom: 0.28,
    siestaTo: 0.52,
  },

  events: {
    dailyChance: 0.025,
    minGapDays: 25,
    droughtDays: 10,
    droughtRegrowMul: 0.3,
    winterDays: 8,
    winterRegrowMul: 0.15,
    winterMetabolismMul: 1.25,
    diseaseMin: 0.2,
    diseaseMax: 0.4,
  },
};

export function cloneConfig(c: SimConfig = DEFAULT_CONFIG): SimConfig {
  return JSON.parse(JSON.stringify(c)) as SimConfig;
}

/** Eco-point costs and income (game layer, not the simulation). */
export const ECONOMY = {
  rabbitCost: 4,
  wolfCost: 15,
  deerCost: 10,
  /** cost per tile painted with the plant brush */
  plantTileCost: 0.25,
  /** points per day at 100 % biodiversity; scaled by the Shannon score */
  incomePerDay: 3,
  /** no income while biodiversity is below this score */
  incomeMinScore: 40,
};
