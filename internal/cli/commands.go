package cli

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pkg/browser"
	"github.com/spf13/cobra"
	"github.com/snowfort/control/internal/adapters"
	"github.com/snowfort/control/internal/server"
	"github.com/snowfort/control/internal/storage"
)

var ingestCmd = &cobra.Command{
	Use:   "ingest",
	Short: "One-off import of Claude and Git data",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := storage.NewStorage()
		if err != nil {
			log.Fatalf("Failed to initialize storage: %v", err)
		}
		defer store.Close()

		// Ingest Claude data
		claudeAdapter := adapters.NewClaudeAdapter()
		claudeEvents, err := claudeAdapter.FetchEvents()
		if err != nil {
			log.Printf("Warning: Failed to fetch Claude events: %v", err)
		} else {
			for _, event := range claudeEvents {
				if err := store.InsertEvent(event); err != nil {
					log.Printf("Failed to insert Claude event: %v", err)
				}
			}
			fmt.Printf("Ingested %d Claude events\n", len(claudeEvents))
		}

		// Ingest Git data
		gitAdapter := adapters.NewGitAdapter(".")
		gitEvents, err := gitAdapter.FetchEvents()
		if err != nil {
			log.Printf("Warning: Failed to fetch Git events: %v", err)
		} else {
			for _, event := range gitEvents {
				if err := store.InsertEvent(event); err != nil {
					log.Printf("Failed to insert Git event: %v", err)
				}
			}
			fmt.Printf("Ingested %d Git events\n", len(gitEvents))
		}
	},
}

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Start tailers that watch Claude and Git for new events",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := storage.NewStorage()
		if err != nil {
			log.Fatalf("Failed to initialize storage: %v", err)
		}
		defer store.Close()

		eventChan := make(chan storage.Event, 100)
		stopChan := make(chan struct{})

		// Start adapters
		claudeAdapter := adapters.NewClaudeAdapter()
		gitAdapter := adapters.NewGitAdapter(".")

		go claudeAdapter.Watch(eventChan, stopChan)
		go gitAdapter.Watch(eventChan, stopChan)

		// Handle events
		go func() {
			for event := range eventChan {
				if err := store.InsertEvent(event); err != nil {
					log.Printf("Failed to insert event: %v", err)
				} else {
					fmt.Printf("New %s event: %s\n", event.Agent, event.Action)
				}
			}
		}()

		fmt.Println("Watching for new events... Press Ctrl+C to stop")

		// Wait for interrupt signal
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		close(stopChan)
		close(eventChan)
		fmt.Println("\nStopping watchers...")
	},
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the HTTP server with API endpoints",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := storage.NewStorage()
		if err != nil {
			log.Fatalf("Failed to initialize storage: %v", err)
		}
		defer store.Close()

		srv := server.NewServer(store)
		
		fmt.Println("Starting server on http://localhost:9123")
		if err := srv.Start(":9123"); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	},
}

var dashboardCmd = &cobra.Command{
	Use:   "dashboard",
	Short: "Start server and open dashboard in browser",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := storage.NewStorage()
		if err != nil {
			log.Fatalf("Failed to initialize storage: %v", err)
		}
		defer store.Close()

		srv := server.NewServer(store)
		
		// Start server in background
		go func() {
			fmt.Println("Starting server on http://localhost:9123")
			if err := srv.Start(":9123"); err != nil {
				log.Fatalf("Server failed: %v", err)
			}
		}()

		// Wait a moment for server to start
		time.Sleep(2 * time.Second)

		// Open browser
		url := "http://localhost:9123"
		fmt.Printf("Opening dashboard at %s\n", url)
		if err := browser.OpenURL(url); err != nil {
			fmt.Printf("Failed to open browser: %v\n", err)
			fmt.Printf("Please manually open: %s\n", url)
		}

		// Keep running
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		fmt.Println("\nShutting down...")
	},
}

var badgeCmd = &cobra.Command{
	Use:   "badge",
	Short: "Generate markdown badge for Stability Score",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := storage.NewStorage()
		if err != nil {
			log.Fatalf("Failed to initialize storage: %v", err)
		}
		defer store.Close()

		// Get current metrics
		metrics, err := store.GetMetrics(time.Now().Add(-30 * 24 * time.Hour))
		if err != nil {
			log.Fatalf("Failed to get metrics: %v", err)
		}

		stability, ok := metrics["stability_score"].(float64)
		if !ok {
			stability = 0.0
		}

		// Generate badge markdown
		score := int(stability * 100)
		color := "red"
		if score >= 90 {
			color = "brightgreen"
		} else if score >= 70 {
			color = "yellow"
		} else if score >= 50 {
			color = "orange"
		}

		badge := fmt.Sprintf("[![Stability](https://img.shields.io/badge/Stability-%d%%25-%s)](https://github.com/snowfort/control)", score, color)
		fmt.Println(badge)
	},
}

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync data to remote Supabase instance",
	Run: func(cmd *cobra.Command, args []string) {
		remote, _ := cmd.Flags().GetBool("remote")
		if !remote {
			fmt.Println("Use --remote flag to enable remote sync")
			return
		}

		fmt.Println("Remote sync not yet implemented in v0.1")
		// TODO: Implement Supabase sync
	},
}

func init() {
	syncCmd.Flags().Bool("remote", false, "Enable remote sync to Supabase")
}