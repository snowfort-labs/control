package adapters

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/snowfort-labs/control/pkg/types"
)

// GitAdapter implements the Adapter interface for Git repositories
type GitAdapter struct {
	lastSync    map[string]time.Time // keyed by repo path
	activeRepos int                  // count of repositories currently being watched
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewGitAdapter creates a new Git adapter
func NewGitAdapter() *GitAdapter {
	return &GitAdapter{
		lastSync: make(map[string]time.Time),
	}
}

// Name returns the adapter name
func (g *GitAdapter) Name() string {
	return "git"
}

// Start begins watching the git repository for new commits
func (g *GitAdapter) Start(ctx context.Context, repo *types.Repo, ch chan<- []*types.EventRow) error {
	g.ctx, g.cancel = context.WithCancel(ctx)
	
	// Initialize last sync time if not exists
	if _, exists := g.lastSync[repo.Path]; !exists {
		g.lastSync[repo.Path] = time.Now().Add(-7 * 24 * time.Hour) // Start from 7 days ago for initial sync
		fmt.Printf("[GitAdapter] Initialized last sync for %s to 7 days ago\n", repo.Name)
	}

	// Increment active repository count
	g.activeRepos++

	// Start polling for new commits
	go g.pollCommits(repo, ch)
	
	return nil
}

// Stop stops the Git adapter
func (g *GitAdapter) Stop() error {
	if g.cancel != nil {
		g.cancel()
	}
	return nil
}

// Health returns the current health status of the Git adapter
func (g *GitAdapter) Health() AdapterHealth {
	var status string
	isRunning := g.activeRepos > 0
	
	if isRunning {
		status = "running"
	} else {
		status = "stopped"
	}
	
	return AdapterHealth{
		IsHealthy: isRunning,
		LastError: "",
		Status:    status,
	}
}

// pollCommits polls for new git commits
func (g *GitAdapter) pollCommits(repo *types.Repo, ch chan<- []*types.EventRow) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-g.ctx.Done():
			return
		case <-ticker.C:
			events, err := g.fetchNewCommits(repo)
			if err != nil {
				// Log error but continue
				continue
			}
			if len(events) > 0 {
				ch <- events
			}
		}
	}
}

// fetchNewCommits fetches new commits since last sync
func (g *GitAdapter) fetchNewCommits(repo *types.Repo) ([]*types.EventRow, error) {
	if !g.isGitRepo(repo.Path) {
		fmt.Printf("[GitAdapter] ERROR: Not a git repository: %s\n", repo.Path)
		return nil, fmt.Errorf("not a git repository: %s", repo.Path)
	}

	since := g.lastSync[repo.Path]
	sinceArg := since.Format("2006-01-02T15:04:05")

	fmt.Printf("[GitAdapter] Fetching commits for %s since %s\n", repo.Name, sinceArg)

	cmd := exec.CommandContext(g.ctx, "git", "log", 
		"--reverse", 
		"--since="+sinceArg,
		"--pretty=format:%H|%at|%an|%s|%b",
		"--name-status")
	cmd.Dir = repo.Path

	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("[GitAdapter] ERROR: git log failed for %s: %v\n", repo.Name, err)
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	fmt.Printf("[GitAdapter] Git log output length for %s: %d bytes\n", repo.Name, len(output))
	if len(output) > 0 {
		fmt.Printf("[GitAdapter] First 200 chars: %s...\n", string(output)[:min(200, len(output))])
	}

	events := g.parseGitLog(string(output), repo)
	
	fmt.Printf("[GitAdapter] Parsed %d events for %s\n", len(events), repo.Name)
	
	// Update last sync time
	if len(events) > 0 {
		g.lastSync[repo.Path] = time.Now()
		fmt.Printf("[GitAdapter] Updated last sync time for %s\n", repo.Name)
	}

	return events, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// parseGitLog parses git log output into events
func (g *GitAdapter) parseGitLog(output string, repo *types.Repo) []*types.EventRow {
	if strings.TrimSpace(output) == "" {
		return nil
	}

	var events []*types.EventRow
	lines := strings.Split(output, "\n")
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse commit line format: hash|timestamp|author|subject|body
		parts := strings.SplitN(line, "|", 5)
		if len(parts) < 4 {
			continue
		}

		hash := parts[0]
		timestampStr := parts[1]
		author := parts[2]
		subject := parts[3]
		
		timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
		if err != nil {
			continue
		}

		commitTime := time.Unix(timestamp, 0)
		
		// Determine commit type from subject
		commitType := g.categorizeCommit(subject)
		
		meta := fmt.Sprintf(`{"author": "%s", "commit_type": "%s", "hash": "%s"}`, 
			author, commitType, hash)

		event := &types.EventRow{
			Timestamp: commitTime,
			Agent:     "git",
			SessionID: hash,
			Thought:   nil,
			Action:    "commit",
			Result:    subject,
			Tokens:    -1,
			Meta:      meta,
			RepoID:    repo.ID,
		}
		
		events = append(events, event)
	}

	return events
}

// categorizeCommit categorizes a commit based on its subject
func (g *GitAdapter) categorizeCommit(subject string) string {
	subject = strings.ToLower(subject)
	
	if strings.Contains(subject, "fix") || strings.Contains(subject, "bug") {
		return "fix"
	}
	if strings.Contains(subject, "feat") || strings.Contains(subject, "add") {
		return "feature"
	}
	if strings.Contains(subject, "test") {
		return "test"
	}
	if strings.Contains(subject, "refactor") || strings.Contains(subject, "clean") {
		return "refactor"
	}
	if strings.Contains(subject, "docs") || strings.Contains(subject, "readme") {
		return "docs"
	}
	if strings.Contains(subject, "merge") {
		return "merge"
	}
	
	return "other"
}

// isGitRepo checks if the given path is a git repository
func (g *GitAdapter) isGitRepo(path string) bool {
	gitPath := filepath.Join(path, ".git")
	cmd := exec.Command("test", "-d", gitPath)
	return cmd.Run() == nil
}