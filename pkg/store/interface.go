package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/snowfort-labs/control/pkg/types"
)

// Store defines the interface for data persistence
type Store interface {
	// Initialize the store
	Init(ctx context.Context) error
	Close() error

	// Workspace operations
	CreateWorkspace(ctx context.Context, workspace *types.Workspace) error
	GetWorkspace(ctx context.Context, id uuid.UUID) (*types.Workspace, error)
	ListWorkspaces(ctx context.Context) ([]*types.Workspace, error)
	UpdateWorkspace(ctx context.Context, workspace *types.Workspace) error
	DeleteWorkspace(ctx context.Context, id uuid.UUID) error

	// Repository operations
	AddRepo(ctx context.Context, repo *types.Repo) error
	GetRepo(ctx context.Context, id uuid.UUID) (*types.Repo, error)
	ListRepos(ctx context.Context, workspaceID *uuid.UUID) ([]*types.Repo, error)
	UpdateRepo(ctx context.Context, repo *types.Repo) error
	RemoveRepo(ctx context.Context, id uuid.UUID) error

	// Event operations
	WriteEvents(ctx context.Context, events []*types.EventRow) error
	GetEvents(ctx context.Context, params *types.MetricParams) ([]*types.EventRow, error)

	// Metrics operations
	QueryMetrics(ctx context.Context, params *types.MetricParams) ([]*types.MetricPoint, error)
}