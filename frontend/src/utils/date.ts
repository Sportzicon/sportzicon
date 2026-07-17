// Canonical display format for dates across the app: "Jul 17, 2026".
export function formatDate(input: string | number | Date): string {
  return new Date(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Canonical display format for date + time: "Jul 17, 2026, 3:45 PM".
export function formatDateTime(input: string | number | Date): string {
  return new Date(input).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
