import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import { Layout } from "./components/Layout";
import PublicLayout from "./components/PublicLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Search from "./pages/Search";
import Opportunities from "./pages/Opportunities";
import Tournaments from "./pages/Tournaments";
import OpportunityDetail from "./pages/OpportunityDetail";
import NewOpportunity from "./pages/NewOpportunity";
import NewTournament from "./pages/NewTournament";
import Applicants from "./pages/Applicants";
import MyApplications from "./pages/MyApplications";
import Feed from "./pages/Feed";
// import Reels from "./pages/Reels"; // Disabled
import Blogs from "./pages/Blogs";
import BlogDetail from "./pages/BlogDetail";
import NewBlog from "./pages/NewBlog";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import MyOrganizations from "./pages/MyOrganizations";
import NewOrganization from "./pages/NewOrganization";
import OrganizationDetail from "./pages/OrganizationDetail";
import Organizations from "./pages/Organizations";
import AITips from "./pages/AITips";
import Admin from "./pages/admin/Admin";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminAuditLog from "./pages/admin/AdminAuditLog";

import ScoringTournamentList from "./pages/scoring/TournamentList";
import ScoringTournamentDetail from "./pages/scoring/TournamentDetail";
import ScoringNewTournament from "./pages/scoring/NewTournament";
import ScoringMatchDetail from "./pages/scoring/MatchDetail";
import ScoringLiveScoring from "./pages/scoring/LiveScoring";
import ScoringPlayerStats from "./pages/scoring/PlayerStats";
import ScoringInningsAnalytics from "./pages/scoring/InningsAnalytics";
import ScoringMatchConfig from "./pages/scoring/MatchConfig";

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      {/* Public routes — all share the PublicLayout header */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<Landing initialView="how-it-works" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Authenticated routes (with chrome) */}
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
        {/* <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} /> */}
        <Route path="/blogs" element={<ProtectedRoute><Blogs /></ProtectedRoute>} />
        <Route path="/blogs/new" element={<ProtectedRoute><NewBlog /></ProtectedRoute>} />
        <Route path="/blogs/:id/edit" element={<ProtectedRoute><NewBlog /></ProtectedRoute>} />
        <Route path="/blogs/:idOrSlug" element={<ProtectedRoute><BlogDetail /></ProtectedRoute>} />
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
        <Route path="/admin/reports" element={<ProtectedRoute roles={["admin"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/verifications" element={<ProtectedRoute roles={["admin"]}><AdminVerifications /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute roles={["admin"]}><AdminAuditLog /></ProtectedRoute>} />

        {/* Scoring module */}
        <Route path="/scoring/tournaments" element={<ProtectedRoute><ScoringTournamentList /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/new" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><ScoringNewTournament /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/:id" element={<ProtectedRoute><ScoringTournamentDetail /></ProtectedRoute>} />
        <Route path="/scoring/tournaments/:id/edit" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><ScoringNewTournament /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId" element={<ProtectedRoute><ScoringMatchDetail /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId/score" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><ScoringLiveScoring /></ProtectedRoute>} />
        <Route path="/scoring/matches/:matchId/config" element={<ProtectedRoute roles={["club", "organizer", "admin"]}><ScoringMatchConfig /></ProtectedRoute>} />
        <Route path="/scoring/innings/:inningsId/analytics" element={<ProtectedRoute><ScoringInningsAnalytics /></ProtectedRoute>} />
        <Route path="/scoring/players/:playerId" element={<ProtectedRoute><ScoringPlayerStats /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<div className="p-10 text-center text-slate-600">404 — not found</div>} />
    </Routes>
    </>
  );
}
