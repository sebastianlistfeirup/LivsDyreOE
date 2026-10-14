export function nextRandom(state: number): number {
  let x = state >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function randomInt(state: number, bound: number): [number, number] {
  const next = nextRandom(state);
  return [next % bound, next];
}
