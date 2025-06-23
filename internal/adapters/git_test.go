package adapters

import (
	"os/exec"
	"testing"
)

func TestNewGitAdapter(t *testing.T) {
	adapter := NewGitAdapter(".")
	if adapter == nil {
		t.Fatal("Expected GitAdapter, got nil")
	}
	
	if adapter.repoPath != "." {
		t.Errorf("Expected repo path '.', got '%s'", adapter.repoPath)
	}
}

func TestGitAdapterWithNoRepo(t *testing.T) {
	// Create a temporary directory that's not a git repo
	tmpDir := t.TempDir()
	
	adapter := NewGitAdapter(tmpDir)
	
	// This should not panic, but might return an error
	hasNew, err := adapter.HasNewData()
	if err == nil {
		// If no error, hasNew should be false
		if hasNew {
			t.Error("Expected no new data in non-git directory")
		}
	}
	// If there's an error, that's expected for a non-git directory
}

func TestGitAdapterCategorizeCommit(t *testing.T) {
	adapter := NewGitAdapter(".")
	
	testCases := []struct {
		message  string
		expected string
	}{
		{"feat: add new feature", "feature"},
		{"fix: resolve bug in parser", "fix"},
		{"refactor: clean up code", "refactor"},
		{"docs: update README", "docs"},
		{"test: add unit tests", "test"},
		{"style: format code", "style"},
		{"merge: pull request #123", "merge"},
		{"random commit message", "other"},
	}
	
	for _, tc := range testCases {
		result := adapter.categorizeCommit(tc.message)
		if result != tc.expected {
			t.Errorf("For message '%s', expected category '%s', got '%s'", 
				tc.message, tc.expected, result)
		}
	}
}

func TestGitAdapterInRealRepo(t *testing.T) {
	// Skip this test if we're not in a git repository
	if !isGitRepo() {
		t.Skip("Not in a git repository, skipping git adapter test")
	}
	
	adapter := NewGitAdapter(".")
	
	// Test getting historical metrics
	metrics, err := adapter.GetHistoricalMetrics()
	if err != nil {
		t.Fatalf("Failed to get historical metrics: %v", err)
	}
	
	// Verify metrics structure
	expectedKeys := []string{
		"stability_score",
		"autonomy_percent", 
		"rework_amplification",
		"total_commits",
		"rework_commits",
		"unique_authors",
		"avg_changes_per_commit",
	}
	
	for _, key := range expectedKeys {
		if _, exists := metrics[key]; !exists {
			t.Errorf("Missing expected metric key: %s", key)
		}
	}
}

func isGitRepo() bool {
	cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
	err := cmd.Run()
	return err == nil
}