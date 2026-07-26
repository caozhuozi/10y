package exporter

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	health "google.golang.org/api/health/v4"
)

type SleepClient interface {
	SleepByDateRange(ctx context.Context, start, end time.Time) ([]*health.ReconciledDataPoint, error)
}

type SleepExportOptions struct {
	Client  SleepClient
	Year    int
	EndDate time.Time
	OutDir  string
	Merge   bool
	GroupBy string
}

type SleepExportResult struct {
	PeriodFiles []PeriodFile
	Merged      *MergedFile
}

type PeriodFile struct {
	Path    string
	Start   time.Time
	End     time.Time
	Records int
}

type MergedFile struct {
	Path                         string
	FirstDate                    string
	LastDate                     string
	Records                      int
	RecordedDays                 int
	AverageMinutesPerRecordedDay int
}

func ExportSleep(ctx context.Context, opts SleepExportOptions) (SleepExportResult, error) {
	if err := os.MkdirAll(opts.OutDir, 0o755); err != nil {
		return SleepExportResult{}, err
	}

	result := SleepExportResult{}
	var periods [][]*health.ReconciledDataPoint

	ranges, err := periodRanges(opts.Year, opts.EndDate, opts.GroupBy)
	if err != nil {
		return SleepExportResult{}, err
	}
	for _, r := range ranges {
		response, err := opts.Client.SleepByDateRange(ctx, r.Start, r.End)
		if err != nil {
			return SleepExportResult{}, err
		}

		path := filepath.Join(opts.OutDir, "google-health-sleep-"+r.Label+".json")
		payload := sleepResponse{DataPoints: response}
		if err := writeJSON(path, payload); err != nil {
			return SleepExportResult{}, err
		}

		periods = append(periods, response)
		result.PeriodFiles = append(result.PeriodFiles, PeriodFile{
			Path:    path,
			Start:   r.Start,
			End:     r.End,
			Records: len(response),
		})
	}

	if opts.Merge {
		merged := mergeSleep(periods)
		path := filepath.Join(opts.OutDir, "google-health-sleep-"+time.Date(opts.Year, 1, 1, 0, 0, 0, 0, time.UTC).Format("2006")+".json")
		if err := writeJSON(path, merged); err != nil {
			return SleepExportResult{}, err
		}
		summary := summarize(path, merged)
		result.Merged = &summary
	}

	return result, nil
}

type dateRange struct {
	Start time.Time
	End   time.Time
	Label string
}

func periodRanges(year int, endDate time.Time, groupBy string) ([]dateRange, error) {
	switch groupBy {
	case "", "month":
		return monthRanges(year, endDate), nil
	case "week":
		return weekRanges(year, endDate), nil
	default:
		return nil, fmt.Errorf("unsupported group-by value %q; use month or week", groupBy)
	}
}

func monthRanges(year int, endDate time.Time) []dateRange {
	ranges := make([]dateRange, 0, 12)

	for month := time.January; month <= time.December; month++ {
		start := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
		if start.After(endDate) {
			break
		}

		end := start.AddDate(0, 1, -1)
		if end.After(endDate) {
			end = endDate
		}

		ranges = append(ranges, dateRange{
			Start: start,
			End:   end,
			Label: start.Format("2006-01"),
		})
	}

	return ranges
}

func weekRanges(year int, endDate time.Time) []dateRange {
	yearStart := time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)
	yearEnd := time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC)
	if endDate.Before(yearStart) {
		return nil
	}
	if endDate.Before(yearEnd) {
		yearEnd = endDate
	}

	ranges := make([]dateRange, 0, 53)
	for start := yearStart; !start.After(yearEnd); {
		daysUntilSunday := (7 - int(start.Weekday())) % 7
		end := start.AddDate(0, 0, daysUntilSunday)
		if end.After(yearEnd) {
			end = yearEnd
		}
		isoYear, isoWeek := start.ISOWeek()
		ranges = append(ranges, dateRange{
			Start: start,
			End:   end,
			Label: fmt.Sprintf("%04d-W%02d", isoYear, isoWeek),
		})
		start = end.AddDate(0, 0, 1)
	}
	return ranges
}

type sleepResponse struct {
	DataPoints []*health.ReconciledDataPoint `json:"dataPoints"`
}

func mergeSleep(monthly [][]*health.ReconciledDataPoint) sleepResponse {
	merged := sleepResponse{DataPoints: []*health.ReconciledDataPoint{}}
	for _, response := range monthly {
		merged.DataPoints = append(merged.DataPoints, response...)
	}
	return merged
}

func summarize(path string, response sleepResponse) MergedFile {
	summary := MergedFile{
		Path:    path,
		Records: len(response.DataPoints),
	}
	if len(response.DataPoints) == 0 {
		return summary
	}

	dates := make([]string, 0, len(response.DataPoints))
	minutesByDate := map[string]int{}
	totalMinutes := 0

	for _, record := range response.DataPoints {
		if record == nil || record.Sleep == nil {
			continue
		}
		date := sleepEndDate(record.Sleep)
		minutes := 0
		if record.Sleep.Summary != nil {
			minutes = int(record.Sleep.Summary.MinutesAsleep)
		}
		if date != "" {
			dates = append(dates, date)
			minutesByDate[date] += minutes
		}
		totalMinutes += minutes
	}

	if len(dates) == 0 {
		return summary
	}
	sort.Strings(dates)
	summary.FirstDate = dates[0]
	summary.LastDate = dates[len(dates)-1]
	summary.RecordedDays = len(minutesByDate)
	if summary.RecordedDays > 0 {
		summary.AverageMinutesPerRecordedDay = totalMinutes / summary.RecordedDays
	}

	return summary
}

func sleepEndDate(sleep *health.Sleep) string {
	if sleep.Interval == nil {
		return ""
	}
	if civil := sleep.Interval.CivilEndTime; civil != nil && civil.Date != nil {
		return fmt.Sprintf("%04d-%02d-%02d", civil.Date.Year, civil.Date.Month, civil.Date.Day)
	}
	if sleep.Interval.EndTime != "" {
		if parsed, err := time.Parse(time.RFC3339, sleep.Interval.EndTime); err == nil {
			if offset, err := time.ParseDuration(sleep.Interval.EndUtcOffset); err == nil {
				parsed = parsed.Add(offset)
			}
			return parsed.Format(time.DateOnly)
		}
	}
	return ""
}

func writeJSON(path string, value any) error {
	b, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	return os.WriteFile(path, b, 0o644)
}
