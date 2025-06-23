# Control Architecture

This document describes the architecture and design decisions for Control 0.1.

## Overview

Control is a self-hosted agent observability dashboard that ingests data from Claude Code and Git, stores it locally in DuckDB, and serves real-time metrics through a web dashboard.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐
│   Claude Code   │    │       Git       │
│  ~/.claude/     │    │   git log       │
│  __store.db     │    │   git diff      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          ▼                      ▼
    ┌─────────────────────────────────────┐
    │           Adapters                  │
    │  ┌─────────────┐ ┌─────────────┐   │
    │  │   Claude    │ │     Git     │   │
    │  │  Adapter    │ │  Adapter    │   │
    │  └─────────────┘ └─────────────┘   │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │            Storage                  │
    │         ~/.control/                 │
    │         control.db                  │
    │          (DuckDB)                   │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │          Metrics Engine             │
    │    ┌─────────────────────────┐      │
    │    │  Stability Calculator   │      │
    │    │  Autonomy Calculator    │      │
    │    │  Rework Calculator      │      │
    │    └─────────────────────────┘      │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │          HTTP Server                │
    │  ┌─────────────┐ ┌─────────────┐   │
    │  │     API     │ │  Dashboard  │   │
    │  │ /api/metrics│ │   (HTML)    │   │
    │  │ /api/events │ │             │   │
    │  └─────────────┘ └─────────────┘   │
    └─────────────┬───────────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │            Browser                  │
    │     http://localhost:9123           │
    └─────────────────────────────────────┘
```

## Components

### 1. Data Adapters

#### Claude Adapter (`internal/adapters/claude.go`)
- **Purpose**: Extracts agent interactions from Claude Code's SQLite store
- **Location**: `~/.claude/__store.db`
- **Polling**: Every 5 seconds for new data
- **Data Extracted**:
  - Conversation messages
  - Thoughts/reasoning
  - Timestamps
  - Model information

#### Git Adapter (`internal/adapters/git.go`)
- **Purpose**: Analyzes Git history for development patterns
- **Polling**: Every 10 seconds for new commits
- **Analysis**:
  - Commit categorization (feature, fix, refactor, etc.)
  - Rework detection (high delete-to-add ratios)
  - File change statistics
  - Author patterns

### 2. Storage Layer (`internal/storage/duckdb.go`)

#### Database Schema
```sql
CREATE TABLE events (
    ts TIMESTAMP,           -- Event timestamp
    agent VARCHAR,          -- "claude" | "git"
    session_id VARCHAR,     -- Conversation ID or commit SHA
    thought VARCHAR,        -- Claude reasoning (nullable)
    action VARCHAR,         -- Action type
    result VARCHAR,         -- Action result/content
    tokens INTEGER,         -- Token count (-1 if unknown)
    meta JSON              -- Additional metadata
);
```

#### Key Features
- **Local-first**: All data stored in `~/.control/control.db`
- **Fast queries**: Optimized for time-series analysis
- **JSON metadata**: Flexible schema for adapter-specific data
- **Automatic cleanup**: Configurable retention policies

### 3. Metrics Engine (`internal/storage/duckdb.go`)

#### Core Metrics

**Stability Score** (0.0 - 1.0)
```
stability = 1 - (rework_commits / total_commits)
```
- Measures how often code needs to be redone
- Factors in Claude interaction density
- Higher = more stable development

**Autonomy Percentage** (0-100%)
```
autonomy = (autonomous_actions / total_actions) * 100
```
- Detects self-directed vs. user-prompted actions
- Pattern matching on language ("I'll", "Let me", etc.)
- Higher = more independent agent behavior

**Rework Amplification** (≥1.0)
```
amplification = total_commits / productive_commits
```
- Measures how much extra work rework creates
- 1.0 = no rework, >1.0 = amplified effort
- Lower = more efficient development

**Token Spend** (integer)
- Sum of all tokens used in Claude interactions
- Estimated from content length if not available
- Tracks computational cost

**Turns Per Task** (float)
- Average conversation length per development task
- Groups by session/conversation ID
- Lower = more efficient task completion

### 4. HTTP Server (`internal/server/server.go`)

#### API Endpoints

**GET /api/metrics?since=timestamp**
- Returns aggregated metrics since timestamp
- Default: last 24 hours
- Response: JSON with all core metrics

**GET /api/events?since=timestamp&limit=N**
- Returns raw events for analysis
- Supports pagination and filtering
- Used for detailed investigation

**GET /api/events/stream**
- WebSocket/SSE endpoint for live updates
- Pushes new events within ~10 seconds
- Heartbeat for connection health

**GET /**
- Embedded HTML dashboard
- Real-time metrics display
- No external dependencies

### 5. CLI Interface (`internal/cli/`)

#### Commands

**control dashboard**
- Starts server + opens browser
- Primary user entry point
- Combines `serve` + auto-launch

**control ingest**
- One-time data import
- Processes historical Claude + Git data
- Used for initial setup

**control watch**
- Background event monitoring
- Started automatically by dashboard
- Continuous polling of data sources

**control badge**
- Generates Markdown status badge
- Based on current Stability Score
- CI/CD integration support

**control sync --remote**
- Future: Supabase cloud sync
- Optional team/organization features
- Preserves local-first operation

## Design Decisions

### Local-First Architecture
- **Rationale**: Privacy, speed, offline capability
- **Trade-off**: No automatic team sharing
- **Future**: Optional cloud sync preserves this choice

### DuckDB for Storage
- **Rationale**: 
  - Single-file database
  - Fast analytical queries
  - No server required
  - Excellent JSON support
- **Trade-off**: Less familiar than SQLite
- **Alternative considered**: SQLite (simpler but slower for analytics)

### Embedded HTTP Server
- **Rationale**: Zero-dependency deployment
- **Trade-off**: Limited customization vs. separate frontend
- **Future**: React frontend can replace embedded HTML

### Real-time Updates
- **Method**: WebSocket with SSE fallback
- **Frequency**: 5-10 second polling intervals
- **Rationale**: Balance between responsiveness and resource usage

### Metrics Design
- **Philosophy**: Measure outcomes, not activities
- **Focus**: Quality metrics over quantity metrics
- **Evolution**: Metrics can be refined based on user feedback

## Performance Characteristics

### Resource Usage
- **Memory**: <25MB idle, <100MB under load
- **CPU**: Minimal when not ingesting
- **Disk**: ~1MB per 1000 events
- **Network**: Local-only (except optional sync)

### Scalability Limits
- **Events**: Tested up to 50k events
- **Query time**: <200ms p95 for metrics endpoint
- **Storage**: Limited by available disk space
- **Concurrent users**: Single-user design

## Security Model

### Data Access
- **Scope**: Local user data only
- **Permissions**: Filesystem access only
- **Network**: No outbound connections by default

### Threat Model
- **Protected against**: Data exfiltration, remote attacks
- **Not protected against**: Local privilege escalation
- **Assumption**: Trusted local environment

## Future Architecture

### v0.2 Planned Changes
- React frontend for richer visualizations
- Plugin architecture for additional adapters
- Supabase integration for team features
- Enhanced metrics with machine learning

### Scalability Path
- Multi-user support via web deployment
- Distributed storage for large teams
- Real-time collaboration features
- Advanced analytics and insights

## Development Guidelines

### Adding New Adapters
1. Implement the `Adapter` interface
2. Add to adapter registry
3. Include comprehensive tests
4. Document data schema in metadata

### Metrics Evolution
1. Design metrics with clear definitions
2. Maintain backward compatibility
3. Version metric definitions
4. Provide migration paths

### API Stability
1. Version all public APIs
2. Maintain backwards compatibility
3. Use feature flags for new functionality
4. Document breaking changes clearly