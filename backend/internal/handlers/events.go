package handlers

import (
	"net/http"
	"strconv"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListEvents(c *gin.Context) {
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
