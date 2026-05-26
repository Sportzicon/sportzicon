import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import type { Role } from "../types";

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, accessToken } = useAuthStore();
  const loc = useLocation();
  if (!user || !accessToken) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
