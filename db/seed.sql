-- Seed Data for Tracely

-- Services
INSERT INTO services (id, name) VALUES
    ('S1', 'Superonline'),
    ('S2', 'TV+'),
    ('S3', 'Paycell')
ON CONFLICT (id) DO NOTHING;

-- Quality Rules (v1: sadece OPEN_INCIDENT aktif)
INSERT INTO quality_rules (id, metric_type, threshold, operator, action, priority, severity, is_active) VALUES
    ('QR-01', 'LATENCY_MS', 150.0, '>', 'OPEN_INCIDENT', 1, 'HIGH', TRUE),
    ('QR-02', 'PACKET_LOSS', 1.5, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-03', 'BUFFER_RATIO', 6.0, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-04', 'ERROR_RATE', 5.0, '>', 'OPEN_INCIDENT', 1, 'CRITICAL', TRUE)
ON CONFLICT (id) DO NOTHING;
