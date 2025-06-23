package adapters

import (
	"bufio"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/snowfort/control/internal/storage"
)

type GitAdapter struct {
	repoPath string
	lastSync time.Time
}

func NewGitAdapter(repoPath string) *GitAdapter {
	if repoPath == "" {
		repoPath = "."
	}
	return &GitAdapter{
		repoPath: repoPath,
		lastSync: time.Now().Add(-24 * time.Hour), // Start with last 24h
	}
}

func (g *GitAdapter) HasNewData() (bool, error) {
	cmd := exec.Command("git", "log", "--oneline", "-1", "--since="+g.lastSync.Format("2006-01-02 15:04:05"))
	cmd.Dir = g.repoPath
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}
	return len(strings.TrimSpace(string(output))) > 0, nil
}

func (g *GitAdapter) FetchEvents() ([]storage.Event, error) {
	// Get commits since last sync
	cmd := exec.Command("git", "log", 
		"--reverse", 
		"--pretty=format:%H|%at|%s|%an", 
		"--since="+g.lastSync.Format("2006-01-02 15:04:05"))
	cmd.Dir = g.repoPath
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get git log: %w", err)
	}

	var events []storage.Event
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		
		parts := strings.Split(line, "|")
		if len(parts) < 4 {
			continue
		}
		
		sha := parts[0]
		timestamp, _ := strconv.ParseInt(parts[1], 10, 64)
		message := parts[2]
		author := parts[3]
		
		// Get diff stats for this commit
		diffStats, isRework := g.analyzeDiff(sha)
		
		event := storage.Event{
			Timestamp: time.Unix(timestamp, 0),
			Agent:     "git",
			SessionID: sha,
			Thought:   nil,
			Action:    "commit",
			Result:    message,
			Tokens:    -1,
			Meta: map[string]interface{}{
				"author":       author,
				"sha":          sha,
				"diff_stats":   diffStats,
				"is_rework":    isRework,
				"commit_type":  g.categorizeCommit(message),
			},
		}
		
		events = append(events, event)
	}

	if len(events) > 0 {
		g.lastSync = time.Now()
	}

	return events, nil
}

func (g *GitAdapter) analyzeDiff(sha string) (map[string]int, bool) {
	cmd := exec.Command("git", "show", "--numstat", sha)
	cmd.Dir = g.repoPath
	output, err := cmd.Output()
	if err != nil {
		return map[string]int{}, false
	}

	stats := map[string]int{
		"files_changed": 0,
		"lines_added":   0,
		"lines_deleted": 0,
	}

	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	isRework := false
	
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		
		// Parse numstat line: "additions	deletions	filename"
		fields := strings.Fields(line)
		if len(fields) >= 3 {
			if added, err := strconv.Atoi(fields[0]); err == nil {
				stats["lines_added"] += added
			}
			if deleted, err := strconv.Atoi(fields[1]); err == nil {
				stats["lines_deleted"] += deleted
			}
			stats["files_changed"]++
			
			// Simple rework detection: high delete-to-add ratio
			if stats["lines_deleted"] > 0 && stats["lines_added"] > 0 {
				ratio := float64(stats["lines_deleted"]) / float64(stats["lines_added"])
				if ratio > 0.5 {
					isRework = true
				}
			}
		}
	}

	return stats, isRework
}

func (g *GitAdapter) categorizeCommit(message string) string {
	message = strings.ToLower(message)
	
	// Simple categorization based on commit message patterns
	patterns := map[string][]string{
		"test":    {"test:", "spec", "coverage"},
		"feature": {"feat:", "add", "implement", "new"},
		"fix":     {"fix:", "bug", "error", "issue"},
		"refactor": {"refactor:", "clean", "reorganize", "restructure"},
		"docs":    {"docs:", "readme", "documentation"},
		"style":   {"style:", "format", "lint"},
		"merge":   {"merge", "pull request"},
	}
	
	for category, keywords := range patterns {
		for _, keyword := range keywords {
			if strings.Contains(message, keyword) {
				return category
			}
		}
	}
	
	return "other"
}

func (g *GitAdapter) Watch(eventChan chan<- storage.Event, stopChan <-chan struct{}) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hasNew, err := g.HasNewData()
			if err != nil {
				continue
			}
			if hasNew {
				events, err := g.FetchEvents()
				if err != nil {
					continue
				}
				for _, event := range events {
					select {
					case eventChan <- event:
					case <-stopChan:
						return
					}
				}
			}
		case <-stopChan:
			return
		}
	}
}

func (g *GitAdapter) GetHistoricalMetrics() (map[string]interface{}, error) {
	// Get all commits from the last month for baseline metrics
	cmd := exec.Command("git", "log", 
		"--pretty=format:%H|%at|%s|%an", 
		"--since=30 days ago")
	cmd.Dir = g.repoPath
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get git history: %w", err)
	}

	totalCommits := 0
	reworkCommits := 0
	totalChanges := 0
	authors := make(map[string]int)
	
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		
		parts := strings.Split(line, "|")
		if len(parts) < 4 {
			continue
		}
		
		sha := parts[0]
		author := parts[3]
		
		totalCommits++
		authors[author]++
		
		_, isRework := g.analyzeDiff(sha)
		if isRework {
			reworkCommits++
		}
		
		// Count total file changes
		cmd := exec.Command("git", "show", "--name-only", "--pretty=format:", sha)
		cmd.Dir = g.repoPath
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(strings.TrimSpace(string(output)), "\n")
			totalChanges += len(lines)
		}
	}

	stabilityScore := 1.0
	if totalCommits > 0 {
		stabilityScore = 1.0 - (float64(reworkCommits) / float64(totalCommits))
	}

	autonomyPercent := 85.0 // Placeholder - would need more sophisticated analysis
	
	reworkAmplification := 1.0
	if totalCommits > reworkCommits && reworkCommits > 0 {
		reworkAmplification = float64(totalCommits) / float64(totalCommits-reworkCommits)
	}

	return map[string]interface{}{
		"stability_score":      stabilityScore,
		"autonomy_percent":     autonomyPercent,
		"rework_amplification": reworkAmplification,
		"total_commits":        totalCommits,
		"rework_commits":       reworkCommits,
		"unique_authors":       len(authors),
		"avg_changes_per_commit": float64(totalChanges) / float64(totalCommits),
	}, nil
}