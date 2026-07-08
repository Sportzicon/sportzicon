import { v4 as uuidv4 } from "uuid";

export const newId = () => uuidv4();
export const now = () => Date.now();

// Deterministic pair id for follows/conversations: sort the two ids so (a,b)==(b,a).
export function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}
