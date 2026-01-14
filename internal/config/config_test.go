package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear any environment variables that might affect the test
	envVars := []string{
		"PORT",
		"DEBUG",
		"CORS_ALLOWED_ORIGINS",
		"DATABASE_URL",
		"ELASTICSEARCH_URL",
		"ELASTICSEARCH_INDEX",
	}

	for _, env := range envVars {
		os.Unsetenv(env)
	}

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Expected Port=8080, got %s", cfg.Port)
	}

	if cfg.Debug != false {
		t.Errorf("Expected Debug=false, got %v", cfg.Debug)
	}

	if cfg.CORSAllowedOrigins != "http://localhost:3000" {
		t.Errorf("Expected CORSAllowedOrigins=http://localhost:3000, got %s", cfg.CORSAllowedOrigins)
	}

	if cfg.DatabaseURL != "postgres://postgres:postgres@localhost:5432/tracely?sslmode=disable" {
		t.Errorf("Expected default DatabaseURL, got %s", cfg.DatabaseURL)
	}

	if cfg.ElasticSearchURL != "http://localhost:9200" {
		t.Errorf("Expected ElasticSearchURL=http://localhost:9200, got %s", cfg.ElasticSearchURL)
	}

	if cfg.ElasticSearchIndex != "metrics" {
		t.Errorf("Expected ElasticSearchIndex=metrics, got %s", cfg.ElasticSearchIndex)
	}

	if cfg.WorkerPollInterval != 1 {
		t.Errorf("Expected WorkerPollInterval=1, got %d", cfg.WorkerPollInterval)
	}
}

func TestLoad_WithEnvVars(t *testing.T) {
	// Set environment variables
	os.Setenv("PORT", "9090")
	os.Setenv("DEBUG", "true")
	os.Setenv("CORS_ALLOWED_ORIGINS", "*")
	os.Setenv("DATABASE_URL", "postgres://test:test@db:5432/testdb")
	os.Setenv("ELASTICSEARCH_URL", "http://es:9200")
	os.Setenv("ELASTICSEARCH_INDEX", "test_metrics")

	// Cleanup after test
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("DEBUG")
		os.Unsetenv("CORS_ALLOWED_ORIGINS")
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("ELASTICSEARCH_URL")
		os.Unsetenv("ELASTICSEARCH_INDEX")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("Expected Port=9090, got %s", cfg.Port)
	}

	if cfg.Debug != true {
		t.Errorf("Expected Debug=true, got %v", cfg.Debug)
	}

	if cfg.CORSAllowedOrigins != "*" {
		t.Errorf("Expected CORSAllowedOrigins=*, got %s", cfg.CORSAllowedOrigins)
	}

	if cfg.DatabaseURL != "postgres://test:test@db:5432/testdb" {
		t.Errorf("Expected custom DatabaseURL, got %s", cfg.DatabaseURL)
	}

	if cfg.ElasticSearchURL != "http://es:9200" {
		t.Errorf("Expected ElasticSearchURL=http://es:9200, got %s", cfg.ElasticSearchURL)
	}

	if cfg.ElasticSearchIndex != "test_metrics" {
		t.Errorf("Expected ElasticSearchIndex=test_metrics, got %s", cfg.ElasticSearchIndex)
	}
}

func TestLoad_DebugFalse(t *testing.T) {
	os.Setenv("DEBUG", "false")
	defer os.Unsetenv("DEBUG")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.Debug != false {
		t.Errorf("Expected Debug=false, got %v", cfg.Debug)
	}
}

func TestLoad_DebugOtherValues(t *testing.T) {
	tests := []struct {
		value    string
		expected bool
	}{
		{"true", true},
		{"false", false},
		{"TRUE", false},  // Only "true" (lowercase) sets Debug to true
		{"1", false},     // "1" is not "true"
		{"yes", false},   // "yes" is not "true"
		{"", false},      // Empty string
	}

	for _, tt := range tests {
		t.Run(tt.value, func(t *testing.T) {
			if tt.value == "" {
				os.Unsetenv("DEBUG")
			} else {
				os.Setenv("DEBUG", tt.value)
			}
			defer os.Unsetenv("DEBUG")

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() returned error: %v", err)
			}

			if cfg.Debug != tt.expected {
				t.Errorf("Expected Debug=%v for value %q, got %v", tt.expected, tt.value, cfg.Debug)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name         string
		envKey       string
		envValue     string
		defaultValue string
		expected     string
		setEnv       bool
	}{
		{
			name:         "environment variable set",
			envKey:       "TEST_VAR",
			envValue:     "custom_value",
			defaultValue: "default",
			expected:     "custom_value",
			setEnv:       true,
		},
		{
			name:         "environment variable not set",
			envKey:       "TEST_VAR_UNSET",
			defaultValue: "default_value",
			expected:     "default_value",
			setEnv:       false,
		},
		{
			name:         "empty environment variable",
			envKey:       "TEST_VAR_EMPTY",
			envValue:     "",
			defaultValue: "default",
			expected:     "default", // Empty string should use default
			setEnv:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setEnv {
				os.Setenv(tt.envKey, tt.envValue)
				defer os.Unsetenv(tt.envKey)
			} else {
				os.Unsetenv(tt.envKey)
			}

			result := getEnv(tt.envKey, tt.defaultValue)
			if result != tt.expected {
				t.Errorf("Expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestConfigStruct(t *testing.T) {
	cfg := &Config{
		Port:               "8080",
		Debug:              true,
		CORSAllowedOrigins: "*",
		DatabaseURL:        "postgres://localhost/test",
		ElasticSearchURL:   "http://localhost:9200",
		ElasticSearchIndex: "metrics",
		WorkerPollInterval: 5,
	}

	// Verify struct fields
	if cfg.Port != "8080" {
		t.Errorf("Port mismatch")
	}
	if !cfg.Debug {
		t.Errorf("Debug mismatch")
	}
	if cfg.CORSAllowedOrigins != "*" {
		t.Errorf("CORSAllowedOrigins mismatch")
	}
	if cfg.WorkerPollInterval != 5 {
		t.Errorf("WorkerPollInterval mismatch")
	}
}
