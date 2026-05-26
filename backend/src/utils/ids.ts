import { v4 as uuidv4 } from "uuid";

export const newId = () => uuidv4();
export const now = () => Date.now();

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Deterministic pair id for follows/conversations: sort the two ids so (a,b)==(b,a).
export function pairId(a: string, b: string): string {
  return [a, b].sort().join("_");
}
