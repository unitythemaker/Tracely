-- Sequences for human-readable IDs
CREATE SEQUENCE IF NOT EXISTS incident_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS notification_id_seq START 1;

-- Update sequences to current max values (if data exists)
DO $$
DECLARE
    max_inc INT;
    max_notif INT;
BEGIN
    -- Get max incident number (extract number from INC-XXX format)
    SELECT COALESCE(MAX(
        CASE
            WHEN id ~ '^INC-[0-9]+$' THEN CAST(SUBSTRING(id FROM 5) AS INT)
            ELSE 0
        END
    ), 0) INTO max_inc FROM incidents;

    -- Get max notification number
    SELECT COALESCE(MAX(
        CASE
            WHEN id ~ '^N-[0-9]+$' THEN CAST(SUBSTRING(id FROM 3) AS INT)
            ELSE 0
        END
    ), 0) INTO max_notif FROM notifications;

    -- Set sequences to continue from max
    IF max_inc > 0 THEN
        PERFORM setval('incident_id_seq', max_inc);
    END IF;

    IF max_notif > 0 THEN
        PERFORM setval('notification_id_seq', max_notif);
    END IF;
END $$;
