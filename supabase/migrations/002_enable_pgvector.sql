-- ============================================================
-- Phase 1: 启用 pgvector / pg_trgm 扩展
-- ============================================================

create extension if not exists vector;
create extension if not exists pg_trgm;

