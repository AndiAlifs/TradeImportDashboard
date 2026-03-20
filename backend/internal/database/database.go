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
	// Seed SLA config
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

	// Seed assignees and officers before LCs so they can be referenced
	if err := seedAssignees(db); err != nil {
		return err
	}
	if err := seedOfficers(db); err != nil {
		return err
	}
	if err := seedLCs(db); err != nil {
		return err
	}

	return nil
}

// ---------------------------------------------------------------------------
// Assignees
// ---------------------------------------------------------------------------

func seedAssignees(db *gorm.DB) error {
	names := []string{
		"Abima Setya R",
		"Bagus Taufiq E",
		"Nidya Yuliantika",
		"Chandra Mega M",
		"Deliyana Martha",
	}

	for _, name := range names {
		var exists int64
		if err := db.Model(&models.Assignee{}).Where("name = ?", name).Count(&exists).Error; err != nil {
			return fmt.Errorf("check assignee %q: %w", name, err)
		}
		if exists > 0 {
			continue
		}
		a := models.Assignee{Name: name, IsActive: true}
		if err := db.Create(&a).Error; err != nil {
			return fmt.Errorf("seed assignee %q: %w", name, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------

func seedOfficers(db *gorm.DB) error {
	names := []string{
		"Zahra Ashiela",
		"Rendra Rizky P",
		"Tony Herry C",
	}

	for _, name := range names {
		var exists int64
		if err := db.Model(&models.Officer{}).Where("name = ?", name).Count(&exists).Error; err != nil {
			return fmt.Errorf("check officer %q: %w", name, err)
		}
		if exists > 0 {
			continue
		}
		o := models.Officer{Name: name, IsActive: true}
		if err := db.Create(&o).Error; err != nil {
			return fmt.Errorf("seed officer %q: %w", name, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// L/C records  (30 total: 15 Import + 15 Export)
//
// Per transaction type (Import & Export), the distribution is:
//   - 2 Released within SLA  (total processing < 120 min)
//   - 3 Breached             (total processing > 120 min)
//   - 5 Checking Underlying
//   - 5 Drafting
// ---------------------------------------------------------------------------

func seedLCs(db *gorm.DB) error {
	const targetRecords = 30

	var count int64
	if err := db.Model(&models.LC{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count lcs: %w", err)
	}
	if count >= targetRecords {
		return nil
	}

	// Load assignees for random assignment
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

	// Load officers for approvedBy on released LCs
	officers := make([]string, 0)
	var officerRows []models.Officer
	if err := db.Where("is_active = ?", true).Find(&officerRows).Error; err != nil {
		return fmt.Errorf("load officers for seeding: %w", err)
	}
	for _, o := range officerRows {
		if o.Name != "" {
			officers = append(officers, o.Name)
		}
	}

	rng := rand.New(rand.NewSource(42))
	now := time.Now().UTC()

	// Build a plan of 30 LCs: 15 Import + 15 Export
	type lcPlan struct {
		txType string
		status string
	}

	buildBatch := func(txType string) []lcPlan {
		batch := make([]lcPlan, 0, 15)
		// 2 Released within SLA
		for i := 0; i < 2; i++ {
			batch = append(batch, lcPlan{txType, models.StatusReleased})
		}
		// 3 Breached
		for i := 0; i < 3; i++ {
			batch = append(batch, lcPlan{txType, models.StatusBreached})
		}
		// 5 Checking Underlying
		for i := 0; i < 5; i++ {
			batch = append(batch, lcPlan{txType, models.StatusCheckingUnderlying})
		}
		// 5 Drafting
		for i := 0; i < 5; i++ {
			batch = append(batch, lcPlan{txType, models.StatusDrafting})
		}
		return batch
	}

	plans := append(buildBatch("Import"), buildBatch("Export")...)

	baseSeq := int(count) + 1
	slaMaxMinutes := 120

	for i, plan := range plans {
		seq := baseSeq + i

		receivedAt := now.Add(-time.Duration(rng.Intn(7*24*60)+60) * time.Minute) // random within last 7 days
		draftingAt := receivedAt.Add(time.Duration(rng.Intn(15)+5) * time.Minute)
		checkingAt := draftingAt.Add(time.Duration(rng.Intn(20)+10) * time.Minute)

		lc := models.LC{
			URN:                   fmt.Sprintf("LC-%s-%03d", now.Format("20060102"), seq),
			SenderEmail:           fmt.Sprintf("trade%03d@bankco.test", seq),
			Subject:               fmt.Sprintf("%s L/C Application #%03d", plan.txType, seq),
			TransactionType:       plan.txType,
			AssignedTo:            "",
			Status:                models.StatusReceived,
			ReceivedAt:            receivedAt,
			ExceptionTotalMinutes: 0,
		}

		// Assign to a random assignee
		if len(assignees) > 0 {
			lc.AssignedTo = assignees[rng.Intn(len(assignees))]
		}

		switch plan.status {
		case models.StatusReleased:
			// Completed within SLA: total time from received to released < slaMaxMinutes
			totalMinutes := rng.Intn(slaMaxMinutes-30) + 20 // 20..89 minutes — well within SLA
			releasedAt := receivedAt.Add(time.Duration(totalMinutes) * time.Minute)
			draftMid := receivedAt.Add(time.Duration(totalMinutes/3) * time.Minute)
			checkMid := receivedAt.Add(time.Duration(2*totalMinutes/3) * time.Minute)
			lc.Status = models.StatusReleased
			lc.DraftingStartedAt = &draftMid
			lc.CheckingStartedAt = &checkMid
			lc.ReleasedAt = &releasedAt
			if len(officers) > 0 {
				officer := officers[rng.Intn(len(officers))]
				lc.ApprovedBy = &officer
			}

		case models.StatusBreached:
			// Breached: total processing time exceeds SLA max
			elapsedMinutes := slaMaxMinutes + rng.Intn(120) + 10 // 130..249 minutes
			draftStart := receivedAt.Add(time.Duration(rng.Intn(20)+5) * time.Minute)
			checkStart := draftStart.Add(time.Duration(elapsedMinutes-20) * time.Minute)
			lc.Status = models.StatusBreached
			lc.DraftingStartedAt = &draftStart
			lc.CheckingStartedAt = &checkStart

		case models.StatusCheckingUnderlying:
			lc.Status = models.StatusCheckingUnderlying
			lc.DraftingStartedAt = &draftingAt
			lc.CheckingStartedAt = &checkingAt

		case models.StatusDrafting:
			lc.Status = models.StatusDrafting
			lc.DraftingStartedAt = &draftingAt
		}

		if err := db.Create(&lc).Error; err != nil {
			return fmt.Errorf("seed lc %q: %w", lc.URN, err)
		}

		// Create corresponding event log
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
