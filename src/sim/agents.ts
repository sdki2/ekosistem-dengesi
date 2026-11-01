export const enum Species {
  Rabbit = 0,
  Wolf = 1,
  /** optional large grazer: competes with rabbits, hard but rewarding prey for wolves */
  Deer = 2,
  /** small nocturnal hunter of rabbits; avoids wolves and bears */
  Fox = 3,
  /** big omnivore: berries, fish, the odd catch; hibernates in winter */
  Bear = 4,
}

export const SPECIES_COUNT = 5;

export const enum AState {
  Wander = 0,
  SeekFood = 1,
  Eat = 2,
  Flee = 3,
  SeekWater = 4,
  Drink = 5,
  Sleep = 6,
  Hide = 7,
  Hunt = 8,
  Rest = 9,
}

export type DeathCause = 'starved' | 'old' | 'thirst' | 'eaten' | 'disease' | 'removed' | 'weather';

/**
 * Struct-of-arrays agent pool. Slots are reused through a free list.
 * Every agent also has a unique `uid` so the UI can follow it safely.
 */
export class AgentStore {
  cap = 0;
  /** one past the highest slot ever used */
  hi = 0;
  free: number[] = [];
  nextUid = 1;

  alive!: Uint8Array;
  species!: Uint8Array;
  state!: Uint8Array;
  uid!: Int32Array;
  target!: Int32Array;
  bornTick!: Int32Array;
  x!: Float32Array;
  y!: Float32Array;
  px!: Float32Array;
  py!: Float32Array;
  hx!: Float32Array;
  hy!: Float32Array;
  tx!: Float32Array;
  ty!: Float32Array;
  energy!: Float32Array;
  age!: Float32Array;
  maxAge!: Float32Array;
  thirst!: Float32Array;
  stamina!: Float32Array;
  cooldown!: Float32Array;
  rest!: Float32Array;

  static readonly FIELDS = [
    'alive', 'species', 'state', 'uid', 'target', 'bornTick',
    'x', 'y', 'px', 'py', 'hx', 'hy', 'tx', 'ty',
    'energy', 'age', 'maxAge', 'thirst', 'stamina', 'cooldown', 'rest',
  ] as const;

  constructor(cap = 2048) {
    this.allocate(cap);
  }

  private allocate(cap: number): void {
    const old = this.cap > 0 ? this.snapshotArrays() : null;
    this.cap = cap;
    this.alive = new Uint8Array(cap);
    this.species = new Uint8Array(cap);
    this.state = new Uint8Array(cap);
    this.uid = new Int32Array(cap);
    this.target = new Int32Array(cap).fill(-1);
    this.bornTick = new Int32Array(cap);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.px = new Float32Array(cap);
    this.py = new Float32Array(cap);
    this.hx = new Float32Array(cap);
    this.hy = new Float32Array(cap);
    this.tx = new Float32Array(cap);
    this.ty = new Float32Array(cap);
    this.energy = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.maxAge = new Float32Array(cap);
    this.thirst = new Float32Array(cap);
    this.stamina = new Float32Array(cap);
    this.cooldown = new Float32Array(cap);
    this.rest = new Float32Array(cap);
    if (old) {
      for (const f of AgentStore.FIELDS) {
        (this[f] as { set(a: ArrayLike<number>): void }).set(old[f] as ArrayLike<number>);
      }
    }
  }

  private snapshotArrays(): Record<string, ArrayLike<number>> {
    const r: Record<string, ArrayLike<number>> = {};
    for (const f of AgentStore.FIELDS) r[f] = this[f];
    return r;
  }

  /** reserve a slot; caller fills the fields */
  spawn(): number {
    let i: number;
    if (this.free.length > 0) i = this.free.pop()!;
    else {
      if (this.hi >= this.cap) this.allocate(this.cap * 2);
      i = this.hi++;
    }
    this.alive[i] = 1;
    this.uid[i] = this.nextUid++;
    this.target[i] = -1;
    this.state[i] = AState.Wander;
    this.rest[i] = 0;
    this.thirst[i] = 0;
    return i;
  }

  release(i: number): void {
    this.alive[i] = 0;
    this.free.push(i);
  }

  findByUid(uid: number): number {
    for (let i = 0; i < this.hi; i++) if (this.alive[i] && this.uid[i] === uid) return i;
    return -1;
  }

  serialize(): AgentSnapshot {
    const arrays: Record<string, number[] | ArrayBufferView> = {};
    for (const f of AgentStore.FIELDS) arrays[f] = (this[f] as Float32Array).slice(0, this.hi);
    return { cap: this.cap, hi: this.hi, free: this.free.slice(), nextUid: this.nextUid, arrays };
  }

  static deserialize(s: AgentSnapshot): AgentStore {
    const a = new AgentStore(Math.max(s.cap, 16));
    a.hi = s.hi;
    a.free = s.free.slice();
    a.nextUid = s.nextUid;
    for (const f of AgentStore.FIELDS) {
      (a[f] as { set(a: ArrayLike<number>): void }).set(s.arrays[f] as unknown as ArrayLike<number>);
    }
    return a;
  }
}

export interface AgentSnapshot {
  cap: number;
  hi: number;
  free: number[];
  nextUid: number;
  arrays: Record<string, number[] | ArrayBufferView>;
}
