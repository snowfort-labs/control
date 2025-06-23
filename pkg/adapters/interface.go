package adapters

import (
	"context"

	"github.com/snowfort-labs/control/pkg/types"
)

// AdapterHealth represents the health status of an adapter
type AdapterHealth struct {
	IsHealthy bool   `json:"is_healthy"`
	LastError string `json:"last_error,omitempty"`
	Status    string `json:"status"` // "running", "stopped", "error"
}

// Adapter defines the interface for data ingestion adapters
type Adapter interface {
	// Start begins watching for events and sends them to the channel
	Start(ctx context.Context, repo *types.Repo, ch chan<- []*types.EventRow) error
	
	// Stop stops the adapter
	Stop() error
	
	// Name returns the adapter name
	Name() string
	
	// Health returns the current health status of the adapter
	Health() AdapterHealth
}