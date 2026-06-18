-- Migration 002 — Traçabilité de l'acceptation de la politique de confidentialité (RGPD)
-- Run once on Vercel Postgres after migration 001.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f frontend/db/migrations/002_legal_acceptance.sql
--
-- Idempotent: safe to run multiple times.

ALTER TABLE artist_subscriptions
    ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN artist_subscriptions.privacy_accepted_at IS
    'Horodatage de la première acceptation de la politique de confidentialité par l''artiste. NULL = jamais accepté. Pour conformité RGPD et opposabilité.';
