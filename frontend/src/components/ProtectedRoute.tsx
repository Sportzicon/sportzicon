import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { hasRole } from "../utils/roles";
import type { Role } from "../types";

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, accessToken, hasHydrated } = useAuthStore();
  const loc = useLocation();
  // Persisted auth state loads asynchronously — on a hard page load (common on
  // mobile) don't redirect to /login on the tick before it's back, or a real
  // session gets bounced out.
  if (!hasHydrated) return null;
  if (!user || !accessToken) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !hasRole(user.role, ...roles)) return <Navigate to="/feed" replace />;
  return <>{children}</>;
}
