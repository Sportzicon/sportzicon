import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
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
import AITips from "./pages/AITips";
import Admin from "./pages/admin/Admin";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminAuditLog from "./pages/admin/AdminAuditLog";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
      </Route>

      <Route path="*" element={<div className="p-10 text-center text-slate-600">404 — not found</div>} />
    </Routes>
  );
}
