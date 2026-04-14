-- Add billing_type column to projects table
-- Values: entrega_nf (NF on delivery), medicao (measurement-based), sem_documento (no document)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'entrega_nf';

-- Update all existing projects that have NULL or default billing_type to entrega_nf
UPDATE public.projects SET billing_type = 'entrega_nf' WHERE billing_type IS NULL OR billing_type = '';

-- Update validation trigger to include billing_type
CREATE OR REPLACE FUNCTION public.validate_project_empresa_tipo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.empresa_faturadora NOT IN ('ag_topografia', 'ag_cartografia') THEN
    RAISE EXCEPTION 'Invalid empresa_faturadora: %', NEW.empresa_faturadora;
  END IF;
  IF NEW.tipo_documento NOT IN ('nf', 'recibo', 'nota_fiscal') THEN
    RAISE EXCEPTION 'Invalid tipo_documento: %', NEW.tipo_documento;
  END IF;
  IF NEW.billing_type NOT IN ('entrega_nf', 'medicao', 'sem_documento') THEN
    RAISE EXCEPTION 'Invalid billing_type: %', NEW.billing_type;
  END IF;
  RETURN NEW;
END;
$$;
