/**
 * A list shown in the order captured when a hold began (`seen`), so live
 * re-ranks don't move items under the pointer: items still present keep that
 * order, items that left are dropped, new items join at the end. `seen` null
 * means not held: the list as given.
 */
export function holdOrder<T>(seen: string[] | null, items: T[], key: (t: T) => string): T[] {
  if (!seen) return items;
  const by = new Map(items.map(i => [key(i), i]));
  const kept = seen.map(k => by.get(k)).filter((i): i is T => i !== undefined);
  const known = new Set(seen);
  return [...kept, ...items.filter(i => !known.has(key(i)))];
}
