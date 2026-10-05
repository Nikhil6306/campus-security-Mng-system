-- Migration: 0006_purpose_meta.sql
-- Description: Adds flexible purpose-specific metadata JSON column to visit_requests

alter table public.visit_requests
  add column if not exists purpose_meta jsonb not null default '{}'::jsonb;

comment on column public.visit_requests.purpose_meta is
  'Purpose-specific fields stored as structured JSON (e.g., student name, course, designation, event details).';
