package models

import "time"

type Event struct {
	ID         uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	LCID       uint64    `json:"lcId" gorm:"not null;index"`
	URN        string    `json:"urn" gorm:"size:32;not null;index"`
	UserID     string    `json:"user" gorm:"size:100"`
	Action     string    `json:"action" gorm:"size:100;not null"`
	FromStatus string    `json:"from" gorm:"size:64"`
	ToStatus   string    `json:"to" gorm:"size:64"`
	Notes      string    `json:"notes" gorm:"type:text"`
	OccurredAt time.Time `json:"timestamp" gorm:"not null;index"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (Event) TableName() string {
	return "events"
}
