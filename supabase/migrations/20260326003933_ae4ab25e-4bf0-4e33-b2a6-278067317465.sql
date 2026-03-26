ALTER TABLE measurements DROP COLUMN IF EXISTS team_id;

CREATE TABLE IF NOT EXISTS vehicle_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  employee_id uuid REFERENCES employees(id),
  month integer NOT NULL,
  year integer NOT NULL,
  days_count integer NOT NULL,
  daily_rate numeric NOT NULL,
  total_value numeric NOT NULL,
  closed_at timestamptz DEFAULT now(),
  closed_by uuid REFERENCES employees(id),
  notes text
);

ALTER TABLE vehicle_payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_vehicle_payment_history" ON vehicle_payment_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_vehicle_payment_history" ON vehicle_payment_history FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_system_settings" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_full_system_settings" ON system_settings FOR ALL TO anon USING (true) WITH CHECK (true);

INSERT INTO system_settings (key, value) VALUES ('vehicle_daily_rate', '0') ON CONFLICT DO NOTHING;