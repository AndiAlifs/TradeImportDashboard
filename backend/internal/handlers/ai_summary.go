package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"time"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// SyncAISummary creates a pending summary record and triggers n8n asynchronously
func (h *Handler) SyncAISummary(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	actor := ActorFromContext(c)
	triggeredBy := fmt.Sprintf("%s (%s)", actor.User, actor.Role)

	// Check if N8N webhook URL is configured
	if h.config.N8NWebhookURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "N8N_WEBHOOK_URL not configured"})
		return
	}

	// Create pending record immediately
	aiSummary := models.AISummary{
		Status:      "Pending",
		SummaryText: "",
		TriggeredBy: triggeredBy,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := h.db.Create(&aiSummary).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create pending summary: %v", err)})
		return
	}

	// Trigger n8n asynchronously
	go h.triggerN8NWorkflow(aiSummary.ID)

	// Broadcast SSE event
	h.broadcaster.BroadcastAISummaryUpdate(aiSummary.ID, "Pending")

	// Return immediately with pending status
	c.JSON(http.StatusOK, aiSummary)
}

// triggerN8NWorkflow calls n8n webhook in background
func (h *Handler) triggerN8NWorkflow(summaryID uint64) {
	// Build URL with summaryId query parameter
	url := fmt.Sprintf("%s?summaryId=%d", h.config.N8NWebhookURL, summaryID)
	
	resp, err := http.Post(url, "application/json", bytes.NewBufferString("{}"))
	if err != nil {
		h.markSummaryFailed(summaryID, fmt.Sprintf("failed to call n8n: %v", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		h.markSummaryFailed(summaryID, fmt.Sprintf("n8n returned status %d", resp.StatusCode))
		return
	}

	// Note: The actual completion will be handled by the webhook callback
}

// WebhookCallback receives the completed summary from n8n
func (h *Handler) WebhookCallback(c *gin.Context) {
	var payload struct {
		SummaryID   uint64 `json:"summaryId"`
		Output      string `json:"output"`
		RawResponse string `json:"rawResponse"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Find the pending summary
	var summary models.AISummary
	if err := h.db.First(&summary, payload.SummaryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "summary not found"})
		return
	}

	// Extract clean summary
	summaryText := extractCleanSummary(payload.Output)
	if summaryText == "" {
		summaryText = payload.Output
	}

	// Update to completed
	summary.Status = "Completed"
	summary.SummaryText = summaryText
	summary.RawResponse = payload.RawResponse
	summary.UpdatedAt = time.Now().UTC()

	if err := h.db.Save(&summary).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update summary"})
		return
	}

	// Broadcast SSE event
	h.broadcaster.BroadcastAISummaryUpdate(summary.ID, "Completed")

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetLatestAISummary retrieves the most recent AI summary
func (h *Handler) GetLatestAISummary(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleExportOfficer, RoleBgOfficer); !ok {
		return
	}

	var summary models.AISummary
	if err := h.db.Order("created_at DESC").First(&summary).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"id":          0,
			"status":      "",
			"summaryText": "",
			"createdAt":   nil,
		})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetAllAISummaries retrieves all summaries (for history view)
func (h *Handler) GetAllAISummaries(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	var summaries []models.AISummary
	if err := h.db.Order("created_at DESC").Limit(50).Find(&summaries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch summaries"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summaries, "total": len(summaries)})
}

// markSummaryFailed updates summary to failed status
func (h *Handler) markSummaryFailed(summaryID uint64, errorMsg string) {
	var summary models.AISummary
	if err := h.db.First(&summary, summaryID).Error; err != nil {
		return
	}

	summary.Status = "Failed"
	summary.ErrorMsg = errorMsg
	summary.UpdatedAt = time.Now().UTC()
	h.db.Save(&summary)

	h.broadcaster.BroadcastAISummaryUpdate(summaryID, "Failed")
}

// extractCleanSummary extracts summary text starting from the marker
func extractCleanSummary(text string) string {
	marker := "# 📊 Ringkasan Eksekutif Trade Operations"
	idx := strings.Index(text, marker)
	if idx == -1 {
		return text
	}
	return strings.TrimSpace(text[idx:])
}
