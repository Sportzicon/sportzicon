# Sportivox — Architecture Diagrams

Comprehensive set of Mermaid diagrams covering the system topology, data flow, deployment topology, and the new cricket scoring sub-system from the PPTX (cricket_features_parameters.pptx, May 2026).

GitHub renders Mermaid blocks natively — open this file on github.com to see the diagrams.

---

## 1 · System context (C4 Level 1)

Who uses Sportivox and what external systems it talks to.

```mermaid
graph TB
  classDef person fill:#fef3c7,stroke:#92400e,color:#000
  classDef system fill:#10b981,stroke:#064e3b,color:#fff
  classDef external fill:#e5e7eb,stroke:#374151,color:#000

  Athlete([Athlete]):::person
  Club([Club / Academy]):::person
  Scout([Scout]):::person
  Organizer([Organizer]):::person
  Admin([Admin]):::person
  Scorer([Scorer]):::person

  SVox[(Sportivox<br/>networking + recruitment)]:::system
  Scoring[(Cricket Scoring Console<br/>tournament & ball-by-ball)]:::system

  GCS[(Google Cloud Storage<br/>media + private docs)]:::external
  Firestore[(Firestore Native<br/>main app DB)]:::external
  Postgres[(Cloud SQL Postgres<br/>scoring DB)]:::external
  OpenAI[(OpenAI API<br/>AI tips)]:::external
  Email[(SendGrid / SMTP<br/>txn email)]:::external

  Athlete --> SVox
  Club --> SVox
  Scout --> SVox
  Organizer --> SVox
  Admin --> SVox
  Organizer -- click-through --> Scoring
  Scorer --> Scoring

  SVox --> Firestore
  SVox --> GCS
  SVox --> OpenAI
  SVox --> Email
  Scoring --> Postgres
```

Notes
- The two systems sit side-by-side rather than nested. The Sportivox networking app is Firestore-based; the cricket scoring console is a Postgres-based ball-by-ball OLTP workload. Different access patterns, different DBs.
- Organizers cross the boundary via a deep link on the Tournaments page (env var `VITE_SCORING_URL`).

---

## 2 · Container diagram (C4 Level 2)

The deployable units and how requests flow between them.

```mermaid
graph TB
  subgraph Browser
    SPA1[Sportivox SPA<br/>React + Vite]
    SPA2[Scoring SPA<br/>React + Vite]
  end

  subgraph "Cloud Run · asia-south1"
    Web1[sportivox-web<br/>nginx → SPA bundle]
    API1[sportivox-api<br/>Node.js · Express<br/>JWT · RBAC · Zod]
    Web2[scoring-web<br/>nginx → SPA bundle]
    API2[scoring-api<br/>Node.js · Express<br/>JWT · Prisma]
  end

  subgraph "Data layer · GCP"
    FS[(Firestore<br/>users · posts · opportunities)]
    PG[(Cloud SQL · Postgres<br/>tournaments · innings · ball_events)]
    Buckets[(GCS Buckets<br/>media-public + docs-private)]
    SM[(Secret Manager<br/>JWT keys · DB creds)]
  end

  SPA1 -->|HTTPS| Web1
  SPA1 -->|HTTPS · /api/v1| API1
  SPA2 -->|HTTPS| Web2
  SPA2 -->|HTTPS · /api| API2

  API1 --> FS
  API1 --> Buckets
  API1 --> SM
  API2 --> PG
  API2 --> SM

  SPA1 -.->|signed URL upload| Buckets
```

---

## 3 · Cricket scoring — data model (post-PPTX rollout)

Entities owned by the scoring Postgres schema after the PR adds the PPTX features.

```mermaid
erDiagram
  TOURNAMENT ||--o{ TEAM : has
  TOURNAMENT ||--o{ MATCH : runs
  TEAM ||--o{ PLAYER : rosters
  MATCH ||--o{ INNINGS : "has 2-4"
  INNINGS ||--o{ BALL_EVENT : "per ball"
  INNINGS ||--o{ BATTING_ENTRY : "per batter"
  INNINGS ||--o{ BOWLING_ENTRY : "per bowler"
  INNINGS ||--o{ FIELDING_ENTRY : "per fielder"
  INNINGS ||--o{ PARTNERSHIP : "per wicket"
  PLAYER ||--o{ BATTING_ENTRY : ""
  PLAYER ||--o{ BOWLING_ENTRY : ""
  PLAYER ||--o{ FIELDING_ENTRY : ""
  PLAYER ||--o{ BALL_EVENT : "as batsman/bowler"

  TOURNAMENT {
    uuid id
    string sport
    string format
    int overs_per_innings
    string ball_type
    json powerplay_overs
    bool super_over_enabled
    bool dls_enabled
    bool free_hit_enabled
  }

  INNINGS {
    uuid id
    int total_runs
    int total_wickets
    int total_balls
    int boundary_4s
    int boundary_6s
    int dot_balls
    int pp_runs
    int mid_runs
    int death_runs
    int projected_score
    float win_probability
    float momentum_index
  }

  BALL_EVENT {
    uuid id
    int over_number
    int ball_number
    int runs
    string shot_type
    string ball_line
    string ball_length
    string bowler_variant
    string phase
    bool is_wicket
    string wicket_type
    string dismissal_zone
    string ball_trajectory
    string fielding_position
  }

  BATTING_ENTRY {
    uuid id
    int runs
    int balls_faced
    int dot_balls
    int singles
    int fours
    int sixes
    string strong_zone
    string weak_zone
    string scouting_notes
  }

  FIELDING_ENTRY {
    uuid id
    int catches
    int drops
    int run_outs_direct
    int stumpings
    int impact_score
  }
```

---

## 4 · Live scoring — ball-by-ball write flow

What happens between a scorer tapping "Record Ball" and the analytics view updating.

```mermaid
sequenceDiagram
  autonumber
  actor Scorer
  participant UI as Scoring SPA<br/>(LiveScoring.tsx)
  participant API as scoring-api<br/>(addBall)
  participant DB as Postgres
  participant Q as React Query<br/>(refetch · 5s)
  participant Analytics as Analytics view<br/>(InningsAnalytics.tsx)

  Scorer->>UI: Tap runs / length / line / shot / bowler type
  UI->>UI: Validate Level 1 mandatory dropdowns
  Scorer->>UI: Tap Record Ball
  UI->>API: POST /innings/:id/balls<br/>{ shot_type, ball_line, ball_length, ... }
  API->>DB: BEGIN
  API->>DB: INSERT BallEvent (with phase, is_dot, is_free_hit)
  API->>DB: UPDATE Innings totals + phase splits + 4s/6s/dot
  API->>DB: UPSERT BattingEntry (+ dismissal context on wicket)
  API->>DB: UPSERT BowlingEntry (+ phase splits)
  alt wicket with fielder
    API->>DB: UPSERT FieldingEntry
  end
  API->>DB: UPSERT Partnership (open or accumulate)
  API->>DB: Recompute projected_score / win_prob / momentum
  API->>DB: COMMIT
  API-->>UI: 201 Created
  UI->>Q: invalidate queries
  Q->>API: GET /matches/:id (refetch)
  Q->>API: GET /innings/:id/balls (refetch)
  Q->>API: GET /innings/:id/analytics (refetch)
  API-->>Analytics: Updated dashboard data
```

Notes
- Each `addBall` is a single DB round-trip from the client's perspective. Internally it touches up to 5 rows (`Innings`, `BattingEntry`, `BowlingEntry`, `FieldingEntry`, `Partnership`) — fine at the cricket-scoring throughput (1 ball every ~30s in real life).
- `Undo` is symmetric — the same handler decrements every counter the matching `addBall` incremented and deletes the `BallEvent` row last.

---

## 5 · Authentication & RBAC flow

How a scorer's request reaches the database and gets authorised.

```mermaid
sequenceDiagram
  actor User
  participant SPA as Scoring SPA
  participant API as scoring-api
  participant Auth as auth.routes
  participant Guard as requireAuth + requireRole
  participant Svc as scoring.service
  participant DB as Postgres

  User->>SPA: Login (email · password)
  SPA->>API: POST /api/auth/login
  API->>DB: SELECT user, verify bcrypt
  API-->>SPA: { access_token (15m), refresh_token (30d) }
  SPA->>SPA: Persist tokens (zustand)

  User->>SPA: Record ball
  SPA->>API: POST /innings/:id/balls<br/>Authorization: Bearer <access>
  API->>Guard: Verify JWT signature + exp
  Guard->>Guard: Check role ∈ {organizer, admin, scorer}
  Guard->>Svc: req.user = { sub, role }
  Svc->>DB: SELECT tournament WHERE id = ...
  Svc->>Svc: assertManager(tournament.created_by, req.user)
  alt allowed
    Svc->>DB: write ball + side-effects
    Svc-->>SPA: 201
  else not the tournament owner
    Svc-->>SPA: 403 Forbidden
  end
```

---

## 6 · CI/CD pipeline

How code reaches production.

```mermaid
graph LR
  Dev[Developer] -->|push branch| GH[GitHub PR]
  GH -->|on PR| CI[ci.yml<br/>lint · type · test]
  CI -->|green| Merge[Merge to main]
  Merge -->|on push| Stage[deploy-staging.yml<br/>Cloud Build · staging Cloud Run]
  Stage -->|smoke green| Tag[Tag release]
  Tag -->|on tag| Prod[deploy-production.yml<br/>Cloud Build · prod Cloud Run]

  Daily([07:30 UTC cron]) -->|trigger| Gap[daily-gap-analysis.yml<br/>scan repo · update issue]
  Daily2([03:00 UTC cron]) -->|trigger| E2E[daily-e2e.yml<br/>Playwright · publish report]

  Gap -.->|fail on P0| Slack[(Slack alert)]
  E2E -.->|fail on regression| Slack
```

---

## 7 · Deployment topology (GCP)

What lives where in the cloud.

```mermaid
graph TB
  subgraph "GCP Project: sportivox-prod"
    subgraph "Region: asia-south1"
      AR[Artifact Registry<br/>sportivox/api · sportivox/web<br/>scoring/api · scoring/web]
      CRapi[Cloud Run<br/>sportivox-api-prod]
      CRweb[Cloud Run<br/>sportivox-web-prod]
      CRsapi[Cloud Run<br/>scoring-api-prod]
      CRsweb[Cloud Run<br/>scoring-web-prod]
      SQL[Cloud SQL · Postgres 15<br/>scoring DB]
    end

    FSnat[(Firestore Native<br/>multi-region)]
    GCSpub[(GCS · public-media)]
    GCSprv[(GCS · private-docs)]
    SM[(Secret Manager)]
    Logs[(Cloud Logging)]
    Mon[(Cloud Monitoring)]
  end

  CRweb -->|/api/v1| CRapi
  CRsweb -->|/api| CRsapi
  CRapi --> FSnat
  CRapi --> GCSpub
  CRapi --> GCSprv
  CRapi --> SM
  CRsapi --> SQL
  CRsapi --> SM

  AR -.->|image pull| CRapi
  AR -.->|image pull| CRweb
  AR -.->|image pull| CRsapi
  AR -.->|image pull| CRsweb

  CRapi -.->|logs| Logs
  CRsapi -.->|logs| Logs
  Logs --> Mon
```

---

## 8 · Daily automation overview

How the three automated processes (added in this PR) fit together.

```mermaid
graph LR
  subgraph "GitHub Actions"
    GA1[daily-gap-analysis.yml<br/>cron 07:30 UTC]
    GA2[daily-e2e.yml<br/>cron 03:00 UTC]
    CI[ci.yml<br/>per PR]
  end

  subgraph "Outputs"
    R1[reports/gap-analysis/YYYY-MM-DD.md]
    R2[reports/e2e/YYYY-MM-DD/index.html]
    I1[GH Issue: Daily gap analysis tracker]
    I2[GH Issue: Daily e2e tracker]
  end

  GA1 --> R1
  GA1 --> I1
  GA2 --> R2
  GA2 --> I2
  CI -.->|reuses| GA1
```

The reports get committed back to the `reports/` directory on main so history is searchable in git. A single rolling GitHub issue per area keeps the noise down (no daily issue spam).

---

## 9 · Data flow — analytics read path

Where the analytics dashboard gets its numbers.

```mermaid
flowchart LR
  subgraph Capture
    L1[Level 1 dropdown<br/>shot · line · length · bowler type]
    L2[Level 2 wicket panel<br/>position · zone · trajectory]
  end

  L1 --> BE[(BallEvent rows)]
  L2 --> BE
  BE --> Inn[(Innings counters<br/>phase + boundary + dot)]
  BE --> BatE[(BattingEntry<br/>shot detail + dismissal context)]
  BE --> BowE[(BowlingEntry<br/>spell + phase)]
  BE --> Fld[(FieldingEntry)]
  BE --> Pt[(Partnership)]

  subgraph "Analytics read endpoints"
    Ana[GET /innings/:id/analytics]
    Sc[GET /players/:id/scouting]
    Pn[GET /innings/:id/partnerships]
    Fp[GET /innings/:id/fielding]
  end

  BE --> Ana
  Inn --> Ana
  BatE --> Sc
  Pt --> Pn
  Fld --> Fp

  Ana --> UI1[InningsAnalytics view]
  Sc --> UI2[Player scouting view]
  Pn --> UI1
  Fp --> UI1
```

Everything analytics needs is computed at write-time and read O(1). The only cross-cutting read query is `length × line` for the pitch map, which is a single aggregate over `BallEvent` rows for one innings (≤ 240 rows for a T20, indexable).

---

## 10 · Where to look when something breaks

| Symptom | Likely component | First file to open |
|---|---|---|
| "I can't score a ball" | Scoring API auth | `scoring/backend/src/middleware/auth.ts` |
| Stats look wrong after a ball | `addBall` derivation | `scoring/backend/src/modules/scoring/scoring.service.ts` |
| Pitch map shows zeros | BallEvent missing `ball_length`/`ball_line` | check Level 1 was selected on the ball form |
| Win probability stuck | `winProbability` heuristic edge case | same file, search for `function winProbability` |
| Organizer can't open scoring | Cross-app link | `frontend/src/pages/Tournaments.tsx` + `VITE_SCORING_URL` env |
| CI passed but prod broke | Staging skipped | `.github/workflows/deploy-staging.yml` |
