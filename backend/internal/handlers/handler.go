package handlers

import (
	"trade-import-dashboard/backend/internal/config"

	"gorm.io/gorm"
)

type Handler struct {
	db          *gorm.DB
	broadcaster *LCUpdateBroadcaster
	config      config.Config
}

func New(db *gorm.DB, broadcaster *LCUpdateBroadcaster) *Handler {
	if broadcaster == nil {
		broadcaster = NewLCUpdateBroadcaster(16)
	}

	return &Handler{db: db, broadcaster: broadcaster}
}

func SetConfig(h *Handler, cfg config.Config) {
	h.config = cfg
}
