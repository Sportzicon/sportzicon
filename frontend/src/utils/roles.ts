export const ALL_ROLES = ["athlete", "club", "scout", "organizer", "scorer", "admin"] as const;
export type UserRole = typeof ALL_ROLES[number];

export function hasRole(userRole: string, ...roles: string[]): boolean {
  return roles.includes(userRole) || userRole === "admin";
}
export function isAdmin(userRole: string): boolean {
  return userRole === "admin";
}
