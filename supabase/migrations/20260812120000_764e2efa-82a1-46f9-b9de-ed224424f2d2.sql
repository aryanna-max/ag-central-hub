-- =====================================================================
-- ADR-044 — Empresa empregadora como entidade (companies)
-- Cria: companies + FK em employees, company_documents, monthly_compliance_tasks
-- Idempotente. Sem DROP/DELETE/RENAME. Sem funções/views.
-- Backfill por MATCH EXATO dos rótulos reais de produção.
-- Decisões #64 e #78 (aceitas 12/08/2026).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum de papel da empresa
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_role') then
    create type public.company_role as enum ('topografia','cartografia');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. companies — a entidade única de "empresa" (empregadora E faturadora)
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  cnpj            text not null,
  razao_social    text not null,
  nome_curto      text not null,
  papel           public.company_role not null,
  faturadora_enum public.empresa_faturadora_enum,   -- ponte enum<->tabela; sai com E4
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists ux_companies_cnpj on public.companies (cnpj);
create unique index if not exists ux_companies_faturadora_enum
  on public.companies (faturadora_enum) where faturadora_enum is not null;

comment on table public.companies is
  'Empresa (pessoa juridica) do grupo AG. Fonte unica de empregador E faturador. ADR-044.';
comment on column public.companies.faturadora_enum is
  'Alias do empresa_faturadora_enum (ADR-042) por compatibilidade. Convergencia das colunas de faturamento e divida E1 (para company_id FK). Remover com E4.';

-- Seed idempotente dos dois CNPJs reais
insert into public.companies (cnpj, razao_social, nome_curto, papel, faturadora_enum)
values
  ('16.841.054/0001-10', 'GONZAGA E BERLIM CONSTRUCOES', 'Gonzaga e Berlim', 'topografia',  'ag_topografia'),
  ('48.282.440/0001-05', 'AG CARTOGRAFIA',               'AG Cartografia',   'cartografia', 'ag_cartografia')
on conflict (cnpj) do nothing;

-- ---------------------------------------------------------------------
-- 3. employees += employer_company_id
--    Backfill A PARTIR DE empresa_contratante (texto ja existente e populado).
--    `empresa_contratante` fica como ESPELHO DEPRECIADO (divida E5) — nao dropar.
-- ---------------------------------------------------------------------
alter table public.employees
  add column if not exists employer_company_id uuid references public.companies(id);

comment on column public.employees.employer_company_id is
  'Empregador (PJ) do funcionario. FK companies. ADR-044.';
comment on column public.employees.empresa_contratante is
  'DEPRECIADO (ADR-044). Texto livre (gonzaga_berlim | ag_cartografia). Usar employer_company_id -> companies. Espelho mantido ate a UI de RH migrar (divida E5).';

-- Match exato dos rotulos reais -> CNPJ. NAO usar fallback cego para Gonzaga:
-- deixar nulo o que nao casar e reportar, para a carga da Cartografia nao ser
-- silenciosamente atribuida ao empregador errado.
update public.employees e
   set employer_company_id = c.id
  from public.companies c
 where e.employer_company_id is null
   and (
        (e.empresa_contratante = 'gonzaga_berlim'  and c.papel = 'topografia')
     or (e.empresa_contratante = 'ag_cartografia'  and c.papel = 'cartografia')
   );

-- So marca NOT NULL se o backfill nao deixou nenhum orfao
do $$
declare v_nulos int;
begin
  select count(*) into v_nulos from public.employees where employer_company_id is null;
  if v_nulos = 0 then
    alter table public.employees alter column employer_company_id set not null;
  else
    raise notice 'ADR-044: % employees sem employer_company_id (empresa_contratante nulo ou rotulo novo). NOT NULL adiado. Conferir antes de rerodar.', v_nulos;
  end if;
end $$;

create index if not exists ix_employees_employer on public.employees (employer_company_id);

-- ---------------------------------------------------------------------
-- 4. company_documents += company_id  (backfill por match exato do texto `empresa`)
--    `empresa` (text) fica como ESPELHO DEPRECIADO — nao dropar (divida E3).
-- ---------------------------------------------------------------------
alter table public.company_documents
  add column if not exists company_id uuid references public.companies(id);

comment on column public.company_documents.empresa is
  'DEPRECIADO (ADR-044). Texto livre (gonzaga_berlim | ag_cartografia). Usar company_id -> companies. Espelho mantido ate a UI de Compliance migrar (divida E3).';
comment on column public.company_documents.company_id is
  'Empresa a que o documento (PCMSO/PGR/etc.) pertence. FK companies. ADR-044.';

update public.company_documents d
   set company_id = c.id
  from public.companies c
 where d.company_id is null
   and (
        (d.empresa = 'gonzaga_berlim'  and c.papel = 'topografia')
     or (d.empresa = 'ag_cartografia'  and c.papel = 'cartografia')
   );

do $$
declare v_orfaos int;
begin
  select count(*) into v_orfaos from public.company_documents where company_id is null;
  if v_orfaos > 0 then
    raise notice 'ADR-044: % company_documents sem company_id (rotulo de `empresa` nao mapeado). Conferir e completar manualmente.', v_orfaos;
  end if;
end $$;

create index if not exists ix_company_documents_company on public.company_documents (company_id);

-- ---------------------------------------------------------------------
-- 5. monthly_compliance_tasks += company_id  (mantem client_id e responsible_id)
--    Sem backfill: hoje as tasks sao por cliente; a atribuicao a empregador e
--    preenchimento posterior.
-- ---------------------------------------------------------------------
alter table public.monthly_compliance_tasks
  add column if not exists company_id uuid references public.companies(id);

comment on column public.monthly_compliance_tasks.company_id is
  'Empresa empregadora da obrigacao mensal (quando for por CNPJ, nao por cliente). FK companies. ADR-044.';

create index if not exists ix_monthly_compliance_company on public.monthly_compliance_tasks (company_id);
