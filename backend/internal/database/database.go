package database

import (
	"fmt"
	"math/rand"
	"time"

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
	if err := db.AutoMigrate(&models.LC{}, &models.Event{}, &models.SLAConfig{}, &models.Assignee{}, &models.Officer{}); err != nil {
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

	if err := seedLCs(db); err != nil {
		return err
	}

	return nil
}

func seedLCs(db *gorm.DB) error {
	const targetRecords = 25

	var count int64
	if err := db.Model(&models.LC{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count lcs: %w", err)
	}
	if count >= targetRecords {
		return nil
	}

	assignees := make([]string, 0)
	var assigneeRows []models.Assignee
	if err := db.Where("is_active = ?", true).Find(&assigneeRows).Error; err != nil {
		return fmt.Errorf("load assignees for seeding: %w", err)
	}
	for _, a := range assigneeRows {
		if a.Name != "" {
			assignees = append(assignees, a.Name)
		}
	}

	rng := rand.New(rand.NewSource(42))
	statusesForRandom := []string{
		models.StatusReceived,
		models.StatusDrafting,
		models.StatusCheckingUnderlying,
		models.StatusException,
	}

	recordsToCreate := targetRecords - int(count)
	baseSeq := int(count) + 1
	now := time.Now().UTC()

	for i := 0; i < recordsToCreate; i++ {
		seq := baseSeq + i
		transactionType := "Import"
		if seq%2 == 0 {
			transactionType = "Export"
		}

		receivedAt := now.Add(-time.Duration(rng.Intn(72*60)+60) * time.Minute)
		draftingAt := receivedAt.Add(time.Duration(rng.Intn(35)+10) * time.Minute)
		checkingAt := draftingAt.Add(time.Duration(rng.Intn(50)+15) * time.Minute)

		lc := models.LC{
			URN:                   fmt.Sprintf("LC-%s-%03d", now.Format("20060102"), seq),
			SenderEmail:           fmt.Sprintf("trade%03d@bankco.test", seq),
			Subject:               fmt.Sprintf("%s L/C Application #%03d", transactionType, seq),
			TransactionType:       transactionType,
			AssignedTo:            "",
			Status:                models.StatusReceived,
			ReceivedAt:            receivedAt,
			ExceptionTotalMinutes: 0,
		}

		if len(assignees) > 0 {
			lc.AssignedTo = assignees[rng.Intn(len(assignees))]
		}

		switch {
		case i < 3:
			releasedAt := checkingAt.Add(time.Duration(rng.Intn(30)+10) * time.Minute)
			lc.Status = models.StatusReleased
			lc.DraftingStartedAt = &draftingAt
			lc.CheckingStartedAt = &checkingAt
			lc.ReleasedAt = &releasedAt
		case i < 7:
			// Breached records stay in Breached state with elapsed time above SLA max.
			lc.Status = models.StatusBreached
			lc.DraftingStartedAt = &draftingAt
			lc.CheckingStartedAt = &checkingAt
		default:
			randomStatus := statusesForRandom[rng.Intn(len(statusesForRandom))]
			lc.Status = randomStatus
			if randomStatus == models.StatusDrafting || randomStatus == models.StatusCheckingUnderlying || randomStatus == models.StatusException {
				lc.DraftingStartedAt = &draftingAt
			}
			if randomStatus == models.StatusCheckingUnderlying || randomStatus == models.StatusException {
				lc.CheckingStartedAt = &checkingAt
			}
			if randomStatus == models.StatusException {
				reason := "Pending customer clarification"
				prev := models.StatusCheckingUnderlying
				lc.PreviousStatus = &prev
				lc.ExceptionReason = &reason
				lc.ExceptionStartedAt = &checkingAt
			}
		}

		if err := db.Create(&lc).Error; err != nil {
			return fmt.Errorf("seed lc %q: %w", lc.URN, err)
		}

		event := models.Event{
			LCID:       lc.ID,
			URN:        lc.URN,
			UserID:     "system",
			Action:     "Seed Data",
			FromStatus: "-",
			ToStatus:   lc.Status,
			Notes:      "Initial seeded data",
			OccurredAt: receivedAt,
		}
		if err := db.Create(&event).Error; err != nil {
			return fmt.Errorf("seed event for %q: %w", lc.URN, err)
		}
	}

	return nil
}
