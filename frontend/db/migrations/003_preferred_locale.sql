-- Migration 003 — Langue préférée des artistes pour les emails transactionnels
-- Run once on Vercel Postgres after migration 002.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f frontend/db/migrations/003_preferred_locale.sql
--
-- Idempotent: safe to run multiple times.

ALTER TABLE artist_subscriptions
    ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(2) NOT NULL DEFAULT 'fr'
        CHECK (preferred_locale IN ('fr', 'de'));

COMMENT ON COLUMN artist_subscriptions.preferred_locale IS
    'Code de langue ISO 639-1 de l''artiste pour les emails transactionnels. Mis à jour lors de chaque action authentifiée selon la locale courante.';
