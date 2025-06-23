package storage

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewStorage(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()
	
	// Override the home directory for testing
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)
	
	storage, err := NewStorage()
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()
	
	// Check that the database file was created
	dbPath := filepath.Join(tmpDir, ".control", "control.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Errorf("Database file was not created at %s", dbPath)
	}
}

func TestInsertAndGetEvents(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()
	
	// Override the home directory for testing
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)
	
	storage, err := NewStorage()
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()
	
	// Create a test event
	testEvent := Event{
		Timestamp: time.Now(),
		Agent:     "test",
		SessionID: "test-session",
		Thought:   nil,
		Action:    "test-action",
		Result:    "test-result",
		Tokens:    100,
		Meta: map[string]interface{}{
			"test_key": "test_value",
		},
	}
	
	// Insert the event
	err = storage.InsertEvent(testEvent)
	if err != nil {
		t.Fatalf("Failed to insert event: %v", err)
	}
	
	// Retrieve events
	events, err := storage.GetEvents(time.Now().Add(-1*time.Hour), 10)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}
	
	// Verify the event was retrieved
	if len(events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(events))
	}
	
	if events[0].Agent != "test" {
		t.Errorf("Expected agent 'test', got '%s'", events[0].Agent)
	}
	
	if events[0].Action != "test-action" {
		t.Errorf("Expected action 'test-action', got '%s'", events[0].Action)
	}
}

func TestGetMetrics(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()
	
	// Override the home directory for testing
	originalHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", originalHome)
	
	storage, err := NewStorage()
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()
	
	// Get metrics (should return defaults)
	metrics, err := storage.GetMetrics(time.Now().Add(-24 * time.Hour))
	if err != nil {
		t.Fatalf("Failed to get metrics: %v", err)
	}
	
	// Verify required metrics are present
	requiredMetrics := []string{
		"stability_score",
		"autonomy_percent",
		"rework_amplification",
		"token_spend",
		"turns_per_task",
	}
	
	for _, metric := range requiredMetrics {
		if _, exists := metrics[metric]; !exists {
			t.Errorf("Missing required metric: %s", metric)
		}
	}
}