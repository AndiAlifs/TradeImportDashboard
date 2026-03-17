package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type createLCRequest struct {
	SenderEmail     string `json:"senderEmail" binding:"required,email"`
	Subject         string `json:"subject" binding:"required"`
	TransactionType string `json:"transactionType" binding:"required,oneof=Import Export"`
	AssignedTo      string `json:"assignedTo"`
}

type updateStatusRequest struct {
	NewStatus        string `json:"newStatus" binding:"required"`
	Notes            string `json:"notes"`
	UserID           string `json:"userId"`
	ExceptionReason  string `json:"exceptionReason"`
	ExceptionMinutes *int   `json:"exceptionMinutes"`
}

var errInvalidTransition = errors.New("invalid status transition")

func (h *Handler) CreateLC(c *gin.Context) {
	var req createLCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().UTC()
	lc := models.LC{
		SenderEmail:           req.SenderEmail,
		Subject:               req.Subject,
		TransactionType:       req.TransactionType,
		AssignedTo:            req.AssignedTo,
		Status:                models.StatusReceived,
		ReceivedAt:            now,
		ExceptionTotalMinutes: 0,
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		urn, err := nextURN(tx, now)
		if err != nil {
			return err
		}
		lc.URN = urn

		if err := tx.Create(&lc).Error; err != nil {
			return err
		}

		event := models.Event{
			LCID:       lc.ID,
			URN:        lc.URN,
			UserID:     fallbackUser(req.AssignedTo),
			Action:     "Create Order",
			FromStatus: "-",
			ToStatus:   models.StatusReceived,
			Notes:      fmt.Sprintf("Manually created (%s)", req.TransactionType),
			OccurredAt: now,
		}
		return tx.Create(&event).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, lc)
}

func (h *Handler) ListLCs(c *gin.Context) {
	status := c.Query("status")
	transactionType := c.Query("transactionType")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := h.db.Model(&models.LC{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if transactionType != "" {
		query = query.Where("transaction_type = ?", transactionType)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var records []models.LC
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records, "total": total})
}

func (h *Handler) GetLCByID(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var lc models.LC
	if err := h.db.First(&lc, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, lc)
}

func (h *Handler) UpdateLCStatus(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.NewStatus = strings.TrimSpace(req.NewStatus)
	if !models.AllowedStatuses[req.NewStatus] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported newStatus"})
		return
	}

	var updated models.LC
	now := time.Now().UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var lc models.LC
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lc, "id = ?", id).Error; err != nil {
			return err
		}
		if !isValidTransition(lc.Status, req.NewStatus) {
			return fmt.Errorf("%w: %s -> %s", errInvalidTransition, lc.Status, req.NewStatus)
		}

		fromStatus := lc.Status
		action, eventNotes := applyStatusTransition(&lc, req, now)

		if err := tx.Save(&lc).Error; err != nil {
			return err
		}

		event := models.Event{
			LCID:       lc.ID,
			URN:        lc.URN,
			UserID:     fallbackUser(req.UserID),
			Action:     action,
			FromStatus: fromStatus,
			ToStatus:   lc.Status,
			Notes:      eventNotes,
			OccurredAt: now,
		}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		updated = lc
		return nil
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
			return
		}
		if errors.Is(err, errInvalidTransition) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func isValidTransition(fromStatus, toStatus string) bool {
	if fromStatus == toStatus {
		return true
	}
	allowed := map[string]map[string]bool{
		models.StatusReceived: {
			models.StatusDrafting:  true,
			models.StatusException: true,
		},
		models.StatusDrafting: {
			models.StatusCheckingUnderlying: true,
			models.StatusException:          true,
		},
		models.StatusCheckingUnderlying: {
			models.StatusReleased:  true,
			models.StatusBreached:  true,
			models.StatusException: true,
		},
		models.StatusBreached: {
			models.StatusCheckingUnderlying: true,
			models.StatusReleased:           true,
			models.StatusException:          true,
		},
		models.StatusException: {
			models.StatusReceived:           true,
			models.StatusDrafting:           true,
			models.StatusCheckingUnderlying: true,
			models.StatusBreached:           true,
			models.StatusReleased:           true,
		},
	}
	return allowed[fromStatus][toStatus]
}

func nextURN(tx *gorm.DB, now time.Time) (string, error) {
	dateStr := now.Format("20060102")
	prefix := "LC-" + dateStr + "-"

	var count int64
	if err := tx.Model(&models.LC{}).Where("urn LIKE ?", prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}

	seq := count + 1
	return fmt.Sprintf("LC-%s-%03d", dateStr, seq), nil
}

func parseUintID(raw string) (uint64, error) {
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid id")
	}
	return id, nil
}

func fallbackUser(user string) string {
	u := strings.TrimSpace(user)
	if u == "" {
		return "system"
	}
	return u
}

func applyStatusTransition(lc *models.LC, req updateStatusRequest, now time.Time) (string, string) {
	action := req.NewStatus
	notes := strings.TrimSpace(req.Notes)
	wasException := lc.Status == models.StatusException

	switch req.NewStatus {
	case models.StatusDrafting:
		lc.Status = models.StatusDrafting
		if lc.DraftingStartedAt == nil {
			lc.DraftingStartedAt = &now
		}
		if notes == "" {
			notes = "Started drafting"
		}
		action = "Start Drafting"
	case models.StatusCheckingUnderlying:
		lc.Status = models.StatusCheckingUnderlying
		if lc.CheckingStartedAt == nil {
			lc.CheckingStartedAt = &now
		}
		if notes == "" {
			notes = "Started checking underlying"
		}
		action = "Start Checking Underlying"
	case models.StatusReleased:
		lc.Status = models.StatusReleased
		lc.ReleasedAt = &now
		if notes == "" {
			notes = "Released"
		}
		action = "Release"
	case models.StatusException:
		prev := lc.Status
		lc.PreviousStatus = &prev
		lc.Status = models.StatusException
		lc.ExceptionStartedAt = &now
		if strings.TrimSpace(req.ExceptionReason) != "" {
			r := strings.TrimSpace(req.ExceptionReason)
			lc.ExceptionReason = &r
		}
		if notes == "" {
			notes = "Marked exception"
		}
		action = "Mark Exception"
	default:
		lc.Status = req.NewStatus
		if notes == "" {
			notes = "Status updated"
		}
	}

	if req.NewStatus != models.StatusException && lc.ExceptionStartedAt != nil {
		deltaMin := int(now.Sub(*lc.ExceptionStartedAt).Minutes())
		if req.ExceptionMinutes != nil && *req.ExceptionMinutes >= 0 {
			deltaMin = *req.ExceptionMinutes
		}
		if deltaMin < 0 {
			deltaMin = 0
		}
		lc.ExceptionTotalMinutes += deltaMin
		lc.ExceptionStartedAt = nil
		lc.ExceptionReason = nil
		lc.PreviousStatus = nil
		if wasException {
			action = "Resolve Exception"
		}
	}

	return action, notes
}
