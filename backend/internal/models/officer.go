package models

import "time"

type Officer struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:"size:100;not null;uniqueIndex:idx_name_section_officer"`
	Section   string    `json:"section" gorm:"size:64;not null;default:'Import';uniqueIndex:idx_name_section_officer"`
	IsActive  bool      `json:"isActive" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Officer) TableName() string {
	return "officers"
}
