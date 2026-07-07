import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { hasRole } from "../utils/roles";
import type { Role } from "../types";

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, accessToken } = useAuthStore();
  const loc = useLocation();
  if (!user || !accessToken) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !hasRole(user.role, ...roles)) return <Navigate to="/feed" replace />;
  return <>{children}</>;
}
