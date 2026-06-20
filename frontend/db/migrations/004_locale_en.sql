-- Migration 004 — Élargit le CHECK de preferred_locale pour autoriser 'en'
-- Run once on Vercel Postgres après les migrations 001-003.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f frontend/db/migrations/004_locale_en.sql
--
-- Idempotent: safe to run multiple times.

ALTER TABLE artist_subscriptions
    DROP CONSTRAINT IF EXISTS artist_subscriptions_preferred_locale_check;

ALTER TABLE artist_subscriptions
    ADD CONSTRAINT artist_subscriptions_preferred_locale_check
        CHECK (preferred_locale IN ('fr', 'de', 'en'));

COMMENT ON COLUMN artist_subscriptions.preferred_locale IS
    'Code de langue ISO 639-1 de l''artiste pour les emails transactionnels. Valeurs : fr, de, en. Mis à jour selon la locale courante.';
