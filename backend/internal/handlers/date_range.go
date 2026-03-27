package handlers

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type dateRange struct {
	From *time.Time
	To   *time.Time
}

func parseDateRangeQuery(c *gin.Context) (dateRange, error) {
	fromDateRaw := c.Query("fromDate")
	toDateRaw := c.Query("toDate")
	preset := c.DefaultQuery("preset", "")

	if fromDateRaw == "" && toDateRaw == "" && preset == "" {
		return dateRange{}, nil
	}

	if preset != "" {
		return parsePresetDateRange(preset)
	}

	from, err := parseClientDateTime(fromDateRaw, false)
	if err != nil {
		return dateRange{}, fmt.Errorf("invalid fromDate: %w", err)
	}
	to, err := parseClientDateTime(toDateRaw, true)
	if err != nil {
		return dateRange{}, fmt.Errorf("invalid toDate: %w", err)
	}
	if from.After(to) {
		return dateRange{}, fmt.Errorf("invalid date range: fromDate must be before toDate")
	}

	return dateRange{From: &from, To: &to}, nil
}

func parsePresetDateRange(preset string) (dateRange, error) {
	now := time.Now().In(time.Local)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	switch preset {
	case "today":
		end := startOfToday.Add(24*time.Hour - time.Nanosecond)
		return dateRange{From: &startOfToday, To: &end}, nil
	case "yesterday":
		from := startOfToday.Add(-24 * time.Hour)
		to := startOfToday.Add(-time.Nanosecond)
		return dateRange{From: &from, To: &to}, nil
	case "last7days":
		from := startOfToday.AddDate(0, 0, -6)
		end := startOfToday.Add(24*time.Hour - time.Nanosecond)
		return dateRange{From: &from, To: &end}, nil
	case "last14days":
		from := startOfToday.AddDate(0, 0, -13)
		end := startOfToday.Add(24*time.Hour - time.Nanosecond)
		return dateRange{From: &from, To: &end}, nil
	case "last1month":
		from := startOfToday.AddDate(0, -1, 1)
		end := startOfToday.Add(24*time.Hour - time.Nanosecond)
		return dateRange{From: &from, To: &end}, nil
	default:
		return dateRange{}, fmt.Errorf("unsupported preset: %s", preset)
	}
}

func parseClientDateTime(raw string, endOfDay bool) (time.Time, error) {
	if raw == "" {
		return time.Time{}, fmt.Errorf("value is required")
	}

	if ts, err := time.Parse(time.RFC3339, raw); err == nil {
		return ts, nil
	}

	if d, err := time.ParseInLocation("2006-01-02", raw, time.Local); err == nil {
		if endOfDay {
			return d.Add(24*time.Hour - time.Nanosecond), nil
		}
		return d, nil
	}

	return time.Time{}, fmt.Errorf("expected RFC3339 or YYYY-MM-DD")
}
