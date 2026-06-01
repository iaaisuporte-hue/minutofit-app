import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { usePhysicalActivityClearance } from './usePhysicalActivityClearance';

/**
 * Route guard: blocks access to physical-activity routes for users (role='user')
 * that have not signed a valid, non-expired PAR-Q+.
 *
 * Non-user roles always pass through (clearance is student-only).
 * Redirects to /app/user/parq?returnTo=<current-path> so the signing page
 * can send the user back after success.
 */
export default function RequireClearance({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const clearance = usePhysicalActivityClearance();
  const location = useLocation();

  if (role !== 'user') return <>{children}</>;

  if (!clearance.valid) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/app/user/parq?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
