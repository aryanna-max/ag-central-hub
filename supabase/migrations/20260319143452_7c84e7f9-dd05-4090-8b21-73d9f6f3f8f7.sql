
-- Recreate enum: rename old, create new, migrate column, drop old
ALTER TYPE public.alert_recipient RENAME TO alert_recipient_old;

CREATE TYPE public.alert_recipient AS ENUM ('operacional', 'comercial', 'financeiro', 'rh', 'sala_tecnica', 'diretoria', 'todos');

-- Convert column, mapping old person names to areas
ALTER TABLE public.alerts
  ALTER COLUMN recipient TYPE public.alert_recipient
  USING (
    CASE recipient::text
      WHEN 'alcione' THEN 'operacional'
      WHEN 'marcelo' THEN 'diretoria'
      ELSE recipient::text
    END
  )::public.alert_recipient;

DROP TYPE public.alert_recipient_old;
