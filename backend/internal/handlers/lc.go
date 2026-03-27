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
	URN             string `json:"urn" binding:"required,max=32"`
	SenderEmail     string `json:"senderEmail" binding:"required,email"`
	Subject         string `json:"subject" binding:"required"`
	TransactionType string `json:"transactionType" binding:"required,oneof=Import Export"`
	AssignedTo      string `json:"assignedTo"`
	ReceivedAt      string `json:"receivedAt" binding:"required"`
}

type updateStatusRequest struct {
	NewStatus        string `json:"newStatus" binding:"required"`
	Notes            string `json:"notes"`
	UserID           string `json:"userId"`
	ExceptionReason  string `json:"exceptionReason"`
	ExceptionMinutes *int   `json:"exceptionMinutes"`
	ApprovedBy       string `json:"approvedBy"`
}

var errInvalidTransition = errors.New("invalid status transition")

func (h *Handler) CreateLC(c *gin.Context) {
	actor, ok := RequireRole(c, RoleSuperAdmin, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
	if !ok {
		return
	}

	var req createLCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !actor.CanAccessTransaction(req.TransactionType) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: transaction type is out of scope"})
		return
	}
	req.URN = strings.TrimSpace(req.URN)
	if req.URN == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "urn is required"})
		return
	}

	receivedAt, err := parseClientReceivedAt(req.ReceivedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().UTC()
	lc := models.LC{
		URN:                   req.URN,
		SenderEmail:           req.SenderEmail,
		Subject:               req.Subject,
		TransactionType:       req.TransactionType,
		AssignedTo:            req.AssignedTo,
		Status:                models.StatusReceived,
		ReceivedAt:            receivedAt,
		ExceptionTotalMinutes: 0,
	}
	broadcastEvent := LCUpdateEvent{
		FromStatus: "-",
		ToStatus:   models.StatusReceived,
		UpdatedBy:  fallbackUser(actor.User),
		OccurredAt: now,
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&lc).Error; err != nil {
			return err
		}

		event := models.Event{
			LCID:       lc.ID,
			URN:        lc.URN,
			UserID:     fallbackUser(actor.User),
			Action:     "Create Order",
			FromStatus: "-",
			ToStatus:   models.StatusReceived,
			Notes:      fmt.Sprintf("Manually created (%s)", req.TransactionType),
			OccurredAt: now,
		}
		broadcastEvent.LCID = lc.ID
		broadcastEvent.URN = lc.URN
		broadcastEvent.TransactionType = lc.TransactionType
		return tx.Create(&event).Error
	}); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") && strings.Contains(strings.ToLower(err.Error()), "urn") {
			c.JSON(http.StatusConflict, gin.H{"error": "urn already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.broadcaster.Publish(broadcastEvent)

	c.JSON(http.StatusCreated, lc)
}

func parseClientReceivedAt(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, errors.New("receivedAt is required")
	}

	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, value)
	}
	if err != nil {
		return time.Time{}, errors.New("receivedAt must be a valid RFC3339 timestamp")
	}

	return parsed.UTC(), nil
}

func (h *Handler) ListLCs(c *gin.Context) {
	actor, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
	if !ok {
		return
	}

	status := c.Query("status")
	transactionType := c.Query("transactionType")
	if transactionType != "" && !actor.CanAccessTransaction(transactionType) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: transaction type is out of scope"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := h.db.Model(&models.LC{})
	rangeQuery, err := parseDateRangeQuery(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if rangeQuery.From != nil {
		query = query.Where("received_at >= ?", *rangeQuery.From)
	}
	if rangeQuery.To != nil {
		query = query.Where("received_at <= ?", *rangeQuery.To)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if actor.Scope == ScopeImport {
		query = query.Where("transaction_type = ?", ScopeImport)
	} else if actor.Scope == ScopeExport {
		query = query.Where("transaction_type = ?", ScopeExport)
	} else if transactionType != "" {
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
	actor, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
	if !ok {
		return
	}

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
	if !actor.CanAccessTransaction(lc.TransactionType) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: transaction type is out of scope"})
		return
	}

	c.JSON(http.StatusOK, lc)
}

func (h *Handler) GetLCExceptions(c *gin.Context) {
	_, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
	if !ok {
		return
	}

	id, err := parseUintID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var exceptions []models.LCException
	if err := h.db.Where("lc_id = ?", id).Order("started_at desc").Find(&exceptions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exceptions)
}

func (h *Handler) UpdateLCStatus(c *gin.Context) {
	actor, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
	if !ok {
		return
	}

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
	if !CanUpdateStatus(actor, req.NewStatus) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: status update is not allowed for this role"})
		return
	}

	var updated models.LC
	var broadcastEvent LCUpdateEvent
	now := time.Now().UTC()
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var lc models.LC
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lc, "id = ?", id).Error; err != nil {
			return err
		}
		if !actor.CanAccessTransaction(lc.TransactionType) {
			return errors.New("forbidden: transaction type is out of scope")
		}
		if !isValidTransition(lc.Status, req.NewStatus) {
			return fmt.Errorf("%w: %s -> %s", errInvalidTransition, lc.Status, req.NewStatus)
		}

		fromStatus := lc.Status
		action, eventNotes := applyStatusTransition(&lc, req, now)

		if err := tx.Save(&lc).Error; err != nil {
			return err
		}

		if fromStatus != models.StatusException && req.NewStatus == models.StatusException {
			reason := strings.TrimSpace(req.ExceptionReason)
			exc := models.LCException{
				LCID:      lc.ID,
				Reason:    reason,
				StartedAt: now,
			}
			if err := tx.Create(&exc).Error; err != nil {
				return err
			}
		} else if fromStatus == models.StatusException && req.NewStatus != models.StatusException {
			var exc models.LCException
			if err := tx.Where("lc_id = ? AND resolved_at IS NULL", lc.ID).Order("started_at desc").First(&exc).Error; err == nil {
				deltaMin := 0
				if req.ExceptionMinutes != nil && *req.ExceptionMinutes >= 0 {
					deltaMin = *req.ExceptionMinutes
				} else {
					deltaMin = int(now.Sub(exc.StartedAt).Minutes())
				}
				resolvedTo := req.NewStatus
				resolvedBy := req.UserID

				exc.ResolvedAt = &now
				exc.ResolutionMinutes = &deltaMin
				exc.ResolvedToStatus = &resolvedTo
				exc.ResolvedBy = &resolvedBy
				if err := tx.Save(&exc).Error; err != nil {
					return err
				}
			}
		}

		event := models.Event{
			LCID:       lc.ID,
			URN:        lc.URN,
			UserID:     fallbackUser(actor.User),
			Action:     action,
			FromStatus: fromStatus,
			ToStatus:   lc.Status,
			Notes:      eventNotes,
			OccurredAt: now,
		}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		broadcastEvent = LCUpdateEvent{
			LCID:            lc.ID,
			URN:             lc.URN,
			TransactionType: lc.TransactionType,
			FromStatus:      fromStatus,
			ToStatus:        lc.Status,
			UpdatedBy:       fallbackUser(actor.User),
			OccurredAt:      now,
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
		if strings.HasPrefix(err.Error(), "forbidden:") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.broadcaster.Publish(broadcastEvent)

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
		if req.ApprovedBy != "" {
			lc.ApprovedBy = &req.ApprovedBy
		}
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

	if req.NewStatus != models.StatusException && wasException {
		deltaMin := 0
		if lc.ExceptionStartedAt != nil {
			deltaMin = int(now.Sub(*lc.ExceptionStartedAt).Minutes())
		}
		if req.ExceptionMinutes != nil && *req.ExceptionMinutes >= 0 {
			deltaMin = *req.ExceptionMinutes
		}
		if deltaMin < 0 {
			deltaMin = 0
		}
		lc.ExceptionTotalMinutes += deltaMin
		lc.PreviousStatus = nil
		action = "Resolve Exception"
	}

	return action, notes
}
