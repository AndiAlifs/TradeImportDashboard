package handlers

import (
	"net/http"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

type updateSLARequest struct {
	SLAMaxMinutes int `json:"slaMaxMinutes" binding:"required,gte=1"`
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

	cfg.SLAMaxMinutes = req.SLAMaxMinutes

	if err := h.db.Save(&cfg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cfg)
}
