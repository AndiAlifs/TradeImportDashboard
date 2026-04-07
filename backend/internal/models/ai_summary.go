package models

import "time"

type AISummary struct {
	ID          uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	Status      string    `json:"status" gorm:"size:20;not null;default:'Pending';index"` // Pending, Completed, Failed
	SummaryText string    `json:"summaryText" gorm:"type:text"`
	RawResponse string    `json:"rawResponse" gorm:"type:text"`
	ErrorMsg    string    `json:"errorMsg" gorm:"type:text"`
	TriggeredBy string    `json:"triggeredBy" gorm:"size:100"`
	CreatedAt   time.Time `json:"createdAt" gorm:"not null;index"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (AISummary) TableName() string {
	return "ai_summaries"
}
