
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT,
    due_date DATE NOT NULL,
    due_time TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    done BOOLEAN DEFAULT false,
    fired BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID -- Optional, for future multi-user support
);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Simple policy for now (public access for the demo app, same as other tables)
CREATE POLICY "Public Reminders Access" ON reminders FOR ALL USING (true);

-- Grant access to roles
GRANT ALL ON reminders TO service_role;
GRANT ALL ON reminders TO anon;
GRANT ALL ON reminders TO authenticated;
