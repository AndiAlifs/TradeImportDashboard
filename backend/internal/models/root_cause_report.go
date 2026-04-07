package models

import "time"

type RootCauseReport struct {
	ID             uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	ReportMarkdown string    `json:"reportMarkdown" gorm:"type:text;not null"`
	PeriodStart    string    `json:"periodStart" gorm:"size:20"`
	PeriodEnd      string    `json:"periodEnd" gorm:"size:20"`
	TriggeredBy    string    `json:"triggeredBy" gorm:"size:100"`
	CreatedAt      time.Time `json:"createdAt" gorm:"not null;index"`
}

func (RootCauseReport) TableName() string {
	return "root_cause_reports"
}
