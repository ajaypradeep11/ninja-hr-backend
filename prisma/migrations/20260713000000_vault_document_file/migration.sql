-- Vault documents can now carry the actual file (manual uploads from the
-- Documents module / employee profile). Additive + nullable: existing
-- metadata-only rows stay valid.
ALTER TABLE "VaultDocument" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "VaultDocument" ADD COLUMN "size" INTEGER;
ALTER TABLE "VaultDocument" ADD COLUMN "data" BYTEA;
