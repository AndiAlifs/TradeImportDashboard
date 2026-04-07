package handlers

import (
	"sync"
	"time"

	"trade-import-dashboard/backend/internal/models"
)

type LCUpdateEvent struct {
	LCID            uint64     `json:"lcId"`
	URN             string     `json:"urn"`
	TransactionType string     `json:"transactionType"`
	FromStatus      string     `json:"fromStatus"`
	ToStatus        string     `json:"toStatus"`
	UpdatedBy       string     `json:"updatedBy"`
	OccurredAt      time.Time  `json:"occurredAt"`
	LC              *models.LC `json:"lc,omitempty"`
}

type LCUpdateBroadcaster struct {
	mu          sync.Mutex
	subscribers map[chan LCUpdateEvent]struct{}
	bufferSize  int
}

func NewLCUpdateBroadcaster(bufferSize int) *LCUpdateBroadcaster {
	if bufferSize < 1 {
		bufferSize = 1
	}

	return &LCUpdateBroadcaster{
		subscribers: make(map[chan LCUpdateEvent]struct{}),
		bufferSize:  bufferSize,
	}
}

func (b *LCUpdateBroadcaster) Subscribe() chan LCUpdateEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan LCUpdateEvent, b.bufferSize)
	b.subscribers[ch] = struct{}{}
	return ch
}

func (b *LCUpdateBroadcaster) Unsubscribe(ch chan LCUpdateEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if _, exists := b.subscribers[ch]; !exists {
		return
	}

	delete(b.subscribers, ch)
	close(ch)
}

func (b *LCUpdateBroadcaster) Publish(evt LCUpdateEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	for ch := range b.subscribers {
		select {
		case ch <- evt:
		default:
			// Drop events for slow subscribers to avoid blocking writes.
		}
	}
}

// BroadcastAISummaryUpdate broadcasts AI summary status changes as LC update events
// This allows reusing the existing SSE infrastructure
func (b *LCUpdateBroadcaster) BroadcastAISummaryUpdate(summaryID uint64, status string) {
	// Create a special LC update event for AI summary changes
	evt := LCUpdateEvent{
		LCID:            summaryID,
		URN:             "AI_SUMMARY_UPDATE",
		TransactionType: status,
		FromStatus:      "",
		ToStatus:        status,
		UpdatedBy:       "system",
		OccurredAt:      time.Now().UTC(),
		LC:              nil,
	}
	b.Publish(evt)
}
