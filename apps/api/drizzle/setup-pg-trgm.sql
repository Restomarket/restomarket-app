-- Migration to enable pg_trgm extension for GIN text search
-- Run this before applying the users table schema

-- Enable trigram extension for efficient ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- This extension allows GIN indexes to support ILIKE '%pattern%' searches
-- which are used in the users.search functionality

-- The users table schema already includes:
-- CREATE INDEX users_search_idx ON users USING gin (
--   email gin_trgm_ops,
--   first_name gin_trgm_ops,
--   last_name gin_trgm_ops
-- );

-- This will significantly improve performance for text search queries like:
-- SELECT * FROM users WHERE 
--   email ILIKE '%search%' OR 
--   first_name ILIKE '%search%' OR 
--   last_name ILIKE '%search%';
