package cmd

import "github.com/spf13/cobra"

func Execute() error {
	rootCmd := &cobra.Command{
		Use:   "google-health-cli",
		Short: "Export health data through the Google Health API",
	}

	rootCmd.AddCommand(newAuthCommand())
	rootCmd.AddCommand(newSleepCommand())
	return rootCmd.Execute()
}
