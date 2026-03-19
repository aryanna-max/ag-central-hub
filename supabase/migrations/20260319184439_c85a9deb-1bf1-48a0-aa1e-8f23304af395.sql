
ALTER TABLE public.measurements DROP COLUMN valor_bruto;
ALTER TABLE public.measurements DROP COLUMN valor_retencao;
ALTER TABLE public.measurements DROP COLUMN valor_nf;

ALTER TABLE public.measurements ADD COLUMN valor_bruto NUMERIC GENERATED ALWAYS AS (valor_diaria_semana) STORED;
ALTER TABLE public.measurements ADD COLUMN valor_retencao NUMERIC GENERATED ALWAYS AS (ROUND(CAST(valor_diaria_semana * retencao_pct / 100.0 AS NUMERIC), 2)) STORED;
ALTER TABLE public.measurements ADD COLUMN valor_nf NUMERIC GENERATED ALWAYS AS (ROUND(CAST(valor_diaria_semana * (1.0 - retencao_pct / 100.0) AS NUMERIC), 2)) STORED;
