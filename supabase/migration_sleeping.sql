-- Migration: Add is_sleeping flag to eren_stats
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- When Eren is tucked into bed, this flag goes true and the partner's UI
-- realtime-syncs: Eren disappears from every other room and activities
-- (feed, play, wash, vet) get disabled until he's woken up.

ALTER TABLE public.eren_stats
  ADD COLUMN IF NOT EXISTS is_sleeping boolean NOT NULL DEFAULT false;
