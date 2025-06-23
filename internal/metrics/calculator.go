package metrics

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/snowfort/control/internal/storage"
)

type Calculator struct {
	storage *storage.Storage
}

type Metrics struct {
	StabilityScore      float64                `json:"stability_score"`
	AutonomyPercent     float64                `json:"autonomy_percent"`
	ReworkAmplification float64                `json:"rework_amplification"`
	TokenSpend          int                    `json:"token_spend"`
	TurnsPerTask        float64                `json:"turns_per_task"`
	Timeline            []TimelinePoint        `json:"timeline"`
	Breakdown           map[string]interface{} `json:"breakdown"`
}

type TimelinePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Type      string    `json:"type"`
}

func NewCalculator(storage *storage.Storage) *Calculator {
	return &Calculator{storage: storage}
}

func (c *Calculator) CalculateMetrics(since time.Time) (*Metrics, error) {
	events, err := c.storage.GetEvents(since, 10000) // Get more events for analysis
	if err != nil {
		return nil, fmt.Errorf("failed to get events: %w", err)
	}

	// Separate events by agent
	claudeEvents := []storage.Event{}
	gitEvents := []storage.Event{}

	for _, event := range events {
		if event.Agent == "claude" {
			claudeEvents = append(claudeEvents, event)
		} else if event.Agent == "git" {
			gitEvents = append(gitEvents, event)
		}
	}

	// Calculate individual metrics
	stability := c.calculateStabilityScore(gitEvents, claudeEvents)
	autonomy := c.calculateAutonomyPercent(claudeEvents)
	rework := c.calculateReworkAmplification(gitEvents)
	tokenSpend := c.calculateTokenSpend(claudeEvents)
	turnsPerTask := c.calculateTurnsPerTask(claudeEvents)
	timeline := c.generateTimeline(events)
	breakdown := c.generateBreakdown(claudeEvents, gitEvents)

	return &Metrics{
		StabilityScore:      stability,
		AutonomyPercent:     autonomy,
		ReworkAmplification: rework,
		TokenSpend:          tokenSpend,
		TurnsPerTask:        turnsPerTask,
		Timeline:            timeline,
		Breakdown:           breakdown,
	}, nil
}

func (c *Calculator) calculateStabilityScore(gitEvents, claudeEvents []storage.Event) float64 {
	if len(gitEvents) == 0 {
		return 0.95 // Default high score if no git data
	}

	reworkCommits := 0
	totalCommits := len(gitEvents)

	for _, event := range gitEvents {
		if meta, ok := event.Meta["is_rework"].(bool); ok && meta {
			reworkCommits++
		}
	}

	// Factor in Claude interaction density
	claudeDensity := float64(len(claudeEvents)) / float64(totalCommits)
	if claudeDensity > 5.0 { // High Claude interaction might indicate problems
		reworkCommits += int(claudeDensity * 0.1 * float64(totalCommits))
	}

	if totalCommits == 0 {
		return 0.95
	}

	stability := 1.0 - (float64(reworkCommits) / float64(totalCommits))
	return math.Max(0.0, math.Min(1.0, stability))
}

func (c *Calculator) calculateAutonomyPercent(claudeEvents []storage.Event) float64 {
	if len(claudeEvents) == 0 {
		return 85.0 // Default if no Claude data
	}

	autonomousActions := 0
	totalActions := 0

	for _, event := range claudeEvents {
		if event.Action == "assistant" {
			totalActions++
			
			// Check if this is a self-directed action vs responding to user
			if c.isAutonomousAction(event) {
				autonomousActions++
			}
		}
	}

	if totalActions == 0 {
		return 85.0
	}

	return (float64(autonomousActions) / float64(totalActions)) * 100
}

func (c *Calculator) isAutonomousAction(event storage.Event) bool {
	result := strings.ToLower(event.Result)
	
	// Look for autonomous patterns
	autonomousPatterns := []string{
		"let me", "i'll", "i will", "i need to", "first i", "next i",
		"now i", "i should", "i'm going to", "i can", "i notice",
	}
	
	for _, pattern := range autonomousPatterns {
		if strings.Contains(result, pattern) {
			return true
		}
	}
	
	return false
}

func (c *Calculator) calculateReworkAmplification(gitEvents []storage.Event) float64 {
	if len(gitEvents) < 2 {
		return 1.0 // No amplification if insufficient data
	}

	reworkCommits := 0
	totalCommits := len(gitEvents)

	for _, event := range gitEvents {
		if meta, ok := event.Meta["is_rework"].(bool); ok && meta {
			reworkCommits++
		}
	}

	if reworkCommits == 0 {
		return 1.0
	}

	// Calculate amplification as the ratio of total work to productive work
	productiveCommits := totalCommits - reworkCommits
	if productiveCommits <= 0 {
		return float64(totalCommits) // All work was rework
	}

	return float64(totalCommits) / float64(productiveCommits)
}

func (c *Calculator) calculateTokenSpend(claudeEvents []storage.Event) int {
	totalTokens := 0
	
	for _, event := range claudeEvents {
		if event.Tokens > 0 {
			totalTokens += event.Tokens
		} else {
			// Estimate tokens based on content length
			estimatedTokens := len(event.Result) / 4 // Rough estimate: 4 chars per token
			totalTokens += estimatedTokens
		}
	}
	
	return totalTokens
}

func (c *Calculator) calculateTurnsPerTask(claudeEvents []storage.Event) float64 {
	if len(claudeEvents) == 0 {
		return 3.2 // Default
	}

	// Group events by session to identify tasks
	sessions := make(map[string][]storage.Event)
	for _, event := range claudeEvents {
		sessions[event.SessionID] = append(sessions[event.SessionID], event)
	}

	if len(sessions) == 0 {
		return 3.2
	}

	totalTurns := 0
	for _, sessionEvents := range sessions {
		turns := 0
		for _, event := range sessionEvents {
			if event.Action == "assistant" || event.Action == "user" {
				turns++
			}
		}
		totalTurns += turns
	}

	return float64(totalTurns) / float64(len(sessions))
}

func (c *Calculator) generateTimeline(events []storage.Event) []TimelinePoint {
	timeline := []TimelinePoint{}
	
	// Group events by hour for timeline
	hourlyEvents := make(map[time.Time][]storage.Event)
	for _, event := range events {
		hour := event.Timestamp.Truncate(time.Hour)
		hourlyEvents[hour] = append(hourlyEvents[hour], event)
	}

	for hour, hourEvents := range hourlyEvents {
		// Calculate activity score for this hour
		score := float64(len(hourEvents))
		
		timeline = append(timeline, TimelinePoint{
			Timestamp: hour,
			Value:     score,
			Type:      "activity",
		})
	}

	return timeline
}

func (c *Calculator) generateBreakdown(claudeEvents, gitEvents []storage.Event) map[string]interface{} {
	breakdown := make(map[string]interface{})

	// Claude breakdown
	claudeBreakdown := map[string]int{
		"user_messages":      0,
		"assistant_messages": 0,
		"thoughts":           0,
	}

	for _, event := range claudeEvents {
		if event.Action == "user" {
			claudeBreakdown["user_messages"]++
		} else if event.Action == "assistant" {
			claudeBreakdown["assistant_messages"]++
		}
		if event.Thought != nil {
			claudeBreakdown["thoughts"]++
		}
	}

	breakdown["claude"] = claudeBreakdown

	// Git breakdown
	gitBreakdown := map[string]int{
		"total_commits":   len(gitEvents),
		"rework_commits":  0,
		"feature_commits": 0,
		"fix_commits":     0,
		"other_commits":   0,
	}

	for _, event := range gitEvents {
		if meta, ok := event.Meta["is_rework"].(bool); ok && meta {
			gitBreakdown["rework_commits"]++
		}
		
		if commitType, ok := event.Meta["commit_type"].(string); ok {
			switch commitType {
			case "feature":
				gitBreakdown["feature_commits"]++
			case "fix":
				gitBreakdown["fix_commits"]++
			default:
				gitBreakdown["other_commits"]++
			}
		}
	}

	breakdown["git"] = gitBreakdown

	return breakdown
}