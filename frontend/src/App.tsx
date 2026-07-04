import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { queryClient } from "./main";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function CrossTabSessionSync() {
  const navigate = useNavigate();
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "sportivox.auth") return;
      let hasSession = false;
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          hasSession = !!(parsed?.state?.user && parsed?.state?.accessToken);
        } catch { /* ignore */ }
      }
      if (!hasSession) {
        useAuthStore.getState().clear();
        queryClient.clear();
        navigate("/login", { replace: true });
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [navigate]);
  return null;
}

import { Layout } from "./components/Layout";
import PublicLayout from "./components/PublicLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/auth";

function AdaptiveLayout() {
  const user = useAuthStore(s => s.user);
  return user ? <Layout /> : <PublicLayout />;
}

// ── Lazy page imports — each route is a separate chunk ────────────────────────
const Landing             = lazy(() => import("./modules/landing/pages/Landing"));
const Login               = lazy(() => import("./modules/auth/pages/Login"));
const Signup              = lazy(() => import("./modules/auth/pages/Signup"));
const VerifyEmail         = lazy(() => import("./modules/auth/pages/VerifyEmail"));
const ForgotPassword      = lazy(() => import("./modules/auth/pages/ForgotPassword"));
const ResetPassword       = lazy(() => import("./modules/auth/pages/ResetPassword"));

const Dashboard           = lazy(() => import("./modules/dashboard/pages/Dashboard"));
const Profile             = lazy(() => import("./modules/profile/pages/Profile"));
const EditProfile         = lazy(() => import("./modules/profile/pages/EditProfile"));
const Search              = lazy(() => import("./modules/search/pages/Search"));
const Opportunities       = lazy(() => import("./modules/opportunities/pages/Opportunities"));
const OpportunityDetail   = lazy(() => import("./modules/opportunities/pages/OpportunityDetail"));
const NewOpportunity      = lazy(() => import("./modules/opportunities/pages/NewOpportunity"));
const Tournaments         = lazy(() => import("./modules/tournaments/pages/Tournaments"));
const NewTournament       = lazy(() => import("./modules/tournaments/pages/NewTournament"));
const Applicants          = lazy(() => import("./modules/applications/pages/Applicants"));
const MyApplications      = lazy(() => import("./modules/applications/pages/MyApplications"));
const Feed                = lazy(() => import("./modules/feed/pages/Feed"));
const Reels               = lazy(() => import("./modules/reels/pages/Reels"));
const Blogs               = lazy(() => import("./modules/blogs/pages/Blogs"));
const BlogDetail          = lazy(() => import("./modules/blogs/pages/BlogDetail"));
const NewBlog             = lazy(() => import("./modules/blogs/pages/NewBlog"));
const Messages            = lazy(() => import("./modules/messaging/pages/Messages"));
const Notifications       = lazy(() => import("./modules/notifications/pages/Notifications"));
const MyOrganizations     = lazy(() => import("./modules/organizations/pages/MyOrganizations"));
const NewOrganization     = lazy(() => import("./modules/organizations/pages/NewOrganization"));
const OrganizationDetail  = lazy(() => import("./modules/organizations/pages/OrganizationDetail"));
const Organizations       = lazy(() => import("./modules/organizations/pages/Organizations"));
const AITips              = lazy(() => import("./modules/dashboard/pages/AITips"));

// Admin — separate chunk, only loaded when admin navigates here
const Admin                     = lazy(() => import("./modules/admin/pages/Admin"));
const AdminUsers                = lazy(() => import("./modules/admin/pages/AdminUsers"));
const AdminUserDetail           = lazy(() => import("./modules/admin/pages/AdminUserDetail"));
const AdminReports              = lazy(() => import("./modules/admin/pages/AdminReports"));
const AdminVerifications        = lazy(() => import("./modules/admin/pages/AdminVerifications"));
const AdminAuditLog             = lazy(() => import("./modules/admin/pages/AdminAuditLog"));
const AdminOpportunities        = lazy(() => import("./modules/admin/pages/AdminOpportunities"));
const AdminOrganizations        = lazy(() => import("./modules/admin/pages/AdminOrganizations"));
const AdminApplications         = lazy(() => import("./modules/admin/pages/AdminApplications"));
const AdminCreateUser           = lazy(() => import("./modules/admin/pages/AdminCreateUser"));
const AdminCreateOrganization   = lazy(() => import("./modules/admin/pages/AdminCreateOrganization"));
const AdminCreateOpportunity    = lazy(() => import("./modules/admin/pages/AdminCreateOpportunity"));
const AdminScoring              = lazy(() => import("./modules/admin/pages/AdminScoring"));

// Live scores + scoring console — separate chunks
const LiveScores            = lazy(() => import("./modules/live-scoring/pages/LiveScores"));
const LiveScoreDetail       = lazy(() => import("./modules/live-scoring/pages/LiveScoreDetail"));
const ScoringHome           = lazy(() => import("./modules/live-scoring/pages/ScoringHome"));
const ScoringTournaments    = lazy(() => import("./modules/live-scoring/pages/ScoringTournaments"));
const ScoringNewTournament  = lazy(() => import("./modules/live-scoring/pages/ScoringNewTournament"));
const ScoringTournamentDetail = lazy(() => import("./modules/live-scoring/pages/ScoringTournamentDetail"));
const ScoringMatchDetail    = lazy(() => import("./modules/live-scoring/pages/ScoringMatchDetail"));
const ScoringLive           = lazy(() => import("./modules/live-scoring/pages/ScoringLive"));
const ScoringInningsAnalytics = lazy(() => import("./modules/live-scoring/pages/ScoringInningsAnalytics"));
const ScoringAllMatches     = lazy(() => import("./modules/live-scoring/pages/ScoringAllMatches"));
const ScoringPlayerStats    = lazy(() => import("./modules/live-scoring/pages/ScoringPlayerStats"));
const ScoringMatchConfig    = lazy(() => import("./modules/live-scoring/pages/ScoringMatchConfig"));

// Minimal spinner shown while a page chunk is downloading
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <CrossTabSessionSync />
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing key="home" />} />
        <Route path="/how-it-works" element={<Landing key="how-it-works" initialView="how-it-works" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<AdaptiveLayout />}>
        <Route path="/live-scores" element={<LiveScores />} />
        <Route path="/live-scores/:matchId" element={<LiveScoreDetail />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/opportunities" element={<ProtectedRoute><Opportunities /></ProtectedRoute>} />
        <Route path="/opportunities/new" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewOpportunity /></ProtectedRoute>} />
        <Route path="/opportunities/:id/edit" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewOpportunity /></ProtectedRoute>} />
        <Route path="/opportunities/:id" element={<ProtectedRoute><OpportunityDetail /></ProtectedRoute>} />
        <Route path="/opportunities/:id/applicants" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><Applicants /></ProtectedRoute>} />
        <Route path="/tournaments" element={<ProtectedRoute><Tournaments /></ProtectedRoute>} />
        <Route path="/tournaments/new" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewTournament /></ProtectedRoute>} />
        <Route path="/tournaments/:id/edit" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewTournament /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute roles={["athlete"]}><MyApplications /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
        <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
        <Route path="/blogs" element={<ProtectedRoute><Blogs /></ProtectedRoute>} />
        <Route path="/blogs/new" element={<ProtectedRoute><NewBlog /></ProtectedRoute>} />
        <Route path="/blogs/:id/edit" element={<ProtectedRoute><NewBlog /></ProtectedRoute>} />
        <Route path="/blogs/:id" element={<ProtectedRoute><BlogDetail /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/messages/:id" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
        <Route path="/my-organizations" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><MyOrganizations /></ProtectedRoute>} />
        <Route path="/organizations/new" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewOrganization /></ProtectedRoute>} />
        <Route path="/organizations/:id/edit" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><NewOrganization /></ProtectedRoute>} />
        <Route path="/organizations/:id" element={<ProtectedRoute><OrganizationDetail /></ProtectedRoute>} />
        <Route path="/ai-tips" element={<ProtectedRoute roles={["athlete"]}><AITips /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><Admin /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/users/create" element={<ProtectedRoute roles={["admin"]}><AdminCreateUser /></ProtectedRoute>} />
        <Route path="/admin/users/:id" element={<ProtectedRoute roles={["admin"]}><AdminUserDetail /></ProtectedRoute>} />
        <Route path="/admin/opportunities" element={<ProtectedRoute roles={["admin"]}><AdminOpportunities /></ProtectedRoute>} />
        <Route path="/admin/opportunities/create" element={<ProtectedRoute roles={["admin"]}><AdminCreateOpportunity /></ProtectedRoute>} />
        <Route path="/admin/organizations" element={<ProtectedRoute roles={["admin"]}><AdminOrganizations /></ProtectedRoute>} />
        <Route path="/admin/organizations/create" element={<ProtectedRoute roles={["admin"]}><AdminCreateOrganization /></ProtectedRoute>} />
        <Route path="/admin/applications" element={<ProtectedRoute roles={["admin"]}><AdminApplications /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/verifications" element={<ProtectedRoute roles={["admin"]}><AdminVerifications /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute roles={["admin"]}><AdminAuditLog /></ProtectedRoute>} />
        <Route path="/admin/scoring" element={<ProtectedRoute roles={["admin"]}><AdminScoring /></ProtectedRoute>} />

        <Route path="/scoring" element={<ProtectedRoute><ScoringHome /></ProtectedRoute>} />
        <Route path="/scoring/tournaments" element={<ProtectedRoute><ScoringTournaments /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/new" element={<ProtectedRoute><ScoringNewTournament /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/:id/edit" element={<ProtectedRoute><ScoringNewTournament /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/:id" element={<ProtectedRoute><ScoringTournamentDetail /></ProtectedRoute>} />
        <Route path="/scoring/matches" element={<ProtectedRoute><ScoringAllMatches /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId" element={<ProtectedRoute><ScoringMatchDetail /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId/score" element={<ProtectedRoute><ScoringLive /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId/config" element={<ProtectedRoute><ScoringMatchConfig /></ProtectedRoute>} />
        <Route path="/scoring/innings/:inningsId/analytics" element={<ProtectedRoute><ScoringInningsAnalytics /></ProtectedRoute>} />
        <Route path="/scoring/players/:playerId" element={<ProtectedRoute><ScoringPlayerStats /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<div className="p-10 text-center text-slate-600">404 — not found</div>} />
    </Routes>
    </Suspense>
    </>
  );
}
