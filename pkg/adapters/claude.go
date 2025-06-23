package adapters

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/snowfort-labs/control/pkg/types"
)

// ClaudeAdapter implements the Adapter interface for Claude Code
type ClaudeAdapter struct {
	projectsPath   string
	lastSync       map[string]time.Time // keyed by repo path
	fileStates     map[string]map[string]int64 // [repo][file] -> last size
	lastError      error // track last error for health reporting
	isHealthy      bool  // track overall health status
	activeRepos    int   // count of repositories currently being watched
	ctx            context.Context
	cancel         context.CancelFunc
}

// ClaudeMessage represents a message in Claude Code's JSONL format
type ClaudeMessage struct {
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	CWD       string    `json:"cwd"`
	Message   struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	SessionID  string `json:"sessionId"`
	UUID       string `json:"uuid"`
	ParentUUID string `json:"parentUuid"`
	UserType   string `json:"userType"`
	Summary    string `json:"summary"`
	Name       string `json:"name"`
	Input      interface{} `json:"input"`
}

// NewClaudeAdapter creates a new Claude adapter
func NewClaudeAdapter() *ClaudeAdapter {
	homeDir, _ := os.UserHomeDir()
	projectsPath := filepath.Join(homeDir, ".claude", "projects")
	
	return &ClaudeAdapter{
		projectsPath: projectsPath,
		lastSync:     make(map[string]time.Time),
		fileStates:   make(map[string]map[string]int64),
		isHealthy:    true, // start optimistic
	}
}

// Name returns the adapter name
func (c *ClaudeAdapter) Name() string {
	return "claude"
}

// Start begins watching the Claude projects for new interactions
func (c *ClaudeAdapter) Start(ctx context.Context, repo *types.Repo, ch chan<- []*types.EventRow) error {
	c.ctx, c.cancel = context.WithCancel(ctx)
	
	// Check if Claude projects directory exists
	if !c.projectsExist() {
		return fmt.Errorf("Claude projects directory not found at %s", c.projectsPath)
	}

	// Initialize last sync time and file states if not exists
	if _, exists := c.lastSync[repo.Path]; !exists {
		c.lastSync[repo.Path] = time.Now().Add(-7 * 24 * time.Hour) // Start from 7 days ago for initial sync
		fmt.Printf("[ClaudeAdapter] Initialized last sync for %s to 7 days ago\n", repo.Name)
	}
	if c.fileStates[repo.Path] == nil {
		c.fileStates[repo.Path] = make(map[string]int64)
	}

	// Increment active repository count
	c.activeRepos++

	// Start polling for new messages
	go c.pollMessages(repo, ch)
	
	return nil
}

// Stop stops the Claude adapter
func (c *ClaudeAdapter) Stop() error {
	if c.cancel != nil {
		c.cancel()
	}
	return nil
}

// Health returns the current health status of the Claude adapter
func (c *ClaudeAdapter) Health() AdapterHealth {
	var status string
	var lastError string
	
	if c.activeRepos > 0 {
		if c.isHealthy {
			status = "running"
		} else {
			status = "error"
		}
	} else {
		status = "stopped"
	}
	
	if c.lastError != nil {
		lastError = c.lastError.Error()
	}
	
	return AdapterHealth{
		IsHealthy: c.isHealthy && status == "running",
		LastError: lastError,
		Status:    status,
	}
}

// projectsExist checks if the Claude projects directory exists
func (c *ClaudeAdapter) projectsExist() bool {
	info, err := os.Stat(c.projectsPath)
	return err == nil && info.IsDir()
}

// pollMessages polls for new Claude messages
func (c *ClaudeAdapter) pollMessages(repo *types.Repo, ch chan<- []*types.EventRow) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			events, err := c.fetchNewMessages(repo)
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

// fetchNewMessages fetches new Claude messages since last sync
func (c *ClaudeAdapter) fetchNewMessages(repo *types.Repo) ([]*types.EventRow, error) {
	since := c.lastSync[repo.Path]
	
	// Find the project directory for this repo
	projectDir := c.findProjectDir(repo.Path)
	if projectDir == "" {
		// No project directory found for this repo
		return nil, nil
	}
	
	fmt.Printf("[ClaudeAdapter] Checking project directory: %s\n", projectDir)
	
	// List all JSONL files in the project directory (Claude uses UUID names)
	files, err := filepath.Glob(filepath.Join(projectDir, "*.jsonl"))
	if err != nil {
		return nil, fmt.Errorf("failed to list conversation files: %w", err)
	}
	
	var events []*types.EventRow
	var processingErrors []error
	
	for _, file := range files {
		fileEvents, err := c.processConversationFile(file, repo, since)
		if err != nil {
			processingErrors = append(processingErrors, err)
			fmt.Printf("[ClaudeAdapter] Error processing file %s: %v\n", file, err)
			continue
		}
		events = append(events, fileEvents...)
	}

	// Update health status based on success
	if len(processingErrors) == 0 {
		c.isHealthy = true
		c.lastError = nil
	} else if len(processingErrors) < len(files)/2 {
		// If less than half the files failed, consider it healthy but log the error
		c.isHealthy = true
		c.lastError = fmt.Errorf("some files failed to process: %d errors", len(processingErrors))
	} else {
		// If more than half failed, mark as unhealthy
		c.isHealthy = false
		c.lastError = fmt.Errorf("majority of files failed to process: %d/%d errors", len(processingErrors), len(files))
	}

	// Update last sync time
	if len(events) > 0 {
		c.lastSync[repo.Path] = time.Now()
		fmt.Printf("[ClaudeAdapter] Found %d new events for %s\n", len(events), repo.Name)
	}

	return events, nil
}

// findProjectDir finds the Claude project directory for the given repo path
func (c *ClaudeAdapter) findProjectDir(repoPath string) string {
	// Claude Code creates project directories based on the absolute path
	// Convert path separators to dashes and prefix with dash
	normalizedPath := strings.ReplaceAll(repoPath, "/", "-")
	if !strings.HasPrefix(normalizedPath, "-") {
		normalizedPath = "-" + normalizedPath
	}
	
	projectDir := filepath.Join(c.projectsPath, normalizedPath)
	
	// Check if this directory exists
	if info, err := os.Stat(projectDir); err == nil && info.IsDir() {
		return projectDir
	}
	
	// Try alternative formats - sometimes Claude Code uses different naming
	alternatives := []string{
		strings.ReplaceAll(repoPath, "/", "_"),
		filepath.Base(repoPath),
	}
	
	for _, alt := range alternatives {
		altDir := filepath.Join(c.projectsPath, alt)
		if info, err := os.Stat(altDir); err == nil && info.IsDir() {
			return altDir
		}
	}
	
	return ""
}

// processConversationFile processes a single conversation JSONL file
func (c *ClaudeAdapter) processConversationFile(filePath string, repo *types.Repo, since time.Time) ([]*types.EventRow, error) {
	// Check if file has been modified since last check
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}
	
	// Skip if file hasn't been modified since our last sync
	if fileInfo.ModTime().Before(since) {
		return nil, nil
	}
	
	// Check file size against our tracked state to avoid re-reading entire files
	fileName := filepath.Base(filePath)
	lastSize := c.fileStates[repo.Path][fileName]
	currentSize := fileInfo.Size()
	
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	
	// If file has grown, seek to the last position we read
	if currentSize > lastSize && lastSize > 0 {
		_, err = file.Seek(lastSize, 0)
		if err != nil {
			// If seek fails, read from beginning
			file.Seek(0, 0)
			lastSize = 0
		}
	}
	
	reader := bufio.NewReader(file)
	var events []*types.EventRow
	lineNum := 0
	
	for {
		lineBytes, err := reader.ReadBytes('\n')
		if err != nil {
			if err == bufio.ErrBufferFull {
				// Line too long, skip it but continue processing
				fmt.Printf("[ClaudeAdapter] Skipping very long line in %s (line %d)\n", fileName, lineNum)
				// Continue reading until we find the end of this line
				for {
					_, err := reader.ReadBytes('\n')
					if err != bufio.ErrBufferFull {
						break
					}
				}
				lineNum++
				continue
			}
			if err.Error() != "EOF" {
				return events, fmt.Errorf("error reading file: %w", err)
			}
			// EOF - we're done
			break
		}
		
		lineNum++
		line := strings.TrimSpace(string(lineBytes))
		if line == "" {
			continue
		}
		
		var message ClaudeMessage
		if err := json.Unmarshal([]byte(line), &message); err != nil {
			// Skip malformed lines but don't fail the whole file
			continue
		}
		
		// Skip messages older than our sync time
		if message.Timestamp.Before(since) {
			continue
		}
		
		// Convert Claude message to our event format
		event := c.messageToEvent(&message, repo)
		if event != nil {
			events = append(events, event)
		}
	}
	
	// Update file state
	c.fileStates[repo.Path][fileName] = currentSize
	
	return events, nil
}

// messageToEvent converts a Claude message to our event format
func (c *ClaudeAdapter) messageToEvent(message *ClaudeMessage, repo *types.Repo) *types.EventRow {
	// Determine action based on message type and role
	action := "message"
	switch message.Type {
	case "user_message":
		action = "user_input"
	case "assistant_message":
		action = "assistant_response"
	case "tool_use":
		action = "tool_execution"
	case "tool_result":
		action = "tool_result"
	}
	
	// Extract thought from assistant messages
	var thought *string
	if message.Message.Role == "assistant" && strings.Contains(message.Message.Content, "<thinking>") {
		thinkingContent := c.extractThinking(message.Message.Content)
		if thinkingContent != "" {
			thought = &thinkingContent
		}
	}
	
	// Create metadata
	meta := fmt.Sprintf(`{
		"type": "%s",
		"role": "%s",
		"sessionId": "%s",
		"uuid": "%s",
		"cwd": "%s"
	}`, message.Type, message.Message.Role, message.SessionID, message.UUID, message.CWD)
	
	return &types.EventRow{
		Timestamp: message.Timestamp,
		Agent:     "claude",
		SessionID: message.SessionID,
		Thought:   thought,
		Action:    action,
		Result:    c.truncateContent(message.Message.Content, 500),
		Tokens:    c.estimateTokens(message.Message.Content),
		Meta:      meta,
		RepoID:    repo.ID,
	}
}

// isRepoRelated checks if content is related to the repository
func (c *ClaudeAdapter) isRepoRelated(content string, repo *types.Repo) bool {
	content = strings.ToLower(content)
	repoName := strings.ToLower(filepath.Base(repo.Path))
	
	// Simple heuristics
	if strings.Contains(content, repoName) {
		return true
	}
	if strings.Contains(content, strings.ToLower(repo.Path)) {
		return true
	}
	
	// Check for common file extensions from this repo type
	// This is a simplified approach - in reality we'd want more sophisticated matching
	return strings.Contains(content, ".go") || 
		   strings.Contains(content, ".js") || 
		   strings.Contains(content, ".py") ||
		   strings.Contains(content, "file") ||
		   strings.Contains(content, "code")
}

// extractThinking extracts content from <thinking> tags
func (c *ClaudeAdapter) extractThinking(content string) string {
	start := strings.Index(content, "<thinking>")
	end := strings.Index(content, "</thinking>")
	
	if start != -1 && end != -1 && end > start {
		thinking := content[start+10 : end]
		return strings.TrimSpace(thinking)
	}
	
	return ""
}

// truncateContent truncates content to specified length
func (c *ClaudeAdapter) truncateContent(content string, maxLen int) string {
	if len(content) <= maxLen {
		return content
	}
	return content[:maxLen] + "..."
}

// estimateTokens provides a rough token count estimate
func (c *ClaudeAdapter) estimateTokens(content string) int {
	// Rough estimate: ~4 characters per token
	return len(content) / 4
}