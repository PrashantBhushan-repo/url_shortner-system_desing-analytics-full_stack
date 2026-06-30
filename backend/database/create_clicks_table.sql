-- ============================================
-- Click Analytics Table
-- ============================================

DROP TABLE IF EXISTS clicks CASCADE;

CREATE TABLE clicks (

    id BIGSERIAL PRIMARY KEY,

    -- URL Reference
    url_id UUID NOT NULL,

    -- Visitor Information
    visitor_id UUID NOT NULL,

    ip_address VARCHAR(50),

    -- Time
    clicked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Browser Information
    browser VARCHAR(100),

    browser_version VARCHAR(50),

    -- Operating System
    operating_system VARCHAR(100),

    os_version VARCHAR(50),

    -- Device
    device_type VARCHAR(50),      -- Desktop / Mobile / Tablet

    device_name VARCHAR(100),

    -- Platform
    platform VARCHAR(100),

    -- User Agent
    user_agent TEXT,

    -- Geographic Information
    country VARCHAR(100),

    state VARCHAR(100),

    city VARCHAR(100),

    latitude DOUBLE PRECISION,

    longitude DOUBLE PRECISION,

    timezone VARCHAR(100),

    -- Traffic Source
    referrer TEXT,

    referer_host VARCHAR(255),

    utm_source VARCHAR(255),

    utm_medium VARCHAR(255),

    utm_campaign VARCHAR(255),

    -- QR Analytics
    is_qr_scan BOOLEAN DEFAULT FALSE,

    -- Visitor Type
    is_unique BOOLEAN DEFAULT TRUE,

    session_id UUID,

    -- Additional Metadata
    language VARCHAR(50),

    screen_resolution VARCHAR(50),

    network_type VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_click_url
        FOREIGN KEY (url_id)
        REFERENCES urls(id)
        ON DELETE CASCADE
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_clicks_url
ON clicks(url_id);

CREATE INDEX idx_clicks_date
ON clicks(clicked_at);

CREATE INDEX idx_clicks_country
ON clicks(country);

CREATE INDEX idx_clicks_browser
ON clicks(browser);

CREATE INDEX idx_clicks_os
ON clicks(operating_system);

CREATE INDEX idx_clicks_device
ON clicks(device_type);

CREATE INDEX idx_clicks_referrer
ON clicks(referer_host);

CREATE INDEX idx_clicks_visitor
ON clicks(visitor_id);

CREATE INDEX idx_clicks_session
ON clicks(session_id);

CREATE INDEX idx_clicks_qr
ON clicks(is_qr_scan);