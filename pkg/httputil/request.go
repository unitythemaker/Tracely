package httputil

import (
	"encoding/json"
	"net/http"
)

func Decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
