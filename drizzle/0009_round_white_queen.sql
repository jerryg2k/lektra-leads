-- No-op: scanKeywords was added in 0008. This migration was previously a MODIFY COLUMN
-- for existing dev databases; on fresh databases the column already exists from 0008.
SELECT 1;
