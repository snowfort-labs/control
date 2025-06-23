# Control 0.1

Self-hosted, agent-observability dashboard (local-first with optional remote sync)

## Overview

Control is a single-binary CLI that ingests agent traces (Claude Code + Git), stores them locally in DuckDB, and serves a live dashboard at http://localhost:9123. 

**One-line install:** `brew install control` → fully working system in < 40s

## Features

- 📊 **Real-time Metrics**: Stability Score, Autonomy %, Rework Amplification, Token Spend, Turns Per Task
- 🔄 **Live Updates**: New agent interactions appear within ≤ 10s
- 🎯 **Local-first**: All data stored locally in DuckDB at `~/.control/control.db`
- 🌐 **Optional Sync**: Supabase integration for remote dashboard access
- 📈 **Historical Analysis**: Compute metrics from Git history even without Claude data
- 🏷️ **Status Badges**: Generate markdown badges that update on every push

## Quick Start

### Install

```bash
# Install via Homebrew (recommended)
brew install control

# Or download binary from releases
curl -L https://github.com/snowfort-labs/control/releases/latest/download/control-darwin-amd64 -o control
chmod +x control
sudo mv control /usr/local/bin/
```

### Usage

```bash
# Start dashboard (opens browser automatically)
control dashboard

# One-time data import
control ingest

# Watch for new events (runs automatically with dashboard)
control watch

# Generate status badge
control badge

# Enable remote sync
control sync --remote
```

## Core User Flows

| # | Flow | Success Criteria |
|---|------|-----------------|
| 1 | `brew install control` → `control dashboard` | Browser opens; dashboard shows metrics computed from Git history even if no Claude data exists |
| 2 | `control watch` tails Claude store + Git, updating charts live | New agent interactions appear within ≤ 10s of the underlying event |
| 3 | `control badge` prints markdown snippet | Badge value updates on every push (via local CLI or CI job) |
| 4 | `control sync --remote` accepts Supabase credentials | Identical dashboard reachable at https://app.control.run/<org> within 2 min |

## Architecture

### Data Sources

- **Claude Code**: Reads from `~/.claude/__store.db` (SQLite)
- **Git**: Parses `git log --reverse --since=<last_ts>` and diffs to detect rework/rollback

### Storage

- **Local**: DuckDB file at `~/.control/control.db`
- **Remote**: Optional Supabase Postgres mirror with row-level security

### Metrics

- **Stability Score**: 1 - (rework_commits / total_commits)
- **Autonomy %**: Percentage of self-directed vs. user-prompted actions
- **Rework Amplification**: total_commits / productive_commits
- **Token Spend**: Estimated from Claude interactions
- **Turns Per Task**: Average conversation length per task

### API Endpoints

- `GET /api/metrics?since=...` → JSON aggregates
- `GET /api/events?since=...&limit=...` → Event list
- `GET /api/events/stream` → WebSocket/SSE for live updates

## Development

### Prerequisites

- Go 1.21+
- Node.js 18+ (for frontend development)

### Build

```bash
# Build binary
go build -o control cmd/control/main.go

# Run tests
go test ./...

# Build frontend (optional - basic HTML is embedded)
cd web && npm install && npm run build
```

### Project Structure

```
control/
├── cmd/control/           # CLI entry point
├── internal/
│   ├── adapters/         # Claude & Git data adapters
│   ├── storage/          # DuckDB interface
│   ├── server/           # HTTP server & API
│   ├── cli/              # Command definitions
│   └── metrics/          # Metrics calculation
├── web/                  # React frontend (optional)
└── tasks/                # Specification documents
```

## Configuration

Control works out-of-the-box with zero configuration. Optional settings:

- `CONTROL_DB_PATH`: Override default database location
- `CONTROL_PORT`: Change server port (default: 9123)
- `CONTROL_SUPABASE_URL`: Remote sync endpoint
- `CONTROL_SUPABASE_KEY`: Remote sync API key

## Performance

- ≤ 200ms p95 for `/api/metrics` on 50k events
- Embedded server idle RAM ≤ 25MB
- Binary size ≤ 20MB (gzipped)

## Security

- No outbound network traffic unless `--remote` flag is used
- Supabase credentials stored in OS keychain
- HTTPS enforced for remote sync

## Roadmap

### v0.1 (Current)
- [x] Core CLI commands
- [x] DuckDB storage
- [x] Claude & Git adapters
- [x] Basic web dashboard
- [x] Metrics calculation
- [ ] Homebrew formula
- [ ] CI/CD pipeline

### v0.2 (Future)
- [ ] React frontend with charts
- [ ] Supabase remote sync
- [ ] Additional adapters (Cursor, Jules, Codex)
- [ ] Team/organization features
- [ ] Self-improvement benchmarks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Run `go test ./...` and ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

🤖 Built with Claude Code • [Report Issues](https://github.com/snowfort-labs/control/issues) • [Contribute](CONTRIBUTING.md)