package handlers

import "gorm.io/gorm"

type Handler struct {
	db          *gorm.DB
	broadcaster *LCUpdateBroadcaster
}

func New(db *gorm.DB, broadcaster *LCUpdateBroadcaster) *Handler {
	if broadcaster == nil {
		broadcaster = NewLCUpdateBroadcaster(16)
	}

	return &Handler{db: db, broadcaster: broadcaster}
}
