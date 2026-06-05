import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole, optionalAuth } from "../../middleware/auth";
import * as svc from "./scoring.service";

const router = Router();

// ── Tournaments ───────────────────────────────────────────────────────────────

router.get("/tournaments", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const { sport, status, page, limit } = req.query;
  const r = await svc.listTournaments(sport, status, Number(page) || 1, Number(limit) || 20);
  res.json(r);
}));

router.post("/tournaments", requireAuth, requireRole("organizer", "admin"), asyncHandler(async (req: any, res: any) => {
  const r = await svc.createTournament(req.user.sub, req.user.role, req.body);
  res.status(201).json({ tournament: r });
}));

router.get("/tournaments/:id", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getTournament(req.params.id);
  res.json({ tournament: r });
}));

router.put("/tournaments/:id", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.updateTournament(req.params.id, req.user.sub, req.user.role, req.body);
  res.json({ tournament: r });
}));

router.delete("/tournaments/:id", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.deleteTournament(req.params.id, req.user.sub, req.user.role);
  res.json(r);
}));

router.get("/tournaments/:id/standings", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getStandings(req.params.id);
  res.json(r);
}));

// ── Teams ─────────────────────────────────────────────────────────────────────

router.post("/tournaments/:id/teams", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.createTeam(req.params.id, req.user.sub, req.user.role, req.body);
  res.status(201).json({ team: r });
}));

router.put("/tournaments/:id/teams/:teamId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.updateTeam(req.params.id, req.params.teamId, req.user.sub, req.user.role, req.body);
  res.json({ team: r });
}));

router.delete("/tournaments/:id/teams/:teamId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.deleteTeam(req.params.id, req.params.teamId, req.user.sub, req.user.role);
  res.json(r);
}));

// ── Players ───────────────────────────────────────────────────────────────────

router.post("/tournaments/:id/teams/:teamId/players", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.createPlayer(req.params.id, req.params.teamId, req.user.sub, req.user.role, req.body);
  res.status(201).json({ player: r });
}));

router.put("/tournaments/:id/teams/:teamId/players/:playerId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.updatePlayer(req.params.id, req.params.teamId, req.params.playerId, req.user.sub, req.user.role, req.body);
  res.json({ player: r });
}));

router.delete("/tournaments/:id/teams/:teamId/players/:playerId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.deletePlayer(req.params.id, req.params.teamId, req.params.playerId, req.user.sub, req.user.role);
  res.json(r);
}));

router.get("/players/:playerId/stats", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getPlayerStats(req.params.playerId);
  res.json(r);
}));

// ── Matches ───────────────────────────────────────────────────────────────────

router.get("/matches/live", optionalAuth, asyncHandler(async (_req: any, res: any) => {
  const r = await svc.getLiveMatches();
  res.json({ matches: r });
}));

router.post("/tournaments/:id/matches", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.createMatch(req.params.id, req.user.sub, req.user.role, req.body);
  res.status(201).json({ match: r });
}));

router.get("/matches/:matchId", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getMatch(req.params.matchId);
  res.json({ match: r });
}));

router.put("/matches/:matchId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.updateMatch(req.params.matchId, req.user.sub, req.user.role, req.body);
  res.json({ match: r });
}));

router.delete("/matches/:matchId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.deleteMatch(req.params.matchId, req.user.sub, req.user.role);
  res.json(r);
}));

// Match events (football etc.)
router.post("/matches/:matchId/events", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.addMatchEvent(req.params.matchId, req.user.sub, req.user.role, req.body);
  res.status(201).json({ event: r });
}));

// ── Cricket Innings ───────────────────────────────────────────────────────────

router.post("/matches/:matchId/innings", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.createInnings(req.params.matchId, req.user.sub, req.user.role, req.body);
  res.status(201).json({ innings: r });
}));

router.put("/innings/:inningsId", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.updateInnings(req.params.inningsId, req.user.sub, req.user.role, req.body);
  res.json({ innings: r });
}));

// Ball-by-ball scoring
router.post("/innings/:inningsId/balls", requireAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.addBall(req.params.inningsId, req.user.sub, req.user.role, req.body);
  res.status(201).json(r);
}));

router.get("/innings/:inningsId/balls", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const over = req.query.over !== undefined ? Number(req.query.over) : undefined;
  const r = await svc.getOverSummary(req.params.inningsId, over);
  res.json({ balls: r });
}));

// Undo last ball (PPTX § Team Analytics)
router.post("/innings/:inningsId/balls/undo", requireAuth, requireRole("organizer", "admin"),
  asyncHandler(async (req: any, res: any) => {
    const r = await svc.undoLastBall(req.params.inningsId, req.user.sub, req.user.role);
    res.json(r);
  })
);

// ── Analytics (PPTX § Scorecard & Analytics) ─────────────────────────────────

router.get("/innings/:inningsId/analytics", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getInningsAnalytics(req.params.inningsId);
  res.json(r);
}));

router.get("/innings/:inningsId/partnerships", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.listPartnerships(req.params.inningsId);
  res.json({ partnerships: r });
}));

router.get("/players/:playerId/scouting", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.getPlayerScouting(req.params.playerId);
  res.json(r);
}));

router.put("/innings/:inningsId/scouting/:playerId", requireAuth, requireRole("organizer", "admin"),
  asyncHandler(async (req: any, res: any) => {
    const r = await svc.setPlayerScouting(req.params.inningsId, req.params.playerId, req.user.sub, req.user.role, req.body);
    res.json({ batting_entry: r });
  })
);

// ── Fielding (PPTX § 04 Fielder) ─────────────────────────────────────────────

router.get("/innings/:inningsId/fielding", optionalAuth, asyncHandler(async (req: any, res: any) => {
  const r = await svc.listFielding(req.params.inningsId);
  res.json({ fielding: r });
}));

router.post("/innings/:inningsId/fielding", requireAuth, requireRole("organizer", "admin"),
  asyncHandler(async (req: any, res: any) => {
    const r = await svc.logFieldingEvent(req.params.inningsId, req.user.sub, req.user.role, req.body);
    res.status(201).json({ fielding_entry: r });
  })
);

// ── Match configuration (PPTX § Match & Innings setup) ──────────────────────

router.put("/matches/:matchId/config", requireAuth, requireRole("organizer", "admin"),
  asyncHandler(async (req: any, res: any) => {
    const r = await svc.updateMatchConfig(req.params.matchId, req.user.sub, req.user.role, req.body);
    res.json({ tournament: r });
  })
);

export default router;
