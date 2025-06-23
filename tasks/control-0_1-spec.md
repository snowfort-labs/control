Project Spec – “Control 0.1”

Self-hosted, agent-observability dashboard (local-first with optional remote sync)

⸻

1  Objective

Deliver a single-binary CLI that ingests agent traces (Claude Code + Git), stores them locally in DuckDB, and serves a live dashboard at http://localhost:9123. A one-line Homebrew install must yield a fully working system in < 40 s.

⸻

2  Core user flows

#	Flow	Success criteria
1	brew install control → control dashboard	Browser opens; dashboard shows Stability Score, Autonomy %, Rework Amplification computed from Git history even if no Claude data exists.
2	control watch (spawned automatically by dashboard) tails Claude store + Git, updating charts live.	New agent interactions appear within ≤ 10 s of the underlying event.
3	control badge prints a markdown snippet for a Stability badge.	Badge value updates on every push (via local CLI or CI job).
4	control sync --remote accepts Supabase credentials.	Identical dashboard reachable at https://app.control.run/<org> within 2 min; local DuckDB continues to function offline.


⸻

3  Scope of work (v0.1)

3.1  CLI commands

control ingest            # one-off import (Claude + Git)
control watch             # start tailers; writes events -> DuckDB
control serve             # embed HTTP + SSE/WebSocket
control dashboard         # = serve + auto-open browser
control badge             # output markdown for Stability badge
control sync --remote     # opt-in Supabase aggregation

3.2  Adapters

Adapter	Source	Mechanism
Claude Code	~/.claude/__store.db (SQLite)	Poll file mtime; query messages & thoughts tables for new rows.
Git	local repo	git log --reverse --since=<last_ts>; parse diffs to detect rework/rollback.

(Interfaces must allow plug-in adapters for Codex, Cursor, Jules in later versions.)

3.3  Local data store
	•	DuckDB file at ~/.control/control.db with table events

column	type	notes
ts	TIMESTAMP	seconds since epoch
agent	TEXT	"claude" | "git"
session_id	TEXT	Claude conversation ID or commit SHA
thought	TEXT	nullable
action	TEXT	shell cmd / “commit” / “merge”
result	TEXT	stdout, diff summary, etc.
tokens	INT	-1 if unknown
meta	JSON	model name, branch, additional context

3.4  Remote sync (optional)
	•	Background uploader copies aggregated rows to a Supabase Postgres mirror (events table, row-level security by user_id).
	•	CLI flag --remote (or environment variable) toggles sync; no outbound traffic otherwise.

3.5  Embedded server (control serve)
	•	Go HTTP router exposing:
	•	GET /api/metrics?since=… → JSON aggregates from DuckDB/Postgres
	•	GET /api/events/stream → SSE for live updates
	•	Static assets embedded via go:embed (bundled React build).

3.6  Frontend (React + Vite + shadcn/ui + recharts)
	•	Layout
	1.	KPI header: Stability, Autonomy, Rework, Token Spend, Turns Per Task
	2.	Live sparkline charts per metric.
	3.	Event stream sidebar (filterable).
	•	Dark-mode default; automatic refresh via SSE.

3.7  Metric definitions (SQL views)
	•	TBD

⸻

4  Out-of-scope for v0.1
	•	Adapters for Codex, Cursor, Jules (interfaces only).
	•	Benchmark harness & self-improvement loop.
	•	Role-based organisation/team management UI.
	•	Cloud-only (remote-first) dashboard variant.

⸻

5  Non-functional requirements

Category	Requirement
Performance	≤ 200 ms p95 for /api/metrics on 50 k events.
Resource usage	Embedded server idle RAM ≤ 25 MB; binary ≤ 20 MB (gz).
Security	No outbound network unless --remote; Supabase credentials stored in OS keychain; HTTPS for sync.
Cross-platform	macOS (arm + x64) and Ubuntu/Debian; installers via Homebrew and .deb.
Testing	Unit tests for adapters & metric SQL; end-to-end test spins CLI, inserts mock events, asserts API output.
CI pipeline	GitHub Actions: lint, go test, React build, GoReleaser draft, Homebrew formula bump.


⸻

6  Acceptance checklist
	•	brew install control installs on macOS and Linux.
	•	First-run control dashboard produces non-zero metrics from Git alone.
	•	New Claude events appear in dashboard within 10 s of occurrence.
	•	control badge generates a markdown badge that updates after git push && control ingest.
	•	control sync --remote successfully uploads aggregates and renders an identical dashboard at the cloud URL.
	•	All automated tests pass in CI.

⸻

7  Delivery artifacts
	•	Git repository scaffold (backend/, web/, cmd/control/).
	•	Architecture & design docs: storage decisions, event schema, sync strategy.
	•	API contract documentation (/api/metrics, /api/events/stream).
	•	Quick-start README and animated demo GIF.