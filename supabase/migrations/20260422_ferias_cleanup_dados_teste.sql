-- =============================================================================
-- Limpeza de férias + sync bidirecional + dados de teste
-- =============================================================================
-- Contexto:
--   Bug reportado 22/04: Campo mostra funcionários de férias, Pessoas não.
--   Raiz: dupla fonte sem integridade entre `employees.status` e
--   `employee_vacations`. Solução autorizada por Aryanna:
--     - Limpar todos os registros de férias atuais (dados sujos)
--     - Trigger bidirecional garante consistência dali em diante
--     - Criar funcionário/cliente fictício para testes de módulos
--
-- Natureza: destrutiva parcial (TRUNCATE employee_vacations), não destrutiva
-- no resto. DROP employee_absences só se tabela existir fisicamente (não está
-- em types.ts — provavelmente já foi dropada, mas código tenta ler).
-- =============================================================================

-- =============================================================================
-- BLOCO 1 — Limpeza de dados inconsistentes de férias
-- =============================================================================

-- 1.1. Zerar employee_vacations (todos os registros atuais estão órfãos
-- ou potencialmente incoerentes com employees.status)
TRUNCATE TABLE public.employee_vacations RESTART IDENTITY CASCADE;

-- 1.2. Resetar SOMENTE status='ferias' → 'disponivel'.
-- Preserva 'licenca', 'afastado' e 'desligado' (são estados independentes
-- de employee_vacations, mexer seria destruir dado válido).
-- Instrução explícita Aryanna 22/04: "não mexer nos que não estão de férias".
UPDATE public.employees
SET status = 'disponivel'
WHERE status = 'ferias';

-- 1.3. DROP employee_absences se ainda existir fisicamente
-- (não consta em types.ts mas código tenta ler via `as any`)
DROP TABLE IF EXISTS public.employee_absences CASCADE;

-- =============================================================================
-- BLOCO 2 — Trigger bidirecional employee_vacations ↔ employees.status
-- =============================================================================
-- Garante que nunca mais haja inconsistência. Ao inserir/atualizar/deletar
-- vacation que cobre hoje, status do funcionário é ajustado.

CREATE OR REPLACE FUNCTION public.fn_sync_employee_vacation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_has_active_vacation BOOLEAN;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- DELETE: pega employee_id do OLD
  IF TG_OP = 'DELETE' THEN
    v_employee_id := OLD.employee_id;
  ELSE
    v_employee_id := NEW.employee_id;
  END IF;

  -- Tem alguma vacation ativa cobrindo hoje para este funcionário?
  SELECT EXISTS (
    SELECT 1 FROM public.employee_vacations
    WHERE employee_id = v_employee_id
      AND start_date <= v_today
      AND end_date >= v_today
  ) INTO v_has_active_vacation;

  -- Não mexe em 'desligado' (status permanente da Fase 3B)
  UPDATE public.employees
  SET status = CASE
    WHEN v_has_active_vacation THEN 'ferias'
    WHEN status = 'ferias' THEN 'disponivel'  -- só reset se estava 'ferias'
    ELSE status  -- preserva desligado, outros estados futuros
  END
  WHERE id = v_employee_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.fn_sync_employee_vacation_status IS
  'Mantém employees.status coerente com employee_vacations. Chamada por trigger em INSERT/UPDATE/DELETE. Só altera status ferias ↔ disponivel — preserva desligado e outros.';

DROP TRIGGER IF EXISTS trg_sync_vacation_status ON public.employee_vacations;
CREATE TRIGGER trg_sync_vacation_status
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_vacations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_employee_vacation_status();

-- =============================================================================
-- BLOCO 3 — Dados fictícios para testes de módulos
-- =============================================================================
-- Autorização: Aryanna 22/04 — "escolha um funcionário geral ou crie um
-- fictício para fazer testes nos módulos, assim como uma empresa."
--
-- IDs fixos (ON CONFLICT DO NOTHING): se já existirem, não duplica.
-- Nomenclatura "[TESTE]" facilita identificar e filtrar em queries.

-- 3.1. Funcionário fictício
INSERT INTO public.employees (
  id,
  name,
  matricula,
  role,
  status,
  admission_date,
  tipo_contrato,
  empresa_contratante,
  transporte_tipo,
  recebe_alelo,
  alelo_valor_dia,
  has_vt,
  vt_cash,
  vt_isento_desconto,
  email,
  phone,
  cpf,
  rg,
  data_nascimento,
  estado_civil,
  nacionalidade,
  salario_base,
  jornada,
  banco,
  agencia,
  conta,
  tipo_conta,
  contato_emergencia_nome,
  contato_emergencia_telefone,
  contato_emergencia_parentesco
) VALUES (
  '00000000-0000-0000-0000-000000000099'::uuid,
  '[TESTE] Funcionário Teste',
  'PREST-999',
  'Ajudante de Topografia',
  'disponivel',
  '2026-01-01',
  'prestador',
  'gonzaga_berlim',
  'vt_cartao',
  true,
  15.00,
  true,
  false,
  false,
  'teste@teste.ag',
  '(81) 99999-9999',
  '000.000.000-00',
  '0000000',
  '1990-01-01',
  'solteiro',
  'Brasileiro(a)',
  1500.00,
  '44h',
  'Bradesco',
  '0000',
  '00000-0',
  'corrente',
  'Contato Teste',
  '(81) 88888-8888',
  'Mãe'
)
ON CONFLICT (id) DO NOTHING;

-- 3.2. Cliente fictício
INSERT INTO public.clients (
  id,
  name,
  cnpj,
  cidade,
  estado,
  contato_principal,
  email_principal,
  telefone_principal
) VALUES (
  '00000000-0000-0000-0000-000000000099'::uuid,
  '[TESTE] Empresa Teste LTDA',
  '00.000.000/0001-00',
  'Recife',
  'PE',
  'Contato Teste',
  'contato@teste.ag',
  '(81) 99999-9999'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Validação pós-deploy (SQL Editor Lovable):
--
--   -- Limpeza
--   SELECT COUNT(*) FROM employee_vacations;                -- deve ser 0
--   SELECT COUNT(*) FROM employees WHERE status = 'ferias'; -- deve ser 0
--   SELECT tablename FROM pg_tables WHERE tablename='employee_absences'; -- zero
--
--   -- Trigger
--   SELECT trigger_name FROM information_schema.triggers
--   WHERE trigger_name = 'trg_sync_vacation_status';
--
--   -- Dados teste
--   SELECT name FROM employees WHERE matricula = 'PREST-999';
--   SELECT name FROM clients WHERE name LIKE '[TESTE]%';
--
--   -- Smoke test do trigger:
--   -- INSERT INTO employee_vacations (employee_id, start_date, end_date)
--   -- VALUES ('00000000-0000-0000-0000-000000000099', CURRENT_DATE, CURRENT_DATE + 7);
--   -- SELECT status FROM employees WHERE matricula='PREST-999';  -- deve ser 'ferias'
--   -- DELETE FROM employee_vacations WHERE employee_id='00000000-0000-0000-0000-000000000099';
--   -- SELECT status FROM employees WHERE matricula='PREST-999';  -- deve voltar a 'disponivel'
-- =============================================================================
