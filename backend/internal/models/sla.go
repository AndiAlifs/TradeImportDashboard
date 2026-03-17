package models

import "time"

type SLAConfig struct {
	ID            uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	SLAMinMinutes int       `json:"slaMinMinutes" gorm:"not null;default:90"`
	SLAMaxMinutes int       `json:"slaMaxMinutes" gorm:"not null;default:120"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (SLAConfig) TableName() string {
	return "sla_config"
}
