import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import TournamentList from "./pages/TournamentList";
import TournamentDetail from "./pages/TournamentDetail";
import NewTournament from "./pages/NewTournament";
import MatchDetail from "./pages/MatchDetail";
import LiveScoring from "./pages/LiveScoring";
import PlayerStats from "./pages/PlayerStats";
import InningsAnalytics from "./pages/InningsAnalytics";
import MatchConfig from "./pages/MatchConfig";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tournaments" element={<TournamentList />} />
        <Route path="/tournaments/new" element={<ProtectedRoute><NewTournament /></ProtectedRoute>} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/tournaments/:id/edit" element={<ProtectedRoute><NewTournament /></ProtectedRoute>} />
        <Route path="/matches/:matchId" element={<MatchDetail />} />
        <Route path="/matches/:matchId/score" element={<ProtectedRoute><LiveScoring /></ProtectedRoute>} />
        <Route path="/matches/:matchId/config" element={<ProtectedRoute><MatchConfig /></ProtectedRoute>} />
        <Route path="/innings/:inningsId/analytics" element={<InningsAnalytics />} />
        <Route path="/players/:playerId" element={<PlayerStats />} />
        <Route path="*" element={<div className="p-10 text-center text-gray-500">404 — Page not found</div>} />
      </Route>
    </Routes>
  );
}
