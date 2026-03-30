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
	Name    string `json:"name" binding:"required"`
	Section string `json:"section" binding:"required"`
}

func (h *Handler) ListOfficers(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff, RoleBgOfficer, RoleBgStaff); !ok {
		return
	}

	var records []models.Officer
	if err := h.db.Where("is_active = ?", true).Order("section asc, name asc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) CreateOfficer(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleBgOfficer); !ok {
		return
	}

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
	section := strings.TrimSpace(req.Section)
	if section == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "section is required"})
		return
	}

	officer := models.Officer{Name: name, Section: section, IsActive: true}
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
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff); !ok {
		return
	}

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
	Section  *string `json:"section"`
	IsActive *bool   `json:"isActive"`
}

func (h *Handler) UpdateOfficer(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleBgOfficer); !ok {
		return
	}

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
	if req.Section != nil {
		section := strings.TrimSpace(*req.Section)
		if section == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "section cannot be empty"})
			return
		}
		officer.Section = section
	}
	if req.IsActive != nil {
		officer.IsActive = *req.IsActive
	}

	if err := h.db.Model(&officer).Select("Name", "Section", "IsActive").Updates(officer).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "officer name and section already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, officer)
}

func (h *Handler) DeleteOfficer(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

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
