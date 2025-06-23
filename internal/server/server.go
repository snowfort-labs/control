package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/snowfort-labs/control/internal/storage"
)

type Server struct {
	storage  *storage.Storage
	upgrader websocket.Upgrader
}

func NewServer(storage *storage.Storage) *Server {
	return &Server{
		storage: storage,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for local development
			},
		},
	}
}

func (s *Server) Start(addr string) error {
	r := mux.NewRouter()

	// API routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/metrics", s.handleMetrics).Methods("GET")
	api.HandleFunc("/events", s.handleEvents).Methods("GET")
	api.HandleFunc("/events/stream", s.handleEventsStream).Methods("GET")

	// Static files (embedded frontend will go here)
	r.HandleFunc("/", s.handleIndex).Methods("GET")
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./web/build/static/"))))

	fmt.Printf("Server starting on %s\n", addr)
	return http.ListenAndServe(addr, r)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Parse since parameter
	since := time.Now().Add(-24 * time.Hour) // Default to last 24h
	if sinceParam := r.URL.Query().Get("since"); sinceParam != "" {
		if ts, err := strconv.ParseInt(sinceParam, 10, 64); err == nil {
			since = time.Unix(ts, 0)
		} else if t, err := time.Parse(time.RFC3339, sinceParam); err == nil {
			since = t
		}
	}

	metrics, err := s.storage.GetMetrics(since)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get metrics: %v", err), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(metrics); err != nil {
		http.Error(w, fmt.Sprintf("Failed to encode response: %v", err), http.StatusInternalServerError)
	}
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Parse parameters
	since := time.Now().Add(-24 * time.Hour) // Default to last 24h
	limit := 100 // Default limit

	if sinceParam := r.URL.Query().Get("since"); sinceParam != "" {
		if ts, err := strconv.ParseInt(sinceParam, 10, 64); err == nil {
			since = time.Unix(ts, 0)
		} else if t, err := time.Parse(time.RFC3339, sinceParam); err == nil {
			since = t
		}
	}

	if limitParam := r.URL.Query().Get("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}

	events, err := s.storage.GetEvents(since, limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get events: %v", err), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(events); err != nil {
		http.Error(w, fmt.Sprintf("Failed to encode response: %v", err), http.StatusInternalServerError)
	}
}

func (s *Server) handleEventsStream(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Upgrade to WebSocket for better real-time support
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Fall back to SSE
		s.handleSSE(w, r)
		return
	}
	defer conn.Close()

	// Send initial data
	events, err := s.storage.GetEvents(time.Now().Add(-1*time.Hour), 10)
	if err == nil {
		conn.WriteJSON(map[string]interface{}{
			"type": "initial",
			"data": events,
		})
	}

	// Send periodic updates
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	lastCheck := time.Now()
	for {
		select {
		case <-ticker.C:
			// Check for new events since last check
			newEvents, err := s.storage.GetEvents(lastCheck, 10)
			if err != nil {
				continue
			}

			if len(newEvents) > 0 {
				conn.WriteJSON(map[string]interface{}{
					"type": "update",
					"data": newEvents,
				})
				lastCheck = time.Now()
			}

			// Send heartbeat
			conn.WriteJSON(map[string]interface{}{
				"type": "heartbeat",
				"timestamp": time.Now().Unix(),
			})
		}
	}
}

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	// Send initial data
	events, err := s.storage.GetEvents(time.Now().Add(-1*time.Hour), 10)
	if err == nil {
		data, _ := json.Marshal(events)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Send periodic updates
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	lastCheck := time.Now()
	for {
		select {
		case <-ticker.C:
			newEvents, err := s.storage.GetEvents(lastCheck, 10)
			if err != nil {
				continue
			}

			if len(newEvents) > 0 {
				data, _ := json.Marshal(newEvents)
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
				lastCheck = time.Now()
			}
		case <-r.Context().Done():
			return
		}
	}
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	// Serve a simple HTML page for now
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Control Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #0d1117; color: #c9d1d9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #58a6ff; }
        .metric-label { font-size: 0.9em; color: #8b949e; margin-top: 5px; }
        .events { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
        .event { padding: 10px; border-bottom: 1px solid #30363d; }
        .event:last-child { border-bottom: none; }
        .event-time { color: #8b949e; font-size: 0.8em; }
        .event-agent { color: #f85149; font-weight: bold; }
        .event-action { color: #a5a5a5; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎛️ Control Dashboard</h1>
            <p>Agent Observability & Performance Metrics</p>
        </div>
        
        <div class="metrics" id="metrics">
            <div class="metric">
                <div class="metric-value" id="stability">--</div>
                <div class="metric-label">Stability Score</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="autonomy">--</div>
                <div class="metric-label">Autonomy %</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="rework">--</div>
                <div class="metric-label">Rework Amplification</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="tokens">--</div>
                <div class="metric-label">Token Spend</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="turns">--</div>
                <div class="metric-label">Turns Per Task</div>
            </div>
        </div>
        
        <div class="events">
            <h3>Recent Events</h3>
            <div id="event-list">Loading...</div>
        </div>
    </div>
    
    <script>
        async function updateDashboard() {
            try {
                // Fetch metrics
                const metricsResponse = await fetch('/api/metrics');
                const metrics = await metricsResponse.json();
                
                document.getElementById('stability').textContent = (metrics.stability_score * 100).toFixed(1);
                document.getElementById('autonomy').textContent = metrics.autonomy_percent.toFixed(1);
                document.getElementById('rework').textContent = metrics.rework_amplification.toFixed(2);
                document.getElementById('tokens').textContent = metrics.token_spend.toLocaleString();
                document.getElementById('turns').textContent = metrics.turns_per_task.toFixed(1);
                
                // Fetch events
                const eventsResponse = await fetch('/api/events?limit=10');
                const events = await eventsResponse.json();
                
                const eventList = document.getElementById('event-list');
                eventList.innerHTML = events.map(event => 
                    '<div class="event">' +
                    '<div class="event-time">' + new Date(event.ts).toLocaleString() + '</div>' +
                    '<div><span class="event-agent">' + event.agent + '</span> ' +
                    '<span class="event-action">' + event.action + '</span></div>' +
                    '<div>' + (event.result.length > 100 ? event.result.substring(0, 100) + '...' : event.result) + '</div>' +
                    '</div>'
                ).join('');
                
            } catch (error) {
                console.error('Failed to update dashboard:', error);
            }
        }
        
        // Update immediately and then every 10 seconds
        updateDashboard();
        setInterval(updateDashboard, 10000);
    </script>
</body>
</html>`

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}