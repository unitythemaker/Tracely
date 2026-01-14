package config

import (
	"os"
)

type Config struct {
	// Server
	Port  string
	Debug bool

	// Database
	DatabaseURL string

	// ElasticSearch
	ElasticSearchURL   string
	ElasticSearchIndex string

	// Workers
	WorkerPollInterval int // seconds
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		Debug:              getEnv("DEBUG", "false") == "true",
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tracely?sslmode=disable"),
		ElasticSearchURL:   getEnv("ELASTICSEARCH_URL", "http://localhost:9200"),
		ElasticSearchIndex: getEnv("ELASTICSEARCH_INDEX", "metrics"),
		WorkerPollInterval: 1,
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
