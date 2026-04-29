ALTER TABLE pipeline_templates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Existing rows are already live — mark them approved
UPDATE pipeline_templates SET status = 'approved';
