package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createOfficerRequest struct {
	Name string `json:"name" binding:"required"`
}

func (h *Handler) ListOfficers(c *gin.Context) {
	var records []models.Officer
	if err := h.db.Where("is_active = ?", true).Order("name asc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) CreateOfficer(c *gin.Context) {
	var req createOfficerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	officer := models.Officer{Name: name, IsActive: true}
	if err := h.db.Create(&officer).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			c.JSON(http.StatusConflict, gin.H{"error": "officer already exists"})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "officer already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, officer)
}

func (h *Handler) GetOfficerByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid officer ID"})
		return
	}

	var officer models.Officer
	if err := h.db.First(&officer, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "officer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, officer)
}

type updateOfficerRequest struct {
	Name     *string `json:"name"`
	IsActive *bool   `json:"isActive"`
}

func (h *Handler) UpdateOfficer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid officer ID"})
		return
	}

	var req updateOfficerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var officer models.Officer
	if err := h.db.First(&officer, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "officer not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		officer.Name = name
	}
	if req.IsActive != nil {
		officer.IsActive = *req.IsActive
	}

	if err := h.db.Model(&officer).Select("Name", "IsActive").Updates(officer).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "officer name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, officer)
}

func (h *Handler) DeleteOfficer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid officer ID"})
		return
	}

	if err := h.db.Model(&models.Officer{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "officer deleted successfully"})
}
