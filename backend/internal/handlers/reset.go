package handlers

import (
	"net/http"

	"trade-import-dashboard/backend/internal/database"
	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Handler) ResetData(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		allowAll := tx.Session(&gorm.Session{AllowGlobalUpdate: true})

		if err := allowAll.Delete(&models.Event{}).Error; err != nil {
			return err
		}
		if err := allowAll.Delete(&models.LC{}).Error; err != nil {
			return err
		}
		if err := allowAll.Delete(&models.Assignee{}).Error; err != nil {
			return err
		}
		if err := allowAll.Delete(&models.Officer{}).Error; err != nil {
			return err
		}
		if err := allowAll.Delete(&models.SLAConfig{}).Error; err != nil {
			return err
		}

		return database.SeedDefaults(tx)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "data reset complete"})
}
