package handlers

import (
	"net/http"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type updateSLARequest struct {
	SLAMinMinutes int `json:"slaMinMinutes" binding:"required,gte=1"`
	SLAMaxMinutes int `json:"slaMaxMinutes" binding:"required,gte=1"`
}

func (h *Handler) GetSLA(c *gin.Context) {
	var cfg models.SLAConfig
	if err := h.db.Order("id asc").First(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *Handler) UpdateSLA(c *gin.Context) {
	var req updateSLARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SLAMinMinutes > req.SLAMaxMinutes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slaMinMinutes cannot be greater than slaMaxMinutes"})
		return
	}

	var cfg models.SLAConfig
	if err := h.db.Order("id asc").First(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cfg.SLAMinMinutes = req.SLAMinMinutes
	cfg.SLAMaxMinutes = req.SLAMaxMinutes

	if err := h.db.Save(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cfg)
}
