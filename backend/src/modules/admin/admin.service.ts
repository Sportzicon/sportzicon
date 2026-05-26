import { db, Collections } from "../../config/firestore";
import { BadRequest, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import type { AccountStatus, AuditLogDoc, ReportDoc, ReportStatus, Role, UserDoc } from "../../types/domain";

export async function audit(input: {
  actor: { id: string; role: Role };
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
  ip?: string;
}) {
  const id = newId();
  const doc: AuditLogDoc = {
    id,
    actor_id: input.actor.id,
    actor_role: input.actor.role,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    details: input.details,
    ip: input.ip,
    created_at: now()
  };
  await db.collection(Collections.auditLogs).doc(id).set(doc);
  return doc;
}

export async function listUsers(filter: { status?: AccountStatus; role?: Role; limit: number; cursor?: string }) {
  let q: FirebaseFirestore.Query = db.collection(Collections.users);
  if (filter.status) q = q.where("status", "==", filter.status);
  if (filter.role) q = q.where("role", "==", filter.role);
  q = q.orderBy("created_at", "desc").limit(filter.limit);
  if (filter.cursor) q = q.startAfter(Number(filter.cursor));
  const snap = await q.get();
  const items = snap.docs.map((d) => {
    const u = d.data() as UserDoc;
    const { password_hash, email_lower, full_name_lower, ...safe } = u;
    return safe;
  });
  return {
    items,
    next_cursor: snap.docs.length === filter.limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null
  };
}

export async function setUserStatus(actor: { id: string; role: Role }, userId: string, status: AccountStatus, reason?: string) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  await ref.update({ status, updated_at: now() });
  await audit({ actor, action: `user.${status}`, target_type: "user", target_id: userId, details: { reason } });
  return { ok: true };
}

export async function setUserBadges(actor: { id: string; role: Role }, userId: string, badges: string[]) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  await ref.update({
    "verification.badges": badges,
    "verification.status": badges.length > 0 ? "approved" : "unverified",
    updated_at: now()
  });
  await audit({ actor, action: "user.badges", target_type: "user", target_id: userId, details: { badges } });
  return { ok: true };
}

export async function listReports(status: ReportStatus | "all", limit: number) {
  let q: FirebaseFirestore.Query = db.collection(Collections.reports);
  if (status !== "all") q = q.where("status", "==", status);
  q = q.orderBy("created_at", "desc").limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as ReportDoc);
}

export async function resolveReport(actor: { id: string; role: Role }, reportId: string, status: "actioned" | "dismissed", notes?: string) {
  const ref = db.collection(Collections.reports).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Report not found");
  await ref.update({ status, resolved_by: actor.id, resolved_at: now(), notes });
  await audit({ actor, action: `report.${status}`, target_type: "report", target_id: reportId, details: { notes } });
  return { ok: true };
}

export async function listAuditLogs(limit: number, cursor?: string) {
  let q: FirebaseFirestore.Query = db.collection(Collections.auditLogs).orderBy("created_at", "desc").limit(limit);
  if (cursor) q = q.startAfter(Number(cursor));
  const snap = await q.get();
  return {
    items: snap.docs.map((d) => d.data() as AuditLogDoc),
    next_cursor: snap.docs.length === limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null
  };
}

export async function analytics() {
  const [users, orgs, opps, applications, reports] = await Promise.all([
    db.collection(Collections.users).count().get(),
    db.collection(Collections.organizations).count().get(),
    db.collection(Collections.opportunities).count().get(),
    db.collection(Collections.applications).count().get(),
    db.collection(Collections.reports).where("status", "==", "open").count().get()
  ]);
  return {
    users: users.data().count,
    organizations: orgs.data().count,
    opportunities: opps.data().count,
    applications: applications.data().count,
    open_reports: reports.data().count
  };
}

export async function createReport(reporterId: string, input: any) {
  if (!input.reason || !input.target_id || !input.target_type) throw BadRequest("Missing required fields");
  const id = newId();
  const doc: ReportDoc = {
    id,
    reporter_id: reporterId,
    target_type: input.target_type,
    target_id: input.target_id,
    reason: input.reason,
    status: "open",
    created_at: now()
  };
  await db.collection(Collections.reports).doc(id).set(doc);
  return doc;
}
