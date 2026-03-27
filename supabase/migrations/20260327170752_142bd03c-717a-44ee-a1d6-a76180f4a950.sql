
-- Novos campos em leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_project_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origin text DEFAULT 'outro';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'pj';

-- Novos campos em projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cnpj_tomador text;

-- Mapear source → origin nos leads existentes
UPDATE leads SET origin = source::text WHERE source IS NOT NULL;
UPDATE leads SET origin = 'outro' WHERE origin = 'outros';

-- Código do cliente: constraint 3 caracteres
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_codigo_check;
ALTER TABLE clients ADD CONSTRAINT clients_codigo_check
  CHECK (codigo IS NULL OR char_length(codigo) = 3);

-- Mover valores atuais de tipo para segmento
UPDATE clients SET segmento = tipo WHERE tipo IS NOT NULL AND tipo NOT IN ('pj', 'pf');
UPDATE clients SET tipo = 'pj' WHERE tipo IS NULL OR tipo NOT IN ('pj', 'pf');
