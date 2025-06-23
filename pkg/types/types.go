package types

import (
	"time"

	"github.com/google/uuid"
)

// Workspace represents a collection of repositories
type Workspace struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Repo represents a repository within a workspace
type Repo struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	CreatedAt   time.Time `json:"created_at"`
	Status      string    `json:"status"` // watching, paused, syncing
}

// EventRow represents a single event in the system
type EventRow struct {
	Timestamp time.Time `json:"ts"`
	Agent     string    `json:"agent"`     // "claude" | "git"
	SessionID string    `json:"session_id"`
	Thought   *string   `json:"thought"`
	Action    string    `json:"action"`
	Result    string    `json:"result"`
	Tokens    int       `json:"tokens"`
	Meta      string    `json:"meta"` // JSON string
	RepoID    uuid.UUID `json:"repo_id"`
}

// MetricPoint represents a calculated metric value
type MetricPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Metric    string    `json:"metric"`
	Value     float64   `json:"value"`
	RepoID    *uuid.UUID `json:"repo_id,omitempty"` // nil for aggregate metrics
}

// MetricParams for querying metrics
type MetricParams struct {
	Since  *time.Time  `json:"since,omitempty"`
	Until  *time.Time  `json:"until,omitempty"`
	RepoID *uuid.UUID  `json:"repo_id,omitempty"`
	Metric *string     `json:"metric,omitempty"`
}