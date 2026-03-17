package router

import (
	"net/http"

	"trade-import-dashboard/backend/internal/config"
	"trade-import-dashboard/backend/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func New(cfg config.Config, h *handlers.Handler) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.AllowedOrigin},
		AllowMethods:     []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	api := r.Group("/api")
	{
		api.POST("/lc", h.CreateLC)
		api.GET("/lc", h.ListLCs)
		api.GET("/lc/:id", h.GetLCByID)
		api.PATCH("/lc/:id/status", h.UpdateLCStatus)

		api.GET("/events", h.ListEvents)

		api.GET("/sla", h.GetSLA)
		api.PATCH("/sla", h.UpdateSLA)
	}

	return r
}
