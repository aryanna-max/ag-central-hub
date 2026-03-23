
-- A5: VT fields on employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_vt boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vt_cash boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vt_value numeric DEFAULT 0;

-- B4: Project benefit rules
CREATE TABLE IF NOT EXISTS project_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cafe_enabled boolean DEFAULT false,
  cafe_value numeric DEFAULT 0,
  almoco_type text DEFAULT 'va_cobre',
  almoco_diferenca_value numeric DEFAULT 0,
  jantar_enabled boolean DEFAULT false,
  jantar_value numeric DEFAULT 0,
  hospedagem_enabled boolean DEFAULT false,
  hospedagem_type text DEFAULT 'pousada',
  hospedagem_value numeric DEFAULT 0,
  pagamento_antecipado boolean DEFAULT false,
  dia_pagamento text DEFAULT 'sexta',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE project_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_project_benefits" ON project_benefits FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_project_benefits" ON project_benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);
