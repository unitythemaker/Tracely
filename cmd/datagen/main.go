package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	defaultAPIURL = "http://localhost:8080"
)

var (
	// Service IDs
	services = []string{"S001", "S002", "S003"}

	// Metric types with their typical value ranges
	metricConfigs = []struct {
		Type    string
		MinVal  float64
		MaxVal  float64
		BaseVal float64
	}{
		{Type: "LATENCY_MS", MinVal: 10, MaxVal: 500, BaseVal: 50},
		{Type: "PACKET_LOSS", MinVal: 0, MaxVal: 15, BaseVal: 1},
		{Type: "ERROR_RATE", MinVal: 0, MaxVal: 20, BaseVal: 2},
		{Type: "BUFFER_RATIO", MinVal: 0, MaxVal: 100, BaseVal: 30},
	}
)

type MetricPayload struct {
	ServiceID  string  `json:"service_id"`
	MetricType string  `json:"metric_type"`
	Value      float64 `json:"value"`
}

func main() {
	apiURL := os.Getenv("API_URL")
	if apiURL == "" {
		apiURL = defaultAPIURL
	}

	log.Printf("Starting data generator...")
	log.Printf("API URL: %s", apiURL)
	log.Printf("Services: %v", services)
	log.Printf("Generating random metrics every 0.5-3 seconds...")
	log.Println("Press Ctrl+C to stop")

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Run generator
	go runGenerator(apiURL)

	<-sigChan
	log.Println("Shutting down...")
}

func runGenerator(apiURL string) {
	for {
		// Random delay between 500ms and 3000ms
		delay := time.Duration(500+rand.Intn(2500)) * time.Millisecond
		time.Sleep(delay)

		// Pick random service and metric type
		serviceID := services[rand.Intn(len(services))]
		metricConfig := metricConfigs[rand.Intn(len(metricConfigs))]

		// Generate value with some randomness around base value
		// Occasionally spike high to trigger incidents
		var value float64
		if rand.Float64() < 0.15 { // 15% chance of a spike
			// Spike value (could trigger an incident)
			value = metricConfig.BaseVal * (2 + rand.Float64()*3)
		} else {
			// Normal fluctuation around base value
			fluctuation := (rand.Float64() - 0.5) * metricConfig.BaseVal
			value = metricConfig.BaseVal + fluctuation
		}

		// Clamp to valid range
		if value < metricConfig.MinVal {
			value = metricConfig.MinVal
		}
		if value > metricConfig.MaxVal {
			value = metricConfig.MaxVal
		}

		// Send metric
		payload := MetricPayload{
			ServiceID:  serviceID,
			MetricType: metricConfig.Type,
			Value:      value,
		}

		err := sendMetric(apiURL, payload)
		if err != nil {
			log.Printf("Error sending metric: %v", err)
		} else {
			log.Printf("Sent: %s/%s = %.2f", serviceID, metricConfig.Type, value)
		}
	}
}

func sendMetric(apiURL string, payload MetricPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	resp, err := http.Post(apiURL+"/api/metrics", "application/json", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
