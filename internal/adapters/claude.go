package adapters

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/snowfort-labs/control/internal/storage"
	_ "github.com/mattn/go-sqlite3"
)

type ClaudeAdapter struct {
	storePath string
	lastSync  time.Time
}

func NewClaudeAdapter() *ClaudeAdapter {
	homeDir, _ := os.UserHomeDir()
	storePath := filepath.Join(homeDir, ".claude", "__store.db")
	return &ClaudeAdapter{
		storePath: storePath,
		lastSync:  time.Now().Add(-24 * time.Hour), // Start with last 24h
	}
}

func (c *ClaudeAdapter) HasNewData() (bool, error) {
	info, err := os.Stat(c.storePath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil // Claude not installed or no data yet
		}
		return false, err
	}
	
	return info.ModTime().After(c.lastSync), nil
}

func (c *ClaudeAdapter) FetchEvents() ([]storage.Event, error) {
	if _, err := os.Stat(c.storePath); os.IsNotExist(err) {
		return []storage.Event{}, nil // No Claude data available
	}

	db, err := sql.Open("sqlite3", c.storePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open Claude store: %w", err)
	}
	defer db.Close()

	query := `
		SELECT 
			m.created_at,
			m.conversation_id,
			m.role,
			m.content,
			t.thought
		FROM messages m
		LEFT JOIN thoughts t ON m.id = t.message_id
		WHERE m.created_at > ?
		ORDER BY m.created_at ASC
	`

	rows, err := db.Query(query, c.lastSync.Unix())
	if err != nil {
		return nil, fmt.Errorf("failed to query Claude messages: %w", err)
	}
	defer rows.Close()

	var events []storage.Event
	for rows.Next() {
		var createdAt int64
		var conversationID string
		var role string
		var content string
		var thought *string

		err := rows.Scan(&createdAt, &conversationID, &role, &content, &thought)
		if err != nil {
			return nil, err
		}

		// Skip system messages
		if role == "system" {
			continue
		}

		event := storage.Event{
			Timestamp: time.Unix(createdAt, 0),
			Agent:     "claude",
			SessionID: conversationID,
			Thought:   thought,
			Action:    role, // "user" or "assistant"
			Result:    content,
			Tokens:    -1, // Unknown for now
			Meta: map[string]interface{}{
				"role": role,
			},
		}

		events = append(events, event)
	}

	if len(events) > 0 {
		c.lastSync = time.Now()
	}

	return events, nil
}

func (c *ClaudeAdapter) Watch(eventChan chan<- storage.Event, stopChan <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hasNew, err := c.HasNewData()
			if err != nil {
				continue
			}
			if hasNew {
				events, err := c.FetchEvents()
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