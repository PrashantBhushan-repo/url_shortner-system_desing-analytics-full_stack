-- CreateTable
CREATE TABLE "Url" (
    "id" BIGSERIAL NOT NULL,
    "short_code" VARCHAR(10) NOT NULL,
    "long_url" TEXT NOT NULL,
    "user_id" BIGINT,
    "custom_alias" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Url_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" BIGSERIAL NOT NULL,
    "url_id" BIGINT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "browser" TEXT,
    "browser_version" TEXT,
    "operating_system" TEXT,
    "os_version" TEXT,
    "device_type" TEXT,
    "device_name" TEXT,
    "platform" TEXT,
    "user_agent" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "referrer" TEXT,
    "referer_host" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "is_qr_scan" BOOLEAN NOT NULL DEFAULT false,
    "is_unique" BOOLEAN NOT NULL DEFAULT true,
    "session_id" TEXT,
    "language" TEXT,
    "screen_resolution" TEXT,
    "network_type" TEXT,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Url_short_code_key" ON "Url"("short_code");

-- CreateIndex
CREATE INDEX "idx_urls_short_code" ON "Url"("short_code");

-- CreateIndex
CREATE INDEX "Click_url_id_idx" ON "Click"("url_id");

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
