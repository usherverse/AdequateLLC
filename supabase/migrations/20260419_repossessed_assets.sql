-- Create repossessed_assets table
CREATE TABLE IF NOT EXISTS repossessed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id TEXT REFERENCES loans(id),
    customer_name TEXT,
    asset_name TEXT NOT NULL,
    possession_date DATE NOT NULL,
    status TEXT DEFAULT 'Possessed', -- 'Possessed', 'Disposed'
    valuation NUMERIC(15,2),
    disposal_amount NUMERIC(15,2),
    disposal_date DATE,
    officer_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE repossessed_assets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admin full access assets" ON repossessed_assets;
CREATE POLICY "Admin full access assets" ON repossessed_assets
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM workers WHERE email = auth.jwt()->>'email' AND role IN ('Admin', 'admin')));

DROP POLICY IF EXISTS "Asset Recovery view assets" ON repossessed_assets;
CREATE POLICY "Asset Recovery view assets" ON repossessed_assets
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM workers WHERE email = auth.jwt()->>'email' AND role IN ('Asset Recovery', 'Collections Officer')));

DROP POLICY IF EXISTS "Asset Recovery insert assets" ON repossessed_assets;
CREATE POLICY "Asset Recovery insert assets" ON repossessed_assets
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM workers WHERE email = auth.jwt()->>'email' AND role IN ('Asset Recovery')));

DROP POLICY IF EXISTS "Asset Recovery update assets" ON repossessed_assets;
CREATE POLICY "Asset Recovery update assets" ON repossessed_assets
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM workers WHERE email = auth.jwt()->>'email' AND role IN ('Asset Recovery')));
