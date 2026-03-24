package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	RoleSuperAdmin    = "super_admin"
	RoleExecutive     = "executive"
	RoleImportStaff   = "import_staff"
	RoleImportOfficer = "import_officer"
	RoleExportStaff   = "export_staff"
	RoleExportOfficer = "export_officer"

	ScopeImport = "Import"
	ScopeExport = "Export"
	ScopeAll    = "All"

	CtxRoleKey  = "mock.role"
	CtxScopeKey = "mock.scope"
	CtxUserKey  = "mock.user"
)

type Actor struct {
	Role  string
	Scope string
	User  string
}

func NormalizeRole(raw string) string {
	r := strings.ToLower(strings.TrimSpace(raw))
	switch r {
	case RoleSuperAdmin, RoleExecutive, RoleImportStaff, RoleImportOfficer, RoleExportStaff, RoleExportOfficer:
		return r
	default:
		return RoleSuperAdmin
	}
}

func ScopeForRole(role string) string {
	switch NormalizeRole(role) {
	case RoleImportStaff, RoleImportOfficer:
		return ScopeImport
	case RoleExportStaff, RoleExportOfficer:
		return ScopeExport
	default:
		return ScopeAll
	}
}

func normalizeScope(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	switch s {
	case "import":
		return ScopeImport
	case "export":
		return ScopeExport
	default:
		return ScopeAll
	}
}

func ActorFromContext(c *gin.Context) Actor {
	role := NormalizeRole(c.GetString(CtxRoleKey))
	scope := c.GetString(CtxScopeKey)
	if scope == "" {
		scope = ScopeForRole(role)
	}
	user := strings.TrimSpace(c.GetString(CtxUserKey))
	if user == "" {
		user = role
	}
	return Actor{Role: role, Scope: scope, User: user}
}

func IsRoleAllowed(role string, allowed ...string) bool {
	normalized := NormalizeRole(role)
	for _, r := range allowed {
		if normalized == NormalizeRole(r) {
			return true
		}
	}
	return false
}

func RequireRole(c *gin.Context, allowed ...string) (Actor, bool) {
	actor := ActorFromContext(c)
	if !IsRoleAllowed(actor.Role, allowed...) {
		c.JSON(403, gin.H{"error": "forbidden: role is not allowed"})
		return actor, false
	}
	return actor, true
}

func (a Actor) CanAccessTransaction(transactionType string) bool {
	tx := strings.TrimSpace(strings.ToLower(transactionType))
	if tx == "" || a.Scope == ScopeAll {
		return true
	}
	if a.Scope == ScopeImport {
		return tx == "import"
	}
	if a.Scope == ScopeExport {
		return tx == "export"
	}
	return false
}

func CanUpdateStatus(actor Actor, newStatus string) bool {
	status := strings.TrimSpace(newStatus)
	if status == "Released" {
		return IsRoleAllowed(actor.Role, RoleSuperAdmin, RoleImportOfficer, RoleExportOfficer)
	}
	return IsRoleAllowed(actor.Role, RoleSuperAdmin, RoleImportOfficer, RoleImportStaff, RoleExportOfficer, RoleExportStaff)
}

func SetActorContext(c *gin.Context) {
	role := NormalizeRole(c.GetHeader("X-Mock-Role"))
	scope := normalizeScope(c.GetHeader("X-Mock-Scope"))
	if scope == ScopeAll {
		scope = ScopeForRole(role)
	}
	user := strings.TrimSpace(c.GetHeader("X-Mock-User"))
	if user == "" {
		user = role
	}

	c.Set(CtxRoleKey, role)
	c.Set(CtxScopeKey, scope)
	c.Set(CtxUserKey, user)
}
