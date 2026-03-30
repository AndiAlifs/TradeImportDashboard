package models

import "time"

type SLAConfig struct {
	ID                  uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	ImportSLAMaxMinutes int       `json:"importSlaMaxMinutes" gorm:"not null;default:120"`
	ExportSLAMaxMinutes int       `json:"exportSlaMaxMinutes" gorm:"not null;default:120"`
	BgSLAMaxMinutes     int       `json:"bgSlaMaxMinutes" gorm:"not null;default:120"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

func (SLAConfig) TableName() string {
	return "sla_config"
}
