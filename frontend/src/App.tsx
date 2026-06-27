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
const Landing             = lazy(() => import("./pages/Landing"));
const Login               = lazy(() => import("./pages/Login"));
const Signup              = lazy(() => import("./pages/Signup"));
const VerifyEmail         = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword      = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword       = lazy(() => import("./pages/ResetPassword"));

const Dashboard           = lazy(() => import("./pages/Dashboard"));
const Profile             = lazy(() => import("./pages/Profile"));
const EditProfile         = lazy(() => import("./pages/EditProfile"));
const Search              = lazy(() => import("./pages/Search"));
const Opportunities       = lazy(() => import("./pages/Opportunities"));
const OpportunityDetail   = lazy(() => import("./pages/OpportunityDetail"));
const NewOpportunity      = lazy(() => import("./pages/NewOpportunity"));
const Tournaments         = lazy(() => import("./pages/Tournaments"));
const NewTournament       = lazy(() => import("./pages/NewTournament"));
const Applicants          = lazy(() => import("./pages/Applicants"));
const MyApplications      = lazy(() => import("./pages/MyApplications"));
const Feed                = lazy(() => import("./pages/Feed"));
const Reels               = lazy(() => import("./pages/Reels"));
const Blogs               = lazy(() => import("./pages/Blogs"));
const BlogDetail          = lazy(() => import("./pages/BlogDetail"));
const NewBlog             = lazy(() => import("./pages/NewBlog"));
const Messages            = lazy(() => import("./pages/Messages"));
const Notifications       = lazy(() => import("./pages/Notifications"));
const MyOrganizations     = lazy(() => import("./pages/MyOrganizations"));
const NewOrganization     = lazy(() => import("./pages/NewOrganization"));
const OrganizationDetail  = lazy(() => import("./pages/OrganizationDetail"));
const Organizations       = lazy(() => import("./pages/Organizations"));
const AITips              = lazy(() => import("./pages/AITips"));

// Admin — separate chunk, only loaded when admin navigates here
const Admin                     = lazy(() => import("./pages/admin/Admin"));
const AdminUsers                = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetail           = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminReports              = lazy(() => import("./pages/admin/AdminReports"));
const AdminVerifications        = lazy(() => import("./pages/admin/AdminVerifications"));
const AdminAuditLog             = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminOpportunities        = lazy(() => import("./pages/admin/AdminOpportunities"));
const AdminOrganizations        = lazy(() => import("./pages/admin/AdminOrganizations"));
const AdminApplications         = lazy(() => import("./pages/admin/AdminApplications"));
const AdminCreateUser           = lazy(() => import("./pages/admin/AdminCreateUser"));
const AdminCreateOrganization   = lazy(() => import("./pages/admin/AdminCreateOrganization"));
const AdminCreateOpportunity    = lazy(() => import("./pages/admin/AdminCreateOpportunity"));
const AdminScoring              = lazy(() => import("./pages/admin/AdminScoring"));

// Live scores + scoring console — separate chunks
const LiveScores            = lazy(() => import("./pages/LiveScores"));
const LiveScoreDetail       = lazy(() => import("./pages/LiveScoreDetail"));
const ScoringHome           = lazy(() => import("./pages/scoring/ScoringHome"));
const ScoringTournaments    = lazy(() => import("./pages/scoring/ScoringTournaments"));
const ScoringNewTournament  = lazy(() => import("./pages/scoring/ScoringNewTournament"));
const ScoringTournamentDetail = lazy(() => import("./pages/scoring/ScoringTournamentDetail"));
const ScoringMatchDetail    = lazy(() => import("./pages/scoring/ScoringMatchDetail"));
const ScoringLive           = lazy(() => import("./pages/scoring/ScoringLive"));
const ScoringInningsAnalytics = lazy(() => import("./pages/scoring/ScoringInningsAnalytics"));
const ScoringAllMatches     = lazy(() => import("./pages/scoring/ScoringAllMatches"));
const ScoringPlayerStats    = lazy(() => import("./pages/scoring/ScoringPlayerStats"));
const ScoringMatchConfig    = lazy(() => import("./pages/scoring/ScoringMatchConfig"));

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
      </Route>

      <Route element={<Layout />}>
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
