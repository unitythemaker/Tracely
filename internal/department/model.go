package department

import (
	"time"

	"github.com/unitythemaker/tracely/internal/db"
)

type CreateDepartmentRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateDepartmentRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type DepartmentResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func ToResponse(d *db.Department) DepartmentResponse {
	return DepartmentResponse{
		ID:          d.ID,
		Name:        d.Name,
		Description: d.Description,
		CreatedAt:   d.CreatedAt,
		UpdatedAt:   d.UpdatedAt,
	}
}

func ToResponseList(departments []db.Department) []DepartmentResponse {
	result := make([]DepartmentResponse, len(departments))
	for i, d := range departments {
		result[i] = ToResponse(&d)
	}
	return result
}
