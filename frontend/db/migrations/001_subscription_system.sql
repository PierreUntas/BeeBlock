-- Migration 001 — Subscription system (free / Atelier 14.90€)
-- Run once on Vercel Postgres after provisioning the database.
--
-- Apply with:
--   psql "$POSTGRES_URL_NON_POOLING" -f frontend/db/migrations/001_subscription_system.sql
--
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS artist_subscriptions (
    wallet_address         VARCHAR(42)  PRIMARY KEY,
    email                  VARCHAR(255),
    stripe_customer_id     VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan                   VARCHAR(20)  NOT NULL DEFAULT 'free'  CHECK (plan IN ('free', 'atelier')),
    status                 VARCHAR(20)  NOT NULL DEFAULT 'none'  CHECK (status IN ('none', 'active', 'canceled', 'past_due', 'incomplete')),
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    cancel_at_period_end   BOOLEAN      NOT NULL DEFAULT FALSE,
    free_quota_used        INTEGER      NOT NULL DEFAULT 0       CHECK (free_quota_used >= 0),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_subscriptions_stripe_customer
    ON artist_subscriptions (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artist_subscriptions_stripe_subscription
    ON artist_subscriptions (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edition_events (
    id              SERIAL       PRIMARY KEY,
    wallet_address  VARCHAR(42)  NOT NULL,
    edition_id      BIGINT       NOT NULL,
    tx_hash         VARCHAR(66),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Composite index for fast rolling-30-day counting
CREATE INDEX IF NOT EXISTS idx_edition_events_wallet_created
    ON edition_events (wallet_address, created_at DESC);

-- Unique constraint to avoid double-counting if a request is retried
CREATE UNIQUE INDEX IF NOT EXISTS uniq_edition_events_wallet_edition
    ON edition_events (wallet_address, edition_id);

-- Idempotency for Stripe webhook events (skip if already processed)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id        VARCHAR(255) PRIMARY KEY,
    event_type      VARCHAR(100),
    received_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigger to keep artist_subscriptions.updated_at fresh on any update
CREATE OR REPLACE FUNCTION touch_artist_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artist_subscriptions_updated_at ON artist_subscriptions;
CREATE TRIGGER trg_artist_subscriptions_updated_at
    BEFORE UPDATE ON artist_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION touch_artist_subscriptions_updated_at();
