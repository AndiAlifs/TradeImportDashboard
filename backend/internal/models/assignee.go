package models

import "time"

type Assignee struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:"size:100;not null;uniqueIndex"`
	IsActive  bool      `json:"isActive" gorm:"not null;default:true"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Assignee) TableName() string {
	return "assignees"
}
