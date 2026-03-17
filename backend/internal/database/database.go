package database

import (
	"fmt"

	"trade-import-dashboard/backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func Connect(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect mysql: %w", err)
	}
	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(&models.LC{}, &models.Event{}, &models.SLAConfig{}); err != nil {
		return fmt.Errorf("auto-migrate: %w", err)
	}
	return nil
}

func SeedDefaults(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.SLAConfig{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count sla config: %w", err)
	}
	if count == 0 {
		cfg := models.SLAConfig{SLAMinMinutes: 90, SLAMaxMinutes: 120}
		if err := db.Create(&cfg).Error; err != nil {
			return fmt.Errorf("seed sla config: %w", err)
		}
	}
	return nil
}
