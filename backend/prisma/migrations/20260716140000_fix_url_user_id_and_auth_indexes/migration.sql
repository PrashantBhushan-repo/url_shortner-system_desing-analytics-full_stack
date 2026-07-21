-- Align Url.user_id with User.id (UUID) and add auth indexes

ALTER TABLE "Url" ALTER COLUMN "user_id" TYPE TEXT USING NULL;

ALTER TABLE "Url" ADD CONSTRAINT "Url_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Url_user_id_idx" ON "Url"("user_id");
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "LoginEvent_userId_idx" ON "LoginEvent"("userId");
