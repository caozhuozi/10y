package exporter

import (
	"testing"
	"time"
)

func TestMonthRanges(t *testing.T) {
	end := time.Date(2026, time.February, 10, 0, 0, 0, 0, time.UTC)
	ranges := monthRanges(2026, end)
	if len(ranges) != 2 {
		t.Fatalf("got %d ranges, want 2", len(ranges))
	}
	assertRange(t, ranges[0], "2026-01-01", "2026-01-31", "2026-01")
	assertRange(t, ranges[1], "2026-02-01", "2026-02-10", "2026-02")
}

func TestWeekRanges(t *testing.T) {
	end := time.Date(2026, time.January, 11, 0, 0, 0, 0, time.UTC)
	ranges := weekRanges(2026, end)
	if len(ranges) != 2 {
		t.Fatalf("got %d ranges, want 2", len(ranges))
	}
	assertRange(t, ranges[0], "2026-01-01", "2026-01-04", "2026-W01")
	assertRange(t, ranges[1], "2026-01-05", "2026-01-11", "2026-W02")
}

func TestPeriodRangesRejectsUnknownGrouping(t *testing.T) {
	_, err := periodRanges(2026, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), "day")
	if err == nil {
		t.Fatal("expected an error for an unsupported grouping")
	}
}

func assertRange(t *testing.T, got dateRange, start, end, label string) {
	t.Helper()
	if got.Start.Format(time.DateOnly) != start ||
		got.End.Format(time.DateOnly) != end ||
		got.Label != label {
		t.Fatalf("got %s to %s (%s), want %s to %s (%s)",
			got.Start.Format(time.DateOnly),
			got.End.Format(time.DateOnly),
			got.Label,
			start,
			end,
			label,
		)
	}
}
