package models

import "time"

const (
	StatusReceived           = "Received"
	StatusDrafting           = "Drafting"
	StatusCheckingUnderlying = "Checking Underlying"
	StatusReleased           = "Released"
	StatusBreached           = "Breached"
	StatusException          = "Exception"
)

var AllowedStatuses = map[string]bool{
	StatusReceived:           true,
	StatusDrafting:           true,
	StatusCheckingUnderlying: true,
	StatusReleased:           true,
	StatusBreached:           true,
	StatusException:          true,
}

type LC struct {
	ID                    uint64     `json:"id" gorm:"primaryKey;autoIncrement"`
	URN                   string     `json:"urn" gorm:"size:32;uniqueIndex;not null"`
	SenderEmail           string     `json:"senderEmail" gorm:"size:255;not null"`
	Subject               string     `json:"subject" gorm:"size:500"`
	TransactionType       string     `json:"transactionType" gorm:"size:16;not null"`
	Status                string     `json:"status" gorm:"size:64;not null;default:Received"`
	AssignedTo            string     `json:"assignedTo" gorm:"size:100"`
	ReceivedAt            time.Time  `json:"receivedAt" gorm:"not null"`
	DraftingStartedAt     *time.Time `json:"draftingStartedAt"`
	CheckingStartedAt     *time.Time `json:"checkingStartedAt"`
	ReleasedAt            *time.Time `json:"releasedAt"`
	ExceptionStartedAt    *time.Time `json:"exceptionStartedAt"`
	ExceptionTotalMinutes int        `json:"exceptionTotalMinutes" gorm:"not null;default:0"`
	ExceptionReason       *string    `json:"exceptionReason" gorm:"type:text"`
	PreviousStatus        *string    `json:"previousStatus" gorm:"size:64"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
}

func (LC) TableName() string {
	return "lcs"
}
