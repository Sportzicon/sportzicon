export function hasRole(userRole: string, ...roles: string[]): boolean {
  return roles.includes(userRole) || userRole === "admin";
}
export function isAdmin(userRole: string): boolean {
  return userRole === "admin";
}
