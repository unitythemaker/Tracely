-- Seed Data for Tracely

-- Services
INSERT INTO services (id, name) VALUES
    ('S1', 'Superonline'),
    ('S2', 'TV+'),
    ('S3', 'Paycell'),
    ('S4', 'BiP'),
    ('S5', 'Fizy'),
    ('S6', 'Lifebox'),
    ('S7', 'Dergilik'),
    ('S8', 'Platinum')
ON CONFLICT (id) DO NOTHING;

-- Quality Rules
INSERT INTO quality_rules (id, metric_type, threshold, operator, action, priority, severity, is_active) VALUES
    ('QR-01', 'LATENCY_MS', 150.0, '>', 'OPEN_INCIDENT', 1, 'HIGH', TRUE),
    ('QR-02', 'PACKET_LOSS', 1.5, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-03', 'BUFFER_RATIO', 6.0, '>', 'OPEN_INCIDENT', 2, 'MEDIUM', TRUE),
    ('QR-04', 'ERROR_RATE', 5.0, '>', 'OPEN_INCIDENT', 1, 'CRITICAL', TRUE),
    ('QR-05', 'LATENCY_MS', 300.0, '>', 'OPEN_INCIDENT', 1, 'CRITICAL', TRUE),
    ('QR-06', 'PACKET_LOSS', 5.0, '>', 'OPEN_INCIDENT', 1, 'HIGH', TRUE),
    ('QR-07', 'ERROR_RATE', 2.0, '>', 'OPEN_INCIDENT', 3, 'LOW', TRUE),
    ('QR-08', 'BUFFER_RATIO', 3.0, '>', 'OPEN_INCIDENT', 3, 'LOW', FALSE),
    ('QR-09', 'LATENCY_MS', 80.0, '>', 'OPEN_INCIDENT', 4, 'LOW', FALSE),
    ('QR-10', 'ERROR_RATE', 10.0, '>', 'OPEN_INCIDENT', 1, 'CRITICAL', TRUE)
ON CONFLICT (id) DO NOTHING;
