package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"google-health-cli/internal/credentials"
	"google-health-cli/internal/exporter"
	"google-health-cli/internal/googlehealth"

	"github.com/spf13/cobra"
)

type sleepExportOptions struct {
	endDate      string
	year         int
	clientID     string
	clientSecret string
	redirectURL  string
	tokenFile    string
	outDir       string
	merge        bool
	groupBy      string
}

func newSleepCommand() *cobra.Command {
	sleepCmd := &cobra.Command{
		Use:   "sleep",
		Short: "Work with Google Health sleep data",
	}

	sleepCmd.AddCommand(newSleepExportCommand())
	return sleepCmd
}

func newSleepExportCommand() *cobra.Command {
	opts := sleepExportOptions{
		endDate:      time.Now().Format(time.DateOnly),
		clientID:     os.Getenv("GOOGLE_HEALTH_CLIENT_ID"),
		clientSecret: os.Getenv("GOOGLE_HEALTH_CLIENT_SECRET"),
		redirectURL:  envOrDefault("GOOGLE_HEALTH_REDIRECT_URL", "http://127.0.0.1:8080/oauth2/callback"),
		tokenFile:    envOrDefault("GOOGLE_HEALTH_TOKEN_FILE", filepath.Join("..", "google-health-token.json")),
		merge:        true,
		groupBy:      "month",
	}

	cmd := &cobra.Command{
		Use:   "export",
		Short: "Export sleep data grouped by month or ISO week",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runSleepExport(cmd.Context(), opts)
		},
	}

	cmd.Flags().StringVar(&opts.endDate, "end-date", opts.endDate, "last date to export, in YYYY-MM-DD format")
	cmd.Flags().IntVar(&opts.year, "year", 0, "year to export; defaults to the year from --end-date")
	cmd.Flags().StringVar(&opts.clientID, "client-id", opts.clientID, "Google OAuth client ID (defaults to GOOGLE_HEALTH_CLIENT_ID)")
	cmd.Flags().StringVar(&opts.redirectURL, "redirect-url", opts.redirectURL, "authorized Google OAuth redirect URL")
	cmd.Flags().StringVar(&opts.tokenFile, "token-file", opts.tokenFile, "Google OAuth token file")
	cmd.Flags().StringVar(&opts.outDir, "out-dir", "", "output directory; defaults to ../data/google-health/sleep/<year>")
	cmd.Flags().BoolVar(&opts.merge, "merge", opts.merge, "write a merged yearly JSON file")
	cmd.Flags().StringVar(&opts.groupBy, "group-by", opts.groupBy, "file grouping: month or week")

	return cmd
}

func runSleepExport(ctx context.Context, opts sleepExportOptions) error {
	endDate, err := time.Parse(time.DateOnly, opts.endDate)
	if err != nil {
		return fmt.Errorf("parse --end-date: %w", err)
	}

	year := opts.year
	if year == 0 {
		year = endDate.Year()
	}

	outDir := opts.outDir
	if outDir == "" {
		outDir = filepath.Join("..", "data", "google-health", "sleep", fmt.Sprint(year))
	}

	store := credentials.NewTokenStore(opts.tokenFile)
	token, err := store.Load()
	if err != nil {
		return err
	}

	client, err := googlehealth.NewClient(ctx, googlehealth.Config{
		ClientID:     opts.clientID,
		ClientSecret: opts.clientSecret,
		RedirectURL:  opts.redirectURL,
		Token:        token,
		TokenStore:   store,
	})
	if err != nil {
		return err
	}

	result, err := exporter.ExportSleep(ctx, exporter.SleepExportOptions{
		Client:  client,
		Year:    year,
		EndDate: endDate,
		OutDir:  outDir,
		Merge:   opts.merge,
		GroupBy: opts.groupBy,
	})
	if err != nil {
		return err
	}

	for _, file := range result.PeriodFiles {
		fmt.Printf("Saved %s (%s to %s, %d records)\n", file.Path, file.Start.Format(time.DateOnly), file.End.Format(time.DateOnly), file.Records)
	}

	if result.Merged != nil {
		fmt.Printf("Merged file: %s\n", result.Merged.Path)
		fmt.Printf("%s\t%s\t%d records\t%d recorded days\tavg %dh%02dm/day\n",
			result.Merged.FirstDate,
			result.Merged.LastDate,
			result.Merged.Records,
			result.Merged.RecordedDays,
			result.Merged.AverageMinutesPerRecordedDay/60,
			result.Merged.AverageMinutesPerRecordedDay%60,
		)
	}

	return nil
}
