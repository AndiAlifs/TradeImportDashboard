package handlers

import (
	"errors"
	"net/http"
	"strings"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createAssigneeRequest struct {
	Name string `json:"name" binding:"required"`
}

func (h *Handler) ListAssignees(c *gin.Context) {
	var records []models.Assignee
	if err := h.db.Where("is_active = ?", true).Order("name asc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) CreateAssignee(c *gin.Context) {
	var req createAssigneeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	assignee := models.Assignee{Name: name, IsActive: true}
	if err := h.db.Create(&assignee).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			c.JSON(http.StatusConflict, gin.H{"error": "assignee already exists"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "assignee already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, assignee)
}
