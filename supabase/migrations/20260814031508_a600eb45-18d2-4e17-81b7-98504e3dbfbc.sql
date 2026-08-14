-- ADR-051 — Consolidação da Fundação: scaffold da camada de contrato + identidades únicas
-- Status do ADR: PROPOSTO (aguarda aceite da Aryanna + respostas de 08_PENDENCIAS).
--
-- REGRAS RESPEITADAS:
--   * Aditivo puro: cria tabelas NOVAS. NÃO altera clients/employees/projects (o topo do fluxo
--     que já funciona continua intacto). O "wiring" de FKs nas tabelas existentes é migration futura,
--     só após aceite + pendências.
--   * P14 / D-002: ZERO INSERT em tabela operacional. Schema sim, dado não.
--     Povoar vem depois, de fontes seguras, após o projeto consolidado (diretriz Aryanna 14/08).
--   * Decisão #55 (FK vence texto): enums criados só onde o plano do Codex JÁ define os valores
--     (contract_rule_domain). Onde os valores são pendência (tipo de contrato/OS/guarda-chuva),
--     fica text + comentário até 08_PENDENCIAS responder — não se inventa domínio.
--   * update_updated_at_column() em todas as tabelas (nunca set_updated_at/handle_updated_at).
--   * Idempotente (if not exists / drop policy if exists) para tolerar o espelho de migration do Lovable.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Enum derivado do plano (04_ARQUITETURA_ALVO — motor de regras)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'contract_rule_domain') then
    create type public.contract_rule_domain as enum ('compliance','medicao','faturamento','retencao');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. IDENTIDADES ÚNICAS (D-003 — base única, operações segregadas)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 addresses — endereços normalizados, reutilizáveis por CEP (habilita D-010)
create table if not exists public.addresses (
  id uuid not null default gen_random_uuid() primary key,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  pais text not null default 'BR',
  ponto_referencia text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.addresses is 'ADR-051: endereço normalizado. Reutilizável por CEP (D-010). Ainda não referenciado pelas tabelas legadas — wiring é migration futura.';

-- 1.2 organizations — identidade única por CNPJ (cliente, fornecedor, tomador…)
create table if not exists public.organizations (
  id uuid not null default gen_random_uuid() primary key,
  cnpj text,
  razao_social text not null,
  nome_fantasia text,
  inscricao_estadual text,
  inscricao_municipal text,
  address_id uuid references public.addresses(id) on delete set null,
  is_active boolean not null default true,
  observacoes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.organizations is 'ADR-051: identidade ÚNICA de organização por CNPJ (D-003). É só identidade — o papel (cliente/fornecedor/tomador) vem da relação comercial, não daqui. clients passa a ser relação sobre organization (wiring futuro).';
-- Regra de duplicidade do Gate 1 (07_CRITERIOS): CNPJ único quando informado.
create unique index if not exists organizations_cnpj_uidx on public.organizations (cnpj) where cnpj is not null;

-- 1.3 people — identidade única de pessoa física (CPF/matrícula)
create table if not exists public.people (
  id uuid not null default gen_random_uuid() primary key,
  cpf text,
  matricula text,
  nome_completo text not null,
  data_nascimento date,
  address_id uuid references public.addresses(id) on delete set null,
  is_active boolean not null default true,
  observacoes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.people is 'ADR-051: identidade ÚNICA de pessoa física (D-003). Hoje a pessoa está fragmentada em employees/profiles/*_contacts; estes viram VÍNCULOS sobre people (wiring futuro).';
-- Regra de duplicidade do Gate 1: CPF e matrícula únicos quando informados.
create unique index if not exists people_cpf_uidx on public.people (cpf) where cpf is not null;
create unique index if not exists people_matricula_uidx on public.people (matricula) where matricula is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CAMADA DE CONTRATO (D-004 / D-006 — cliente não substitui contrato)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1 contracts — pai entre a relação comercial e o projeto
create table if not exists public.contracts (
  id uuid not null default gen_random_uuid() primary key,
  codigo text,                                   -- gerado pelo sistema (D-012) — regra em pendência
  company_id uuid not null references public.companies(id),        -- empresa do grupo emissora (segregação, D-004)
  organization_id uuid not null references public.organizations(id), -- organização contratante
  tomador_organization_id uuid references public.organizations(id),  -- tomador/SPE diferente do contratante (ADR-049)
  tipo text,                                     -- contrato/guarda-chuva/OS/projeto — VALORES EM PENDÊNCIA (bloco Comercial); vira enum no aceite
  descricao text,
  vigencia_inicio date,
  vigencia_fim date,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.contracts is 'ADR-051: camada de CONTRATO — o pai que falta entre cliente e projeto (D-004/D-006). tipo fica text até 08_PENDENCIAS definir a diferença contrato x guarda-chuva x OS x projeto. projects.contract_id é wiring futuro (aditivo, com convivência).';
create unique index if not exists contracts_codigo_uidx on public.contracts (codigo) where codigo is not null;
create index if not exists contracts_company_idx on public.contracts (company_id);
create index if not exists contracts_organization_idx on public.contracts (organization_id);

-- 2.2 contract_rules — motor de regras herdáveis por contrato (o "com regras")
create table if not exists public.contract_rules (
  id uuid not null default gen_random_uuid() primary key,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  dominio public.contract_rule_domain not null,  -- compliance/medicao/faturamento/retencao
  regra jsonb not null default '{}'::jsonb,       -- parâmetros da regra (estrutura por domínio)
  responsavel text,                               -- toda exceção tem responsável (04 §motor)
  justificativa text,
  vigencia_inicio date,
  vigencia_fim date,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.contract_rules is 'ADR-051: motor de regras por contrato. Herança padrão→empresa→relação→contrato→exceção; nível mais específico vence. Substitui texto livre (Decisão #55). Toda exceção com responsável, justificativa e validade.';
create index if not exists contract_rules_contract_idx on public.contract_rules (contract_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SEGREGAÇÃO MULTIEMPRESA (Gate 1/Gate 2 — acesso por empresa)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 company_users — vínculo usuário ↔ empresa do grupo ↔ papel
create table if not exists public.company_users (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,                          -- -> auth.users.id / profiles.id (FK deixada solta como no padrão do projeto)
  company_id uuid not null references public.companies(id) on delete cascade,
  papel app_role not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
comment on table public.company_users is 'ADR-051: acesso por EMPRESA (segregação multiempresa). Base para RLS por empresa+papel+operação. A RLS de isolamento real e o teste automatizado entre empresas entram após esta tabela existir e as pendências de "quem opera cada empresa" serem respondidas.';
create unique index if not exists company_users_uidx on public.company_users (user_id, company_id, papel);
create index if not exists company_users_company_idx on public.company_users (company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS updated_at
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_addresses_updated on public.addresses;
create trigger trg_addresses_updated before update on public.addresses for each row execute function update_updated_at_column();

drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations for each row execute function update_updated_at_column();

drop trigger if exists trg_people_updated on public.people;
create trigger trg_people_updated before update on public.people for each row execute function update_updated_at_column();

drop trigger if exists trg_contracts_updated on public.contracts;
create trigger trg_contracts_updated before update on public.contracts for each row execute function update_updated_at_column();

drop trigger if exists trg_contract_rules_updated on public.contract_rules;
create trigger trg_contract_rules_updated before update on public.contract_rules for each row execute function update_updated_at_column();

drop trigger if exists trg_company_users_updated on public.company_users;
create trigger trg_company_users_updated before update on public.company_users for each row execute function update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — baseline (segue o padrão da casa: select p/ autenticado; write p/ papéis)
--    NB: esta é a política BASELINE. O isolamento multiempresa real (via company_users)
--        é migration posterior, com teste de isolamento entre empresas (trava do Gate 1).
-- ─────────────────────────────────────────────────────────────────────────────

-- addresses
alter table public.addresses enable row level security;
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
drop policy if exists addresses_select on public.addresses;
create policy addresses_select on public.addresses for select to authenticated using (true);
drop policy if exists addresses_write on public.addresses;
create policy addresses_write on public.addresses for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'rh'::app_role,'operacional'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'rh'::app_role,'operacional'::app_role]));

-- organizations
alter table public.organizations enable row level security;
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (true);
drop policy if exists organizations_write on public.organizations;
create policy organizations_write on public.organizations for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'rh'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'rh'::app_role]));

-- people
alter table public.people enable row level security;
grant select, insert, update, delete on public.people to authenticated;
grant all on public.people to service_role;
drop policy if exists people_select on public.people;
create policy people_select on public.people for select to authenticated using (true);
drop policy if exists people_write on public.people;
create policy people_write on public.people for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'rh'::app_role]));

-- contracts
alter table public.contracts enable row level security;
grant select, insert, update, delete on public.contracts to authenticated;
grant all on public.contracts to service_role;
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts for select to authenticated using (true);
drop policy if exists contracts_write on public.contracts;
create policy contracts_write on public.contracts for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'financeiro'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'comercial'::app_role,'financeiro'::app_role]));

-- contract_rules
alter table public.contract_rules enable row level security;
grant select, insert, update, delete on public.contract_rules to authenticated;
grant all on public.contract_rules to service_role;
drop policy if exists contract_rules_select on public.contract_rules;
create policy contract_rules_select on public.contract_rules for select to authenticated using (true);
drop policy if exists contract_rules_write on public.contract_rules;
create policy contract_rules_write on public.contract_rules for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'financeiro'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role,'financeiro'::app_role]));

-- company_users (tabela de controle de acesso — só master/diretor)
alter table public.company_users enable row level security;
grant select, insert, update, delete on public.company_users to authenticated;
grant all on public.company_users to service_role;
drop policy if exists company_users_select on public.company_users;
create policy company_users_select on public.company_users for select to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role]));
drop policy if exists company_users_write on public.company_users;
create policy company_users_write on public.company_users for all to authenticated
  using (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role]))
  with check (has_any_role(auth.uid(), ARRAY['master'::app_role,'diretor'::app_role]));