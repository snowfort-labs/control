package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "control",
	Short: "Agent observability dashboard for multi-repository workspaces",
	Long: `Control is a self-hosted agent observability dashboard that tracks
Claude Code and Git interactions across multiple repositories.`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(dashboardCmd)
	rootCmd.AddCommand(watchCmd)
	rootCmd.AddCommand(ingestCmd)
	rootCmd.AddCommand(badgeCmd)
}