-- AlterTable
ALTER TABLE "Click" ADD COLUMN     "is_bot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Url" ADD COLUMN     "health_check_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_alive" BOOLEAN DEFAULT true,
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "UrlStatsHourly" (
    "id" BIGSERIAL NOT NULL,
    "url_id" BIGINT NOT NULL,
    "bucket_start" TIMESTAMPTZ(6) NOT NULL,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "unique_clicks" INTEGER NOT NULL DEFAULT 0,
    "bot_clicks" INTEGER NOT NULL DEFAULT 0,
    "top_country" TEXT,
    "top_referrer" TEXT,
    "top_device" TEXT,

    CONSTRAINT "UrlStatsHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlStatsDaily" (
    "id" BIGSERIAL NOT NULL,
    "url_id" BIGINT NOT NULL,
    "bucket_date" DATE NOT NULL,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "unique_clicks" INTEGER NOT NULL DEFAULT 0,
    "bot_clicks" INTEGER NOT NULL DEFAULT 0,
    "top_country" TEXT,
    "top_referrer" TEXT,
    "top_device" TEXT,

    CONSTRAINT "UrlStatsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlStatsHourly_url_id_idx" ON "UrlStatsHourly"("url_id");

-- CreateIndex
CREATE INDEX "UrlStatsHourly_bucket_start_idx" ON "UrlStatsHourly"("bucket_start");

-- CreateIndex
CREATE UNIQUE INDEX "UrlStatsHourly_url_id_bucket_start_key" ON "UrlStatsHourly"("url_id", "bucket_start");

-- CreateIndex
CREATE INDEX "UrlStatsDaily_url_id_idx" ON "UrlStatsDaily"("url_id");

-- CreateIndex
CREATE INDEX "UrlStatsDaily_bucket_date_idx" ON "UrlStatsDaily"("bucket_date");

-- CreateIndex
CREATE UNIQUE INDEX "UrlStatsDaily_url_id_bucket_date_key" ON "UrlStatsDaily"("url_id", "bucket_date");

-- AddForeignKey
ALTER TABLE "UrlStatsHourly" ADD CONSTRAINT "UrlStatsHourly_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlStatsDaily" ADD CONSTRAINT "UrlStatsDaily_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
