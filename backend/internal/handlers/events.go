package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListEvents(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	urn := c.Query("urn")

	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := h.db.Model(&models.Event{})
	rangeQuery, err := parseDateRangeQuery(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if rangeQuery.From != nil {
		query = query.Where("occurred_at >= ?", *rangeQuery.From)
	}
	if rangeQuery.To != nil {
		query = query.Where("occurred_at <= ?", *rangeQuery.To)
	}
	if urn != "" {
		query = query.Where("urn = ?", urn)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var events []models.Event
	if err := query.Order("occurred_at desc").Offset(offset).Limit(limit).Find(&events).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": events, "total": total})
}

func (h *Handler) StreamLCUpdates(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff); !ok {
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming is not supported"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	updates := h.broadcaster.Subscribe()
	defer h.broadcaster.Unsubscribe(updates)

	keepAliveTicker := time.NewTicker(25 * time.Second)
	defer keepAliveTicker.Stop()

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case evt := <-updates:
			payload, err := json.Marshal(evt)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(c.Writer, "event: lc_update\ndata: %s\n\n", payload)
			flusher.Flush()
		case <-keepAliveTicker.C:
			_, _ = fmt.Fprint(c.Writer, ": keep-alive\n\n")
			flusher.Flush()
		}
	}
}
