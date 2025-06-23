package watcher

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/snowfort-labs/control/pkg/adapters"
	"github.com/snowfort-labs/control/pkg/store"
	"github.com/snowfort-labs/control/pkg/types"
)

// Manager orchestrates watching multiple repositories
type Manager struct {
	store         store.Store
	adapters      []adapters.Adapter
	watchers      map[uuid.UUID]*RepoWatcher // keyed by repo ID
	eventChannel  chan []*types.EventRow
	ctx           context.Context
	cancel        context.CancelFunc
	mu            sync.RWMutex
}

// RepoWatcher represents a watcher for a single repository
type RepoWatcher struct {
	repo     *types.Repo
	adapters []adapters.Adapter
	ctx      context.Context
	cancel   context.CancelFunc
}

// NewManager creates a new watch manager
func NewManager(store store.Store) *Manager {
	return &Manager{
		store:        store,
		watchers:     make(map[uuid.UUID]*RepoWatcher),
		eventChannel: make(chan []*types.EventRow, 100),
		adapters: []adapters.Adapter{
			adapters.NewGitAdapter(),
			adapters.NewClaudeAdapter(),
		},
	}
}

// Start starts the watch manager
func (m *Manager) Start(ctx context.Context) error {
	m.ctx, m.cancel = context.WithCancel(ctx)
	
	// Start event processor
	go m.processEvents()
	
	// Load existing repos and start watching them
	repos, err := m.store.ListRepos(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to list repos: %w", err)
	}
	
	for _, repo := range repos {
		if repo.Status == "watching" {
			if err := m.StartWatching(repo); err != nil {
				log.Printf("Failed to start watching repo %s: %v", repo.Name, err)
			}
		}
	}
	
	return nil
}

// Stop stops the watch manager and all watchers
func (m *Manager) Stop() error {
	if m.cancel != nil {
		m.cancel()
	}
	
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Stop all watchers
	for _, watcher := range m.watchers {
		watcher.stop()
	}
	
	// Stop all adapters
	for _, adapter := range m.adapters {
		adapter.Stop()
	}
	
	close(m.eventChannel)
	return nil
}

// StartWatching starts watching a repository
func (m *Manager) StartWatching(repo *types.Repo) error {
	log.Printf("[WatchManager] Starting to watch repository: %s at %s", repo.Name, repo.Path)
	
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Check if already watching
	if _, exists := m.watchers[repo.ID]; exists {
		return fmt.Errorf("already watching repo %s", repo.Name)
	}
	
	// Create repo watcher
	watcher := &RepoWatcher{
		repo:     repo,
		adapters: make([]adapters.Adapter, len(m.adapters)),
	}
	
	log.Printf("[WatchManager] Creating %d adapters for %s", len(m.adapters), repo.Name)
	
	// Create adapters for this repo
	for i, baseAdapter := range m.adapters {
		switch baseAdapter.Name() {
		case "git":
			watcher.adapters[i] = adapters.NewGitAdapter()
			log.Printf("[WatchManager] Created Git adapter for %s", repo.Name)
		case "claude":
			watcher.adapters[i] = adapters.NewClaudeAdapter()
			log.Printf("[WatchManager] Created Claude adapter for %s", repo.Name)
		}
	}
	
	watcher.ctx, watcher.cancel = context.WithCancel(m.ctx)
	
	// Start adapters
	for _, adapter := range watcher.adapters {
		go func(a adapters.Adapter) {
			log.Printf("[WatchManager] Starting adapter %s for repo %s", a.Name(), repo.Name)
			if err := a.Start(watcher.ctx, repo, m.eventChannel); err != nil {
				log.Printf("[WatchManager] ERROR: Failed to start adapter %s for repo %s: %v", a.Name(), repo.Name, err)
			} else {
				log.Printf("[WatchManager] Successfully started adapter %s for repo %s", a.Name(), repo.Name)
			}
		}(adapter)
	}
	
	m.watchers[repo.ID] = watcher
	
	// Update repo status
	repo.Status = "watching"
	if err := m.store.UpdateRepo(context.Background(), repo); err != nil {
		log.Printf("[WatchManager] ERROR: Failed to update repo status: %v", err)
	}
	
	log.Printf("[WatchManager] Successfully started watching repository: %s", repo.Name)
	return nil
}

// StopWatching stops watching a repository
func (m *Manager) StopWatching(repoID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	watcher, exists := m.watchers[repoID]
	if !exists {
		return fmt.Errorf("not watching repo %s", repoID)
	}
	
	watcher.stop()
	delete(m.watchers, repoID)
	
	// Update repo status
	repo, err := m.store.GetRepo(context.Background(), repoID)
	if err == nil {
		repo.Status = "paused"
		m.store.UpdateRepo(context.Background(), repo)
	}
	
	log.Printf("Stopped watching repository: %s", repo.Name)
	return nil
}

// GetWatchingRepos returns a list of currently watched repositories
func (m *Manager) GetWatchingRepos() []*types.Repo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var repos []*types.Repo
	for _, watcher := range m.watchers {
		repos = append(repos, watcher.repo)
	}
	return repos
}

// GetAdapters returns a list of all available adapters
func (m *Manager) GetAdapters() []adapters.Adapter {
	return m.adapters
}

// processEvents processes incoming events from all adapters
func (m *Manager) processEvents() {
	log.Printf("[WatchManager] Event processor started")
	for {
		select {
		case <-m.ctx.Done():
			log.Printf("[WatchManager] Event processor stopping")
			return
		case events, ok := <-m.eventChannel:
			if !ok {
				log.Printf("[WatchManager] Event channel closed")
				return
			}
			
			log.Printf("[WatchManager] Received %d events", len(events))
			
			if len(events) > 0 {
				for _, event := range events {
					log.Printf("[WatchManager] Event: %s/%s - %s", event.Agent, event.Action, event.Result[:min(50, len(event.Result))])
				}
				
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				if err := m.store.WriteEvents(ctx, events); err != nil {
					log.Printf("[WatchManager] ERROR: Failed to write events: %v", err)
				} else {
					log.Printf("[WatchManager] Successfully wrote %d events to database", len(events))
				}
				cancel()
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// stop stops a repo watcher
func (rw *RepoWatcher) stop() {
	if rw.cancel != nil {
		rw.cancel()
	}
	
	for _, adapter := range rw.adapters {
		adapter.Stop()
	}
}