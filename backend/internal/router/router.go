package router

import (
	"net/http"
	"strings"

	"trade-import-dashboard/backend/internal/config"
	"trade-import-dashboard/backend/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func New(cfg config.Config, h *handlers.Handler) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			if cfg.AllowedOrigin == "*" || origin == "null" {
				return true
			}
			for _, allowed := range strings.Split(cfg.AllowedOrigin, ",") {
				if strings.TrimSpace(allowed) == origin {
					return true
				}
			}
			return false
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Mock-Role", "X-Mock-Scope", "X-Mock-User"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api := r.Group("/api")
	api.Use(func(c *gin.Context) {
		handlers.SetActorContext(c)
		c.Next()
	})
	{
		api.GET("/assignees", h.ListAssignees)
		api.POST("/assignees", h.CreateAssignee)
		api.GET("/assignees/:id", h.GetAssigneeByID)
		api.PUT("/assignees/:id", h.UpdateAssignee)
		api.DELETE("/assignees/:id", h.DeleteAssignee)

		api.GET("/officers", h.ListOfficers)
		api.POST("/officers", h.CreateOfficer)
		api.GET("/officers/:id", h.GetOfficerByID)
		api.PUT("/officers/:id", h.UpdateOfficer)
		api.DELETE("/officers/:id", h.DeleteOfficer)

		api.POST("/lc", h.CreateLC)
		api.GET("/lc", h.ListLCs)
		api.GET("/lc/:id", h.GetLCByID)
		api.PUT("/lc/:id", h.UpdateLC)
		api.DELETE("/lc/:id", h.DeleteLC)
		api.GET("/lc/:id/exceptions", h.GetLCExceptions)
		api.PATCH("/lc/:id/status", h.UpdateLCStatus)

		api.GET("/events", h.ListEvents)
		api.GET("/events/stream", h.StreamLCUpdates)

		api.GET("/sla", h.GetSLA)
		api.PATCH("/sla", h.UpdateSLA)
		api.POST("/reset", h.ResetData)
	}

	return r
}
