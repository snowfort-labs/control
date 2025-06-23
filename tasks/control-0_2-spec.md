## What changed since the last draft?

| Area                      | Previous draft                                            | **Now**                                                                                                                         |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-repo support**    | Single repo implied.                                      | Added `workspace` + `repos` tables; every event row now carries `repo_id`.                                                      |
| **Configuration UX**      | Most repo setup done in CLI.                              | Dashboard-first: “Add Repo” wizard and repo list sidebar; CLI optional.                                                         |
| **Tech-debt guard-rails** | Mentioned pluggable store, but not formalised.            | Explicit **Store interface** (`DuckDBStore`, `PostgresStore`) + adapter interface to ensure the cloud switch is one DSN change. |
| **Watcher orchestration** | One watcher.                                              | Goroutine pool **per registered repo**; dynamic start/stop on repo add/remove.                                                  |
| **API surface**           | Only `/api/metrics` & `/api/events/stream`.               | Adds `/api/workspaces`, `/api/repos`, still JSON + SSE.                                                                         |
| **CLI surface**           | `ingest`, `watch`, `serve`, `dashboard`, `badge`, `sync`. | Same, but `dashboard` is the only command most users ever need; repo CRUD is dashboard-only by default.                         |
| **Remote sync toggle**    | `control sync --remote` CLI flag.                         | Same flag still exists **and** mirrored in dashboard settings.                                                                  |
| **Schema tweaks**         | No repo column.                                           | `repo_id UUID` column added to `events`.                                                                                        |

These changes keep local zero-friction onboarding **and** ensure a near-zero-debt path to cloud by strict layer separation.

---

# **Control 0.1 – Base-Version Specification**

### 1. Objective

Deliver a single-binary CLI that:

1. Ingests agent traces (Claude Code + Git) from **any number of repos**.
2. Stores them in **DuckDB** locally behind an abstract `Store` interface.
3. Serves a **live dashboard** at `http://localhost:9123` where users can add/remove repos and view KPIs.
4. Optionally streams *aggregated* rows to **Postgres/Supabase** when remote sync is enabled—no code change outside of selecting a different `Store` implementation.

---

### 2. Core user flows

| Flow                                               | Outcome                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `brew install control` → `control dashboard`       | Browser opens; dashboard prompts “Add your first repo”.                                            |
| Wizard “Add Repo” → select folder or paste Git URL | Repo appears in sidebar; KPIs populate from Git history in ≤30 s.                                  |
| New Claude interaction or Git commit               | Dashboard updates within 10 s.                                                                     |
| Toggle “Sync to Cloud” in Settings                 | Same dashboard available at `https://app.control.run/<workspace>`; local view still works offline. |
| Copy markdown from **Badge** panel                 | Badge shows current Stability score in README/PRs.                                                 |

---

### 3. Architecture & layer isolation

```
┌───────── React SPA (shadcn/ui, recharts) ─────────┐
│  /api/metrics   /api/events/stream   /api/repos   │
└───────────────────────▲────────────────────────────┘
                        │
                ┌───────┴────────┐
                │  HTTP Server   │
                │ (go:embed UI)  │
                └───────┬────────┘
        Store Interface │                Adapter Interface
      ┌─────────────────▼───────────────────┐
      │            pkg/store               │
      │   DuckDBStore   ↔  PostgresStore    │
      └─────────────────▲───────────────────┘
                        │
                ┌───────┴───────────┐
                │  Watch Manager    │
                └───────┬───────────┘
           per-repo goroutine   per-repo goroutine
        ┌──────────▼─────────┐ ┌──────────▼─────────┐
        │ Claude Adapter     │ │ Git Adapter        │
        └────────────────────┘ └────────────────────┘
```

* **Store interface**

```go
type Store interface {
    WriteEvents([]EventRow) error
    QueryMetrics(params) ([]MetricPoint, error)
    ListRepos() ([]Repo, error)
    AddRepo(Repo) error
    RemoveRepo(id uuid.UUID) error
}
```

*Choose `DuckDBStore` by default; runtime switch to `PostgresStore` when DSN env var is present.*

* **Adapter interface**

```go
type Adapter interface {
    Start(ctx context.Context, repo Repo, ch chan<- []EventRow)
    Stop() error
}
```

Adapters remain valid regardless of storage backend.

---

### 4. Data model (DuckDB / Postgres)

```sql
workspace(id UUID PK, name TEXT, created_at TIMESTAMPTZ);
repos(id UUID PK, workspace_id UUID FK, name TEXT, path TEXT, created_at TIMESTAMPTZ);
events(
  ts TIMESTAMPTZ,
  agent TEXT,
  session_id TEXT,
  thought TEXT,
  action TEXT,
  result TEXT,
  tokens INT,
  meta JSON,
  repo_id UUID FK
);
```

SQL views implement:

* `stability_score`
* `autonomy_pct`
* `rework_amplification`
* `mean_time_to_merge`

---

### 5. CLI commands (superset—UI covers most)

```
control dashboard            # start server + open browser
control watch                # headless mode (CI/servers)
control ingest               # manual backfill (optional)
control badge                # print markdown badge
control sync --remote DSN    # one-shot enable remote (also in UI)
```

---

### 6. Dashboard UI elements

* **Sidebar**

  * Workspace selector
  * Repo list with status chips (watching / paused / syncing)
  * “Add Repo” & “Remove” actions
* **Header KPIs** (auto-refresh)
  Stability · Autonomy · Rework · Token Spend
* **Charts**
  Sparkline per metric with repo filter drop-down.
* **Event stream**
  Realtime feed (SSE) with agent, action, delta lines.
* **Settings → Cloud Sync**
  Toggle + fields for Supabase URL/Key.

---

### 7. Non-functional requirements

| Area            | Requirement                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Performance** | `/api/metrics` p95 ≤ 200 ms on 100 k events.                                                |
| **Resources**   | Idle RAM ≤ 25 MB; binary ≤ 20 MB gz.                                                        |
| **Security**    | No outbound traffic unless sync enabled; credentials stored in OS keychain; HTTPS only.     |
| **Portability** | macOS arm/x64 & Debian-based Linux via Homebrew + `.deb`.                                   |
| **Testing**     | Unit tests for adapters & store; e2e test spins server, hits APIs, validates JSON.          |
| **CI**          | GitHub Actions: lint, `go test`, React build, GoReleaser (DuckDB binary), Homebrew formula. |

---

### 8. Acceptance checklist

* [ ] Install via Homebrew; launch dashboard; add repo via UI; see metrics.
* [ ] Multiple repos display independent & aggregate KPIs.
* [ ] New events appear in dashboard ≤ 10 s after agent action.
* [ ] Badge updates after `git push && control watch`.
* [ ] Enabling cloud sync mirrors data and serves identical UI at remote URL.
* [ ] Switching `--remote-dsn` back to empty reverts to local without data loss.
* [ ] All tests pass in CI.

---

**This specification maintains strict layer isolation (Store & Adapter interfaces) to ensure the later move to Postgres/Supabase incurs *no* significant refactor and avoids future tech debt.**
