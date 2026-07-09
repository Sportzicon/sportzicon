export function calculateAge(dob: string | null | undefined, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;

  let age = asOf.getFullYear() - d.getFullYear();
  const monthDay = (date: Date) => date.getMonth() * 100 + date.getDate();
  if (monthDay(asOf) < monthDay(d)) age -= 1;
  return age;
}

export function isMinorAge(dob: string | null | undefined, asOf: Date = new Date()): boolean {
  const age = calculateAge(dob, asOf);
  return age !== null && age < 18;
}
