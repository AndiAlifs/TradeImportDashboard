package models

import "time"

type LCException struct {
	ID                uint64     `json:"id" gorm:"primaryKey;autoIncrement"`
	LCID              uint64     `json:"lcId" gorm:"index;not null"`
	Reason            string     `json:"reason" gorm:"type:text;not null"`
	StartedAt         time.Time  `json:"startedAt" gorm:"not null"`
	ResolvedAt        *time.Time `json:"resolvedAt"`
	ResolutionMinutes *int       `json:"resolutionMinutes"`
	ResolvedToStatus  *string    `json:"resolvedToStatus" gorm:"size:64"`
	ResolvedBy        *string    `json:"resolvedBy" gorm:"size:100"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

func (LCException) TableName() string {
	return "lc_exceptions"
}
