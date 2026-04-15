package handlers

import (
	"net/http"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type updateSLARequest struct {
	ImportSLAMaxMinutes int `json:"importSlaMaxMinutes" binding:"required,gte=1"`
	ExportSLAMaxMinutes int `json:"exportSlaMaxMinutes" binding:"required,gte=1"`
	BgSLAMaxMinutes     int `json:"bgSlaMaxMinutes" binding:"required,gte=1"`
	WarningThreshold1   int `json:"warningThreshold1"`
	WarningThreshold2   int `json:"warningThreshold2"`
}

func (h *Handler) GetSLA(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	var cfg models.SLAConfig
	if err := h.db.Order("id asc").First(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func (h *Handler) UpdateSLA(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	var req updateSLARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cfg models.SLAConfig
	if err := h.db.Order("id asc").First(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	cfg.ImportSLAMaxMinutes = req.ImportSLAMaxMinutes
	cfg.ExportSLAMaxMinutes = req.ExportSLAMaxMinutes
	cfg.BgSLAMaxMinutes = req.BgSLAMaxMinutes

	// Only update thresholds if provided (non-zero); fall back to DB defaults
	if req.WarningThreshold1 > 0 {
		cfg.WarningThreshold1 = req.WarningThreshold1
	}
	if req.WarningThreshold2 > 0 {
		cfg.WarningThreshold2 = req.WarningThreshold2
	}

	if err := h.db.Save(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cfg)
}
