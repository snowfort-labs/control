package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	version string
)

var rootCmd = &cobra.Command{
	Use:   "control",
	Short: "Agent observability dashboard",
	Long:  "Self-hosted, agent-observability dashboard (local-first with optional remote sync)",
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Control %s\n", version)
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func SetVersion(v string) {
	version = v
}

func init() {
	rootCmd.AddCommand(ingestCmd)
	rootCmd.AddCommand(watchCmd)
	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(dashboardCmd)
	rootCmd.AddCommand(badgeCmd)
	rootCmd.AddCommand(syncCmd)
	rootCmd.AddCommand(versionCmd)
	
	// Add version flag to root command
	rootCmd.Flags().BoolP("version", "v", false, "Print version information")
	rootCmd.Run = func(cmd *cobra.Command, args []string) {
		if versionFlag, _ := cmd.Flags().GetBool("version"); versionFlag {
			fmt.Printf("Control %s\n", version)
			return
		}
		cmd.Help()
	}
}