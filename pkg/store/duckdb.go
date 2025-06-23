package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	_ "github.com/marcboeker/go-duckdb"
	"github.com/snowfort-labs/control/pkg/types"
)

// DuckDBStore implements Store interface using DuckDB
type DuckDBStore struct {
	db       *sql.DB
	dbPath   string
}

// NewDuckDBStore creates a new DuckDB store
func NewDuckDBStore(dbPath string) *DuckDBStore {
	if dbPath == "" {
		homeDir, _ := os.UserHomeDir()
		controlDir := filepath.Join(homeDir, ".control")
		os.MkdirAll(controlDir, 0755)
		dbPath = filepath.Join(controlDir, "control.db")
	}
	
	return &DuckDBStore{
		dbPath: dbPath,
	}
}

// Init initializes the DuckDB connection and creates tables
func (s *DuckDBStore) Init(ctx context.Context) error {
	var err error
	s.db, err = sql.Open("duckdb", s.dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DuckDB: %w", err)
	}

	// Enable JSON extension
	if _, err := s.db.Exec("SET autoinstall_known_extensions=1"); err != nil {
		return fmt.Errorf("failed to enable autoinstall: %w", err)
	}
	if _, err := s.db.Exec("SET autoload_known_extensions=1"); err != nil {
		return fmt.Errorf("failed to enable autoload: %w", err)
	}

	return s.createTables()
}

// Close closes the database connection
func (s *DuckDBStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// createTables creates the necessary tables
func (s *DuckDBStore) createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS workspaces (
			id UUID PRIMARY KEY,
			name VARCHAR NOT NULL,
			created_at TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS repos (
			id UUID PRIMARY KEY,
			workspace_id UUID NOT NULL,
			name VARCHAR NOT NULL,
			path VARCHAR NOT NULL,
			created_at TIMESTAMPTZ NOT NULL,
			status VARCHAR DEFAULT 'paused'
		)`,
		`CREATE TABLE IF NOT EXISTS events (
			ts TIMESTAMPTZ NOT NULL,
			agent VARCHAR NOT NULL,
			session_id VARCHAR NOT NULL,
			thought VARCHAR,
			action VARCHAR NOT NULL,
			result VARCHAR NOT NULL,
			tokens INTEGER DEFAULT -1,
			meta VARCHAR,
			repo_id UUID NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)`,
		`CREATE INDEX IF NOT EXISTS idx_events_repo_id ON events(repo_id)`,
		`CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent)`,
	}

	for _, query := range queries {
		if _, err := s.db.Exec(query); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	return nil
}

// CreateWorkspace creates a new workspace
func (s *DuckDBStore) CreateWorkspace(ctx context.Context, workspace *types.Workspace) error {
	if workspace.ID == uuid.Nil {
		workspace.ID = uuid.New()
	}
	if workspace.CreatedAt.IsZero() {
		workspace.CreatedAt = time.Now()
	}

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)",
		workspace.ID, workspace.Name, workspace.CreatedAt)
	return err
}

// GetWorkspace retrieves a workspace by ID
func (s *DuckDBStore) GetWorkspace(ctx context.Context, id uuid.UUID) (*types.Workspace, error) {
	row := s.db.QueryRowContext(ctx,
		"SELECT id, name, created_at FROM workspaces WHERE id = ?", id)
	
	var workspace types.Workspace
	err := row.Scan(&workspace.ID, &workspace.Name, &workspace.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &workspace, nil
}

// ListWorkspaces retrieves all workspaces
func (s *DuckDBStore) ListWorkspaces(ctx context.Context) ([]*types.Workspace, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, name, created_at FROM workspaces ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	workspaces := make([]*types.Workspace, 0)
	for rows.Next() {
		var workspace types.Workspace
		if err := rows.Scan(&workspace.ID, &workspace.Name, &workspace.CreatedAt); err != nil {
			return nil, err
		}
		workspaces = append(workspaces, &workspace)
	}
	return workspaces, nil
}

// UpdateWorkspace updates a workspace
func (s *DuckDBStore) UpdateWorkspace(ctx context.Context, workspace *types.Workspace) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE workspaces SET name = ? WHERE id = ?",
		workspace.Name, workspace.ID)
	return err
}

// DeleteWorkspace deletes a workspace and all its repos
func (s *DuckDBStore) DeleteWorkspace(ctx context.Context, id uuid.UUID) error {
	// Delete events first
	_, err := s.db.ExecContext(ctx,
		"DELETE FROM events WHERE repo_id IN (SELECT id FROM repos WHERE workspace_id = ?)", id)
	if err != nil {
		return err
	}

	// Delete repos
	_, err = s.db.ExecContext(ctx, "DELETE FROM repos WHERE workspace_id = ?", id)
	if err != nil {
		return err
	}

	// Delete workspace
	_, err = s.db.ExecContext(ctx, "DELETE FROM workspaces WHERE id = ?", id)
	return err
}

// AddRepo adds a new repository
func (s *DuckDBStore) AddRepo(ctx context.Context, repo *types.Repo) error {
	if repo.ID == uuid.Nil {
		repo.ID = uuid.New()
	}
	if repo.CreatedAt.IsZero() {
		repo.CreatedAt = time.Now()
	}
	if repo.Status == "" {
		repo.Status = "paused"
	}

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO repos (id, workspace_id, name, path, created_at, status) VALUES (?, ?, ?, ?, ?, ?)",
		repo.ID, repo.WorkspaceID, repo.Name, repo.Path, repo.CreatedAt, repo.Status)
	return err
}

// GetRepo retrieves a repository by ID
func (s *DuckDBStore) GetRepo(ctx context.Context, id uuid.UUID) (*types.Repo, error) {
	row := s.db.QueryRowContext(ctx,
		"SELECT id, workspace_id, name, path, created_at, status FROM repos WHERE id = ?", id)
	
	var repo types.Repo
	err := row.Scan(&repo.ID, &repo.WorkspaceID, &repo.Name, &repo.Path, &repo.CreatedAt, &repo.Status)
	if err != nil {
		return nil, err
	}
	return &repo, nil
}

// ListRepos retrieves repositories, optionally filtered by workspace
func (s *DuckDBStore) ListRepos(ctx context.Context, workspaceID *uuid.UUID) ([]*types.Repo, error) {
	var query string
	var args []interface{}
	
	if workspaceID != nil {
		query = "SELECT id, workspace_id, name, path, created_at, status FROM repos WHERE workspace_id = ? ORDER BY created_at"
		args = []interface{}{*workspaceID}
	} else {
		query = "SELECT id, workspace_id, name, path, created_at, status FROM repos ORDER BY created_at"
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	repos := make([]*types.Repo, 0) // Initialize empty slice
	for rows.Next() {
		var repo types.Repo
		if err := rows.Scan(&repo.ID, &repo.WorkspaceID, &repo.Name, &repo.Path, &repo.CreatedAt, &repo.Status); err != nil {
			return nil, err
		}
		repos = append(repos, &repo)
	}
	return repos, nil
}

// UpdateRepo updates a repository
func (s *DuckDBStore) UpdateRepo(ctx context.Context, repo *types.Repo) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE repos SET name = ?, path = ?, status = ? WHERE id = ?",
		repo.Name, repo.Path, repo.Status, repo.ID)
	return err
}

// RemoveRepo removes a repository and all its events
func (s *DuckDBStore) RemoveRepo(ctx context.Context, id uuid.UUID) error {
	// Delete events first
	_, err := s.db.ExecContext(ctx, "DELETE FROM events WHERE repo_id = ?", id)
	if err != nil {
		return err
	}

	// Delete repo
	_, err = s.db.ExecContext(ctx, "DELETE FROM repos WHERE id = ?", id)
	return err
}

// WriteEvents writes multiple events to the database
func (s *DuckDBStore) WriteEvents(ctx context.Context, events []*types.EventRow) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		"INSERT INTO events (ts, agent, session_id, thought, action, result, tokens, meta, repo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, event := range events {
		_, err = stmt.ExecContext(ctx,
			event.Timestamp, event.Agent, event.SessionID, event.Thought,
			event.Action, event.Result, event.Tokens, event.Meta, event.RepoID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetEvents retrieves events based on parameters
func (s *DuckDBStore) GetEvents(ctx context.Context, params *types.MetricParams) ([]*types.EventRow, error) {
	query := "SELECT ts, agent, session_id, thought, action, result, tokens, meta, repo_id FROM events WHERE 1=1"
	var args []interface{}

	if params != nil {
		if params.Since != nil {
			query += " AND ts >= ?"
			args = append(args, *params.Since)
		}
		if params.Until != nil {
			query += " AND ts <= ?"
			args = append(args, *params.Until)
		}
		if params.RepoID != nil {
			query += " AND repo_id = ?"
			args = append(args, *params.RepoID)
		}
	}

	query += " ORDER BY ts DESC LIMIT 1000"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]*types.EventRow, 0)
	for rows.Next() {
		var event types.EventRow
		err := rows.Scan(&event.Timestamp, &event.Agent, &event.SessionID, &event.Thought,
			&event.Action, &event.Result, &event.Tokens, &event.Meta, &event.RepoID)
		if err != nil {
			return nil, err
		}
		events = append(events, &event)
	}
	return events, nil
}

// QueryMetrics calculates and returns metrics
func (s *DuckDBStore) QueryMetrics(ctx context.Context, params *types.MetricParams) ([]*types.MetricPoint, error) {
	// Simplified metrics calculation for now
	// In a real implementation, this would calculate stability_score, autonomy_pct, etc.
	
	query := `
		WITH hourly_events AS (
			SELECT 
				date_trunc('hour', ts::timestamp) as hour,
				COUNT(*) as event_count,
				repo_id
			FROM events 
			WHERE 1=1`
	
	var args []interface{}
	if params != nil {
		if params.Since != nil {
			query += " AND ts >= ?"
			args = append(args, *params.Since)
		}
		if params.Until != nil {
			query += " AND ts <= ?"
			args = append(args, *params.Until)
		}
		if params.RepoID != nil {
			query += " AND repo_id = ?"
			args = append(args, *params.RepoID)
		}
	}
	
	query += `
			GROUP BY date_trunc('hour', ts::timestamp), repo_id
		)
		SELECT hour, 'event_count', event_count, repo_id
		FROM hourly_events 
		ORDER BY hour DESC
		LIMIT 100`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	metrics := make([]*types.MetricPoint, 0)
	for rows.Next() {
		var metric types.MetricPoint
		err := rows.Scan(&metric.Timestamp, &metric.Metric, &metric.Value, &metric.RepoID)
		if err != nil {
			return nil, err
		}
		metrics = append(metrics, &metric)
	}
	return metrics, nil
}