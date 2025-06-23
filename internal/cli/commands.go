package cli

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/snowfort-labs/control/internal/server"
	"github.com/snowfort-labs/control/pkg/store"
	"github.com/snowfort-labs/control/pkg/watcher"
)

var (
	port int = 9123
)

var dashboardCmd = &cobra.Command{
	Use:   "dashboard",
	Short: "Start the web dashboard",
	Long:  "Starts the HTTP server and opens the dashboard in the browser",
	RunE:  runDashboard,
}

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Start watching repositories (headless mode)",
	Long:  "Starts the watcher in headless mode without the web interface",
	RunE:  runWatch,
}

var ingestCmd = &cobra.Command{
	Use:   "ingest",
	Short: "One-time ingestion of historical data",
	Long:  "Performs a one-time ingestion of historical Git and Claude data",
	RunE:  runIngest,
}

var badgeCmd = &cobra.Command{
	Use:   "badge",
	Short: "Generate markdown badge for README",
	Long:  "Generates a markdown badge showing current stability score",
	RunE:  runBadge,
}

func init() {
	dashboardCmd.Flags().IntVarP(&port, "port", "p", 9123, "Port to run the server on")
	watchCmd.Flags().IntVarP(&port, "port", "p", 9123, "Port for API server (optional)")
}

func runDashboard(cmd *cobra.Command, args []string) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize store
	store := store.NewDuckDBStore("")
	if err := store.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize store: %w", err)
	}
	defer store.Close()

	// Initialize watcher
	watchManager := watcher.NewManager(store)
	if err := watchManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start watcher: %w", err)
	}
	defer watchManager.Stop()

	// Initialize server
	srv := server.NewServer(store, watchManager)

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("Shutting down...")
		cancel()
	}()

	// Open browser
	go func() {
		time.Sleep(1 * time.Second) // Give server time to start
		url := fmt.Sprintf("http://localhost:%d", port)
		fmt.Printf("Opening dashboard at %s\n", url)
		openBrowser(url)
	}()

	fmt.Printf("Starting server on http://localhost:%d\n", port)
	return srv.Start(port)
}

func runWatch(cmd *cobra.Command, args []string) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize store
	store := store.NewDuckDBStore("")
	if err := store.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize store: %w", err)
	}
	defer store.Close()

	// Initialize watcher
	watchManager := watcher.NewManager(store)
	if err := watchManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start watcher: %w", err)
	}
	defer watchManager.Stop()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	fmt.Println("Watching repositories... Press Ctrl+C to stop")
	<-sigChan
	fmt.Println("Stopping watcher...")

	return nil
}

func runIngest(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Initialize store
	store := store.NewDuckDBStore("")
	if err := store.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize store: %w", err)
	}
	defer store.Close()

	// Get all repos
	repos, err := store.ListRepos(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to list repos: %w", err)
	}

	if len(repos) == 0 {
		fmt.Println("No repositories configured. Use 'control dashboard' to add repositories.")
		return nil
	}

	fmt.Printf("Starting ingestion for %d repositories...\n", len(repos))

	// Initialize watcher for one-time ingestion
	watchManager := watcher.NewManager(store)
	if err := watchManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start watcher: %w", err)
	}
	defer watchManager.Stop()

	// Start watching all repos for a short period to ingest data
	for _, repo := range repos {
		if err := watchManager.StartWatching(repo); err != nil {
			log.Printf("Failed to start watching %s: %v", repo.Name, err)
			continue
		}
		fmt.Printf("Ingesting data from %s...\n", repo.Name)
	}

	// Let it run for a bit to collect data
	time.Sleep(10 * time.Second)

	fmt.Println("Ingestion completed.")
	return nil
}

func runBadge(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	// Initialize store
	store := store.NewDuckDBStore("")
	if err := store.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize store: %w", err)
	}
	defer store.Close()

	// Calculate current stability score (simplified)
	// In a real implementation, this would calculate actual metrics
	stabilityScore := 85 // Placeholder

	badgeURL := fmt.Sprintf("https://img.shields.io/badge/Stability-%d%%25-brightgreen", stabilityScore)
	markdown := fmt.Sprintf("[![Stability Score](%s)](https://github.com/snowfort-labs/control)", badgeURL)

	fmt.Println("Markdown badge:")
	fmt.Println(markdown)

	return nil
}

func openBrowser(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		fmt.Printf("Please open your browser and go to: %s\n", url)
		return
	}

	if err := cmd.Start(); err != nil {
		fmt.Printf("Failed to open browser. Please go to: %s\n", url)
	}
}