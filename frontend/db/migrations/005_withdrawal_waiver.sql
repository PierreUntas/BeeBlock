-- Migration 005: Add withdrawal_waiver_accepted_at column to artist_subscriptions
--
-- Records the timestamp at which the artist explicitly waived their 14-day
-- right of withdrawal (Code de la consommation, art. L.221-28 §13°) before
-- being redirected to Stripe Checkout. Without this consent, the right of
-- withdrawal remains active for 14 days and a refund could be claimed even
-- after the service has been used.
--
-- This is required to enforce CGV Article 5 in production (cf. brief juridique
-- §2.1, decision documented in docs/legal/00-brief-revue-juridique.md).
--
-- The column is NULLABLE because:
--  - Existing rows (created before this migration) don't have a value
--  - The waiver is only required when subscribing to Atelier, not for free tier

ALTER TABLE artist_subscriptions
    ADD COLUMN IF NOT EXISTS withdrawal_waiver_accepted_at TIMESTAMP WITH TIME ZONE NULL;

COMMENT ON COLUMN artist_subscriptions.withdrawal_waiver_accepted_at IS
    'Timestamp at which the artist explicitly waived their 14-day withdrawal right (Code conso L.221-28 §13°) before Stripe Checkout. NULL = never waived (still under 14-day right of withdrawal).';
