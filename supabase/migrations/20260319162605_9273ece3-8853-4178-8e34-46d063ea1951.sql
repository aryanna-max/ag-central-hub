
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS empresa_faturadora TEXT NOT NULL DEFAULT 'ag_topografia',
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'nota_fiscal';

ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS empresa_faturadora TEXT NOT NULL DEFAULT 'ag_topografia',
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'nota_fiscal';

-- Validation trigger for projects
CREATE OR REPLACE FUNCTION public.validate_project_empresa_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.empresa_faturadora NOT IN ('ag_topografia', 'ag_cartografia') THEN
    RAISE EXCEPTION 'Invalid empresa_faturadora: %', NEW.empresa_faturadora;
  END IF;
  IF NEW.tipo_documento NOT IN ('nota_fiscal', 'recibo') THEN
    RAISE EXCEPTION 'Invalid tipo_documento: %', NEW.tipo_documento;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_project_empresa_tipo
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_empresa_tipo();

-- Validation trigger for measurements
CREATE OR REPLACE FUNCTION public.validate_measurement_empresa_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.empresa_faturadora NOT IN ('ag_topografia', 'ag_cartografia') THEN
    RAISE EXCEPTION 'Invalid empresa_faturadora: %', NEW.empresa_faturadora;
  END IF;
  IF NEW.tipo_documento NOT IN ('nota_fiscal', 'recibo') THEN
    RAISE EXCEPTION 'Invalid tipo_documento: %', NEW.tipo_documento;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_measurement_empresa_tipo
  BEFORE INSERT OR UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION public.validate_measurement_empresa_tipo();
