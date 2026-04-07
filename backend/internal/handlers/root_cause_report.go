package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"trade-import-dashboard/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// IngestRootCauseReport receives a report pushed from n8n scheduled workflow
func (h *Handler) IngestRootCauseReport(c *gin.Context) {
	var payload struct {
		Report      string `json:"report"`
		GeneratedAt string `json:"generatedAt"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil || strings.TrimSpace(payload.Report) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing report field"})
		return
	}

	periodStart, periodEnd := extractPeriodFromReport(payload.Report)

	record := models.RootCauseReport{
		ReportMarkdown: payload.Report,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		TriggeredBy:    "n8n-scheduled",
		CreatedAt:      time.Now().UTC(),
	}

	if err := h.db.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store report"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// SyncRootCauseReport triggers n8n root cause webhook (pull model)
func (h *Handler) SyncRootCauseReport(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive); !ok {
		return
	}

	if h.config.N8NRootCauseWebhookURL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "N8N_ROOT_CAUSE_WEBHOOK_URL not configured"})
		return
	}

	actor := ActorFromContext(c)
	triggeredBy := fmt.Sprintf("%s (%s)", actor.User, actor.Role)

	resp, err := http.Post(h.config.N8NRootCauseWebhookURL, "application/json", bytes.NewBufferString("{}"))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("failed to call n8n: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("n8n returned status %d", resp.StatusCode)})
		return
	}

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read n8n response"})
		return
	}

	reportText := buf.String()
	periodStart, periodEnd := extractPeriodFromReport(reportText)

	record := models.RootCauseReport{
		ReportMarkdown: reportText,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		TriggeredBy:    triggeredBy,
		CreatedAt:      time.Now().UTC(),
	}

	if err := h.db.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store report"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// GetLatestRootCauseReport returns the most recent root cause report
func (h *Handler) GetLatestRootCauseReport(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleExportOfficer, RoleBgOfficer); !ok {
		return
	}

	var report models.RootCauseReport
	if err := h.db.Order("created_at DESC").First(&report).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"id":             0,
			"reportMarkdown": "",
			"periodStart":    "",
			"periodEnd":      "",
			"createdAt":      nil,
		})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetRootCauseReports returns paginated list of root cause reports
func (h *Handler) GetRootCauseReports(c *gin.Context) {
	if _, ok := RequireRole(c, RoleSuperAdmin, RoleExecutive, RoleImportOfficer, RoleExportOfficer, RoleBgOfficer); !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var reports []models.RootCauseReport
	var total int64

	h.db.Model(&models.RootCauseReport{}).Count(&total)
	if err := h.db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch reports"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": reports, "total": total})
}

// extractPeriodFromReport parses "**Period:** YYYY-MM-DD — YYYY-MM-DD" from report markdown
func extractPeriodFromReport(report string) (string, string) {
	marker := "**Period:**"
	idx := strings.Index(report, marker)
	if idx == -1 {
		return "", ""
	}

	after := report[idx+len(marker):]
	newline := strings.Index(after, "\n")
	if newline == -1 {
		newline = len(after)
	}

	line := strings.TrimSpace(after[:newline])
	// Expected: "2026-03-29 — 2026-04-05"
	parts := strings.SplitN(line, "—", 2)
	if len(parts) != 2 {
		parts = strings.SplitN(line, "-", 2)
		if len(parts) != 2 {
			return "", ""
		}
	}

	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
}
