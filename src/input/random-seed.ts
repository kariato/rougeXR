/** Generate an unsigned 32-bit world seed, changing it even if the entropy repeats the current seed. */
export function randomWorldSeed(current: number, entropy = crypto.getRandomValues(new Uint32Array(1))[0]!): number {
  const value = entropy >>> 0;
  return value === current ? (value + 1) >>> 0 : value;
}
