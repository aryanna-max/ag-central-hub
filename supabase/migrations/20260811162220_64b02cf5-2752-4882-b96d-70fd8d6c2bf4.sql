-- =====================================================================
-- ADR-042 — MCP de escrita, ondas 1 e 2
-- Estrutura para: resolve_alert, update_lead_status, create_titulo,
--                 register_recebimento, allocate_recebimento,
--                 update_execution_status
-- Idempotente. Sem DROP/DELETE/RENAME.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. alerts: quem resolve é USUÁRIO, não funcionário
--    (resolved_by aponta para employees — diretoria não está lá)
-- ---------------------------------------------------------------------
alter table public.alerts
  add column if not exists resolved_by_profile_id uuid references public.profiles(id);

comment on column public.alerts.resolved_by is
  'DEPRECIADO (ADR-042). FK para employees; quem resolve alerta é usuário, não funcionário. Usar resolved_by_profile_id.';

-- ---------------------------------------------------------------------
-- 2. invoices: status vira enum (Decisão #55)
--    Aborta com mensagem legível se houver valor fora do conjunto.
-- ---------------------------------------------------------------------
do $$
declare v_bad text;
begin
  select string_agg(distinct status, ', ') into v_bad
  from public.invoices
  where status is not null
    and status not in ('pendente','emitida','paga','cancelada');

  if v_bad is not null then
    raise exception
      'ADR-042 abortado: invoices.status contém valores fora do enum (%). Normalizar antes de converter.', v_bad;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('pendente','emitida','paga','cancelada');
  end if;
end $$;

do $$
begin
  if (select udt_name from information_schema.columns
      where table_schema='public' and table_name='invoices' and column_name='status') = 'text' then
    alter table public.invoices alter column status drop default;
    alter table public.invoices
      alter column status type public.invoice_status
      using coalesce(status,'pendente')::public.invoice_status;
    alter table public.invoices alter column status set default 'pendente'::public.invoice_status;
    alter table public.invoices alter column status set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. invoices: vencimento e rastro de origem
--    ATENÇÃO (ADR-042 §3.1): NÃO existem aqui paid_at, valor_recebido,
--    payment_ref nem paid_by_id. Recebimento é entidade própria e saldo
--    é derivado por soma — nunca campo editável.
-- ---------------------------------------------------------------------
alter table public.invoices
  add column if not exists due_date   date,
  add column if not exists source_ref text;

comment on column public.invoices.due_date   is 'Vencimento do título.';
comment on column public.invoices.source_ref is 'Documento de origem (Message-ID de e-mail, caminho no Drive). Chave de idempotência da recarga.';
comment on column public.invoices.status     is
  'Ciclo do DOCUMENTO (pendente/emitida/cancelada). O valor ''paga'' é LEGADO e nenhuma função o escreve: a situação de recebimento vem de v_titulos_receber.situacao (ADR-042 §3.1).';

-- ---------------------------------------------------------------------
-- 4. Idempotência no schema, não na aplicação
-- ---------------------------------------------------------------------
create unique index if not exists ux_invoices_source_ref
  on public.invoices (source_ref)
  where source_ref is not null;

create unique index if not exists ux_invoices_empresa_nf
  on public.invoices (empresa_faturadora, nf_numero)
  where nf_numero is not null and status <> 'cancelada';

create index if not exists ix_invoices_project        on public.invoices (project_id);
create index if not exists ix_invoices_status_due     on public.invoices (status, due_date);

-- ---------------------------------------------------------------------
-- 4.1 receipts — o dinheiro que ENTROU. Lançamento imutável.
--     Pertence ao CLIENTE (Decisão #02), não à nota.
--     Estorno = linha nova de sinal oposto (estorna_id). Nunca UPDATE.
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients(id),
  empresa_recebedora   public.empresa_faturadora_enum not null,
  data_recebimento     date not null,
  valor                numeric not null,
  referencia_pagamento text not null,
  conta                text,
  origem_ref           text,
  observacoes          text,
  estorna_id           uuid references public.receipts(id),
  created_by_id        uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  constraint ck_receipts_valor_nao_zero check (valor <> 0)
);

comment on table  public.receipts is
  'Recebimento: dinheiro que entrou, ligado ao CLIENTE. IMUTÁVEL — sem UPDATE, sem DELETE. Correção é contra-lançamento via estorna_id. ADR-042 §3.1.';
comment on column public.receipts.referencia_pagamento is
  'Linha do extrato ou identificador do comprovante. ÚNICA no sistema — é a trava de dupla baixa.';
comment on column public.receipts.empresa_recebedora is
  'PJ que recebeu. ag_topografia = GONZAGA E BERLIM CONSTRUÇÕES (16.841.054/0001-10); ag_cartografia = AG CARTOGRAFIA (48.282.440/0001-05).';

create unique index if not exists ux_receipts_referencia
  on public.receipts (referencia_pagamento);
create index if not exists ix_receipts_client
  on public.receipts (client_id, data_recebimento);

-- ---------------------------------------------------------------------
-- 4.2 receipt_allocations — "esta parte deste dinheiro é desta nota".
--     Também imutável. Um recebimento aloca no máximo uma vez por título.
-- ---------------------------------------------------------------------
create table if not exists public.receipt_allocations (
  id              uuid primary key default gen_random_uuid(),
  receipt_id      uuid not null references public.receipts(id),
  invoice_id      uuid not null references public.invoices(id),
  valor           numeric not null,
  origem_ref      text,
  allocated_by_id uuid references public.profiles(id),
  allocated_at    timestamptz not null default now(),
  constraint ck_alloc_valor_nao_zero check (valor <> 0)
);

comment on table public.receipt_allocations is
  'Vínculo recebimento→título. IMUTÁVEL. Desalocar é linha de sinal oposto. Saldo do título = valor_liquido - soma daqui. ADR-042 §3.1.';

create unique index if not exists ux_alloc_receipt_invoice
  on public.receipt_allocations (receipt_id, invoice_id)
  where valor > 0;
create index if not exists ix_alloc_invoice on public.receipt_allocations (invoice_id);
create index if not exists ix_alloc_receipt on public.receipt_allocations (receipt_id);

-- ---------------------------------------------------------------------
-- 4.3 RLS: escreve quem pode faturar. NÃO existe policy de UPDATE nem
--     de DELETE — a imutabilidade é garantida pelo banco.
-- ---------------------------------------------------------------------
alter table public.receipts            enable row level security;
alter table public.receipt_allocations enable row level security;

grant select, insert on public.receipts            to authenticated;
grant select, insert on public.receipt_allocations to authenticated;
grant all on public.receipts            to service_role;
grant all on public.receipt_allocations to service_role;

do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipts' and policyname='receipts_select') then
    create policy receipts_select on public.receipts
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipts' and policyname='receipts_insert') then
    create policy receipts_insert on public.receipts
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','financeiro']::public.app_role[]));
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipt_allocations' and policyname='alloc_select') then
    create policy alloc_select on public.receipt_allocations
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='receipt_allocations' and policyname='alloc_insert') then
    create policy alloc_insert on public.receipt_allocations
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','financeiro']::public.app_role[]));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4.4 Os dois saldos — DERIVADOS POR SOMA, jamais campo.
-- ---------------------------------------------------------------------
create or replace view public.v_titulos_receber as
select
  i.id                as titulo_id,
  i.project_id,
  p.codigo            as projeto_codigo,
  p.name              as projeto_nome,
  p.client_id,
  c.name              as cliente,
  i.empresa_faturadora,
  i.tipo, i.nf_numero, i.nf_data, i.due_date,
  i.valor_bruto, i.retencao,
  coalesce(i.valor_liquido, i.valor_bruto)                                  as valor_titulo,
  coalesce(a.valor_alocado, 0)                                             as valor_recebido,
  coalesce(i.valor_liquido, i.valor_bruto) - coalesce(a.valor_alocado, 0)  as saldo,
  a.ultimo_recebimento_em,
  case
    when i.status = 'cancelada'                                                        then 'cancelado'
    when coalesce(a.valor_alocado,0) <= 0                                              then 'em_aberto'
    when coalesce(a.valor_alocado,0) >= coalesce(i.valor_liquido, i.valor_bruto)       then 'quitado'
    else 'parcial'
  end                 as situacao,
  i.status            as status_documento,
  i.source_ref
from public.invoices i
join public.projects p on p.id = i.project_id
left join public.clients c on c.id = p.client_id
left join lateral (
  select sum(ra.valor)            as valor_alocado,
         max(r.data_recebimento)  as ultimo_recebimento_em
  from public.receipt_allocations ra
  join public.receipts r on r.id = ra.receipt_id
  where ra.invoice_id = i.id
) a on true;

comment on view public.v_titulos_receber is
  'Contas a receber. saldo e situacao são SOMA, não campo. Responde "quem está devendo". ADR-042 §3.1.';

-- Sem isto a view roda como o DONO e a RLS das tabelas de baixo é ignorada.
-- Mesmo princípio do SECURITY INVOKER das funções (§7).
alter view public.v_titulos_receber set (security_invoker = on);

-- Adiantamento = recebimento ainda sem alocação. Não precisa de estrutura própria.
create or replace view public.v_credito_cliente as
select
  r.client_id,
  c.name                                          as cliente,
  r.empresa_recebedora,
  sum(r.valor)                                    as total_recebido,
  coalesce(sum(al.alocado), 0)                    as total_alocado,
  sum(r.valor) - coalesce(sum(al.alocado), 0)     as credito_disponivel
from public.receipts r
join public.clients c on c.id = r.client_id
left join lateral (
  select sum(ra.valor) as alocado
  from public.receipt_allocations ra
  where ra.receipt_id = r.id
) al on true
group by r.client_id, c.name, r.empresa_recebedora;

comment on view public.v_credito_cliente is
  'Crédito do cliente = dinheiro recebido ainda não alocado a título. É o ADIANTAMENTO. ADR-042 §3.1.';

alter view public.v_credito_cliente set (security_invoker = on);

-- ---------------------------------------------------------------------
-- 5. fn_on_status_change: 2 correções cirúrgicas
--    (a) não sobrescrever responsável já preenchido  [A3]
--    (b) não emitir alerta quando a sessão é de recarga  [A2]
--    Todo o resto do corpo é idêntico ao vigente.
-- ---------------------------------------------------------------------
create or replace function public.fn_on_status_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_doc_label text;
  v_backfill boolean;
begin
  begin
    v_uid := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  exception when others then
    v_uid := null;
  end;

  v_backfill := coalesce(current_setting('ag.backfill', true), 'off') = 'on';

  -- Campo iniciado
  if NEW.execution_status = 'em_campo' and OLD.execution_status <> 'em_campo' then
    NEW.field_started_at := coalesce(NEW.field_started_at, current_date);
    -- ADR-042: só preenche se estiver vazio; nunca reescreve autoria real
    NEW.responsible_campo_id := coalesce(NEW.responsible_campo_id, v_uid);
  end if;

  -- Entrou em processamento
  if NEW.execution_status = 'aguardando_processamento'
     and OLD.execution_status <> 'aguardando_processamento' then
    NEW.responsible_tecnico_id := coalesce(NEW.responsible_tecnico_id, v_uid);
  end if;

  -- Campo concluído
  if NEW.execution_status = 'campo_concluido' and OLD.execution_status <> 'campo_concluido' then
    NEW.field_completed_at := coalesce(NEW.field_completed_at, current_date);

    if not v_backfill then
      insert into public.alerts (
        alert_type, title, message, origem_modulo, tipo,
        recipient, priority, alert_status, reference_id, reference_type, action_url
      ) values (
        'campo_concluido',
        'Campo concluído: ' || NEW.codigo,
        'Campo concluído — disponível para processamento: ' || NEW.codigo || ' — ' || NEW.name,
        'operacional', 'campo_concluido',
        'sala_tecnica', 'importante', 'ativo',
        NEW.id, 'project', '/sala-tecnica/projetos/' || NEW.id::text
      );
    end if;
  end if;

  -- Entregue
  if NEW.execution_status = 'entregue' and OLD.execution_status <> 'entregue' then
    NEW.delivered_at := coalesce(NEW.delivered_at, current_date);

    v_doc_label := case NEW.billing_type
      when 'entrega_nf'     then 'Emitir NF'
      when 'entrega_recibo' then 'Emitir Recibo'
      when 'medicao_mensal' then null
      when 'sem_documento'  then null
      else 'Verificar documento'
    end;

    if v_doc_label is not null and not v_backfill then
      insert into public.alerts (
        alert_type, title, message, origem_modulo, tipo,
        recipient, priority, alert_status, reference_id, reference_type, action_url
      ) values (
        'entrega_concluida',
        v_doc_label || ': ' || NEW.codigo,
        v_doc_label || ' — ' || NEW.codigo || ' · ' || NEW.name
          || ' · Entregue em ' || to_char(coalesce(NEW.delivered_at, current_date), 'DD/MM/YYYY'),
        'sala_tecnica', 'entrega_concluida',
        'financeiro', 'urgente', 'ativo',
        NEW.id, 'project', '/financeiro/projetos/' || NEW.id::text
      );
    end if;
  end if;

  -- Preparação técnica
  if NEW.needs_tech_prep = true
     and OLD.execution_status is distinct from NEW.execution_status
     and NEW.execution_status = 'aguardando_processamento'
     and not v_backfill then
    insert into public.alerts (
      alert_type, title, message, origem_modulo, tipo,
      recipient, priority, alert_status, reference_id, reference_type, action_url
    ) values (
      'needs_tech_prep',
      'Novo projeto para distribuir: ' || NEW.codigo,
      'Novo projeto requer preparação técnica: ' || NEW.codigo || ' — ' || NEW.name,
      'comercial', 'needs_tech_prep',
      'sala_tecnica', 'importante', 'ativo',
      NEW.id, 'project', '/sala-tecnica/projetos/' || NEW.id::text
    );
  end if;

  return NEW;
end;
$function$;

-- =====================================================================
-- B2. Funções SQL (os engines) — todas SECURITY INVOKER (padrão)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_resolve_alert
-- ---------------------------------------------------------------------
create or replace function public.fn_resolve_alert(
  p_alert_id   uuid,
  p_resolucao  text,
  p_origem_ref text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_alert   public.alerts%rowtype;
  v_roles   public.app_role[];
  v_tem_titulo boolean;
begin
  if coalesce(trim(p_resolucao),'') = '' then
    raise exception 'Informe o que foi feito para resolver o alerta (parâmetro resolucao).';
  end if;

  select * into v_alert from public.alerts where id = p_alert_id;
  if not found then
    raise exception 'Alerta % não encontrado.', p_alert_id;
  end if;

  -- Idempotente: já resolvido não é erro
  if v_alert.resolved then
    return jsonb_build_object(
      'ja_resolvido', true,
      'alerta_id', v_alert.id,
      'titulo', v_alert.title,
      'resolvido_em', v_alert.resolved_at
    );
  end if;

  -- Política: quem pode dar baixa depende do destinatário
  v_roles := case v_alert.recipient
    when 'operacional'  then array['master','diretor','operacional']::public.app_role[]
    when 'comercial'    then array['master','diretor','comercial']::public.app_role[]
    when 'financeiro'   then array['master','diretor','financeiro']::public.app_role[]
    when 'rh'           then array['master','diretor','financeiro']::public.app_role[]
    when 'sala_tecnica' then array['master','diretor','sala_tecnica']::public.app_role[]
    when 'diretoria'    then array['master','diretor']::public.app_role[]
    else array['master','diretor','operacional','sala_tecnica','comercial','financeiro']::public.app_role[]
  end;

  if not public.has_any_role(auth.uid(), v_roles) then
    raise exception 'Sem permissão: alerta destinado a % exige papel compatível.', v_alert.recipient;
  end if;

  -- Política: alerta de emissão de documento exige o documento (Decisão #62)
  if v_alert.alert_type = 'entrega_concluida' and v_alert.reference_type = 'project' then
    select exists (
      select 1 from public.invoices i
      where i.project_id = v_alert.reference_id and i.status <> 'cancelada'
    ) into v_tem_titulo;

    if not v_tem_titulo then
      raise exception
        'Este alerta pede emissão de documento e não existe título para o projeto. Registre com create_titulo — o título resolve o alerta sozinho.';
    end if;
  end if;

  update public.alerts
     set resolved = true,
         resolved_at = now(),
         resolved_by_profile_id = auth.uid(),
         alert_status = 'resolvido',
         read = true
   where id = p_alert_id;

  perform public.log_event(
    'alert.resolved', 'alerts', p_alert_id,
    jsonb_build_object('alert_type', v_alert.alert_type, 'recipient', v_alert.recipient, 'resolucao', p_resolucao),
    jsonb_build_object('canal','mcp','ferramenta','resolve_alert','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'ja_resolvido', false,
    'alerta_id', v_alert.id,
    'titulo', v_alert.title,
    'tipo', v_alert.alert_type,
    'resolvido_em', now()
  );
end;
$$;

-- ---------------------------------------------------------------------
-- fn_update_lead_status
-- ---------------------------------------------------------------------
create or replace function public.fn_update_lead_status(
  p_lead_id     uuid,
  p_novo_status public.lead_status,
  p_observacao  text default null,
  p_origem_ref  text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'Lead % não encontrado.', p_lead_id;
  end if;

  if v_lead.status = p_novo_status then
    return jsonb_build_object('sem_alteracao', true, 'lead_id', v_lead.id,
                              'codigo', v_lead.codigo, 'status', v_lead.status);
  end if;

  -- Política: 'convertido' é consequência da conversão (que cria o projeto), não um status que se digita
  if p_novo_status = 'convertido' then
    raise exception
      'Status convertido é resultado da conversão do lead em projeto. Use o fluxo de conversão — não mova o status na mão.';
  end if;

  -- Política: perda exige motivo
  if p_novo_status in ('descartado','perdido') and coalesce(trim(p_observacao),'') = '' then
    raise exception 'Descarte e perda exigem motivo (parâmetro observacao).';
  end if;

  update public.leads
     set status = p_novo_status, updated_at = now()
   where id = p_lead_id;

  insert into public.lead_status_history (lead_id, from_status, to_status, changed_by_id, notes)
  values (p_lead_id, v_lead.status::text, p_novo_status::text, auth.uid(), p_observacao);

  perform public.log_event(
    'lead.status_changed', 'leads', p_lead_id,
    jsonb_build_object('de', v_lead.status, 'para', p_novo_status, 'observacao', p_observacao),
    jsonb_build_object('canal','mcp','ferramenta','update_lead_status','origem_ref', p_origem_ref)
  );

  return jsonb_build_object('sem_alteracao', false, 'lead_id', v_lead.id, 'codigo', v_lead.codigo,
                            'nome', v_lead.name, 'de', v_lead.status, 'para', p_novo_status);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_create_titulo
-- ---------------------------------------------------------------------
create or replace function public.fn_create_titulo(
  p_projeto_codigo text,
  p_valor_bruto    numeric,
  p_origem_ref     text,
  p_tipo           public.tipo_documento default null,
  p_nf_numero      text default null,
  p_nf_data        date default null,
  p_vencimento     date default null,
  p_retencao       numeric default 0,
  p_cnpj_tomador   text default null,
  p_observacoes    text default null,
  p_recarga        boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj      public.projects%rowtype;
  v_cli       public.clients%rowtype;
  v_existente public.invoices%rowtype;
  v_empresa   public.empresa_faturadora_enum;
  v_tipo      public.tipo_documento;
  v_cnpj      text;
  v_status    public.invoice_status;
  v_liquido   numeric;
  v_id        uuid;
  v_alertas   int := 0;
  v_credito   numeric := 0;
begin
  if coalesce(trim(p_origem_ref),'') = '' then
    raise exception 'origem_ref é obrigatório: informe o documento que originou o título (Message-ID do e-mail ou caminho no Drive).';
  end if;
  if p_valor_bruto is null or p_valor_bruto <= 0 then
    raise exception 'valor_bruto deve ser maior que zero.';
  end if;
  if p_nf_numero is not null and p_nf_data is null then
    raise exception 'Informou número de nota: informe também a data de emissão.';
  end if;

  -- Idempotência 1: mesma origem
  select * into v_existente from public.invoices where source_ref = p_origem_ref;
  if found then
    return jsonb_build_object('criado', false, 'motivo', 'origem_ja_registrada',
      'titulo_id', v_existente.id, 'nf_numero', v_existente.nf_numero, 'status', v_existente.status);
  end if;

  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  -- Idempotência 2: mesma nota da mesma empresa emissora
  v_empresa := v_proj.empresa_faturadora::public.empresa_faturadora_enum;
  if p_nf_numero is not null then
    select * into v_existente from public.invoices
     where empresa_faturadora = v_empresa and nf_numero = p_nf_numero and status <> 'cancelada';
    if found then
      return jsonb_build_object('criado', false, 'motivo', 'nota_ja_registrada',
        'titulo_id', v_existente.id, 'nf_numero', v_existente.nf_numero, 'status', v_existente.status);
    end if;
  end if;

  -- Regra da casa: nunca misturar os dois CNPJs. A empresa emissora é a do contrato do projeto.
  if v_proj.client_id is null then
    raise exception 'Projeto % não tem cliente vinculado. CLIENTE é o centro — vincule antes de faturar.', p_projeto_codigo;
  end if;
  select * into v_cli from public.clients where id = v_proj.client_id;

  v_cnpj := coalesce(p_cnpj_tomador, v_proj.cnpj_tomador, v_cli.cnpj);
  if p_cnpj_tomador is not null and v_cli.cnpj is not null
     and regexp_replace(p_cnpj_tomador,'\D','','g') <> regexp_replace(v_cli.cnpj,'\D','','g') then
    raise exception 'CNPJ do tomador (%) diverge do cadastro do cliente % (%). Corrija o cadastro antes de faturar.',
      p_cnpj_tomador, v_cli.name, v_cli.cnpj;
  end if;

  -- Tradução de vocabulário: projects usa 'nota_fiscal', o enum usa 'nf'
  v_tipo := coalesce(p_tipo,
              case when v_proj.tipo_documento = 'recibo' then 'recibo'::public.tipo_documento
                   else 'nf'::public.tipo_documento end);

  v_liquido := p_valor_bruto - coalesce(p_retencao, 0);
  if v_liquido < 0 then
    raise exception 'Retenção (%) maior que o valor bruto (%).', p_retencao, p_valor_bruto;
  end if;

  v_status := case when p_nf_numero is not null then 'emitida'::public.invoice_status
                   else 'pendente'::public.invoice_status end;

  insert into public.invoices (
    project_id, tipo, nf_numero, nf_data, empresa_faturadora, cnpj_tomador,
    valor_bruto, retencao, valor_liquido, due_date, status, notes,
    created_by_id, source_ref
  ) values (
    v_proj.id, v_tipo, p_nf_numero, p_nf_data, v_empresa, v_cnpj,
    p_valor_bruto, coalesce(p_retencao,0), v_liquido, p_vencimento, v_status, p_observacoes,
    auth.uid(), p_origem_ref
  ) returning id into v_id;

  -- Espelho depreciado (ADR-042 §3): só preenche se estiver vazio
  if p_nf_data is not null and v_proj.nf_data is null then
    update public.projects set nf_data = p_nf_data where id = v_proj.id;
  end if;

  -- Nota emitida move o projeto para faturamento (derivado, não digitado)
  if v_status = 'emitida'
     and v_proj.execution_status is distinct from 'faturamento'
     and v_proj.execution_status is distinct from 'pago' then
    if p_recarga then perform set_config('ag.backfill','on',true); end if;
    update public.projects set execution_status = 'faturamento' where id = v_proj.id;
    if p_recarga then perform set_config('ag.backfill','off',true); end if;
  end if;

  -- Fecha o laço: o alerta que pediu a emissão morre com o título criado
  update public.alerts
     set resolved = true, resolved_at = now(), resolved_by_profile_id = auth.uid(),
         alert_status = 'resolvido', read = true
   where alert_type = 'entrega_concluida' and reference_type = 'project'
     and reference_id = v_proj.id and resolved = false;
  get diagnostics v_alertas = row_count;

  perform public.log_event(
    'titulo.created', 'invoices', v_id,
    jsonb_build_object('projeto', v_proj.codigo, 'cliente', v_cli.name, 'tipo', v_tipo,
                       'nf_numero', p_nf_numero, 'valor_bruto', p_valor_bruto,
                       'retencao', coalesce(p_retencao,0), 'valor_liquido', v_liquido,
                       'empresa_faturadora', v_empresa),
    jsonb_build_object('canal','mcp','ferramenta','create_titulo','origem_ref', p_origem_ref,'recarga', p_recarga)
  );

  -- ADR-042 §3.1: se o cliente já mandou dinheiro sem destino, AVISA.
  -- Não aloca sozinho: adivinhar a que se refere é inventar dado.
  select coalesce(credito_disponivel, 0) into v_credito
    from public.v_credito_cliente
   where client_id = v_proj.client_id and empresa_recebedora = v_empresa;

  return jsonb_build_object(
    'criado', true, 'titulo_id', v_id, 'projeto', v_proj.codigo, 'cliente', v_cli.name,
    'empresa_faturadora', v_empresa, 'tipo', v_tipo, 'nf_numero', p_nf_numero,
    'valor_bruto', p_valor_bruto, 'retencao', coalesce(p_retencao,0), 'valor_liquido', v_liquido,
    'vencimento', p_vencimento, 'status', v_status, 'alertas_resolvidos', v_alertas,
    'credito_do_cliente_disponivel', coalesce(v_credito,0),
    'dica', case when coalesce(v_credito,0) > 0
                 then 'Este cliente tem crédito não alocado (adiantamento). Use allocate_recebimento para abater este título.'
                 else null end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- fn_recalc_project_paid — auxiliar
-- O projeto vira `pago` quando nenhum título dele tem saldo.
-- Derivado, recalculado — nunca incrementado.
-- ---------------------------------------------------------------------
create or replace function public.fn_recalc_project_paid(p_project_id uuid)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare
  v_com_saldo int;
  v_titulos   int;
begin
  select count(*) filter (where saldo > 0.01), count(*)
    into v_com_saldo, v_titulos
    from public.v_titulos_receber
   where project_id = p_project_id and situacao <> 'cancelado';

  if v_titulos > 0 and v_com_saldo = 0 then
    update public.projects
       set execution_status = 'pago'
     where id = p_project_id and execution_status is distinct from 'pago';
    return true;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- fn_allocate_recebimento
-- ---------------------------------------------------------------------
create or replace function public.fn_allocate_recebimento(
  p_recebimento_id uuid,
  p_alocacoes      jsonb,          -- [{"titulo_id":"uuid","valor":1500.00}, ...]
  p_origem_ref     text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_rec        public.receipts%rowtype;
  v_item       jsonb;
  v_titulo_id  uuid;
  v_valor      numeric;
  v_inv        public.invoices%rowtype;
  v_proj       public.projects%rowtype;
  v_saldo      numeric;
  v_nao_aloc   numeric;
  v_ja         boolean;
  v_result     jsonb := '[]'::jsonb;
  v_quitados   jsonb := '[]'::jsonb;
  v_total      numeric := 0;
begin
  -- Trava a linha: duas alocações simultâneas não podem estourar o recebimento
  select * into v_rec from public.receipts where id = p_recebimento_id for update;
  if not found then
    raise exception 'Recebimento % não encontrado.', p_recebimento_id;
  end if;
  if v_rec.valor < 0 then
    raise exception 'Recebimento % é um estorno (valor negativo). Estorno não se aloca.', p_recebimento_id;
  end if;

  select v_rec.valor - coalesce(sum(ra.valor), 0) into v_nao_aloc
    from public.receipt_allocations ra where ra.receipt_id = p_recebimento_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_alocacoes, '[]'::jsonb))
  loop
    v_titulo_id := (v_item->>'titulo_id')::uuid;
    v_valor     := (v_item->>'valor')::numeric;

    if v_valor is null or v_valor <= 0 then
      raise exception 'Valor de alocação deve ser maior que zero (título %).', v_titulo_id;
    end if;

    -- Idempotência: um recebimento aloca no máximo uma vez por título
    select exists (
      select 1 from public.receipt_allocations
       where receipt_id = p_recebimento_id and invoice_id = v_titulo_id and valor > 0
    ) into v_ja;

    if v_ja then
      v_result := v_result || jsonb_build_array(
        jsonb_build_object('titulo_id', v_titulo_id, 'ja_alocado', true));
      continue;
    end if;

    select * into v_inv from public.invoices where id = v_titulo_id for update;
    if not found then
      raise exception 'Título % não encontrado.', v_titulo_id;
    end if;
    if v_inv.status = 'cancelada' then
      raise exception 'Título % está cancelado e não recebe alocação.', v_titulo_id;
    end if;

    select * into v_proj from public.projects where id = v_inv.project_id;

    -- Regra da casa: dinheiro do cliente só abate título do próprio cliente
    if v_proj.client_id is distinct from v_rec.client_id then
      raise exception
        'Título % pertence a outro cliente. Recebimento é do cliente %; não se abate título de terceiro.',
        v_titulo_id, v_rec.client_id;
    end if;

    -- Regra da casa: nunca misturar os dois CNPJs
    if v_inv.empresa_faturadora is distinct from v_rec.empresa_recebedora then
      raise exception
        'Empresa não bate: o título foi emitido por % e o dinheiro entrou em %. Confira em qual PJ o crédito caiu.',
        v_inv.empresa_faturadora, v_rec.empresa_recebedora;
    end if;

    select saldo into v_saldo from public.v_titulos_receber where titulo_id = v_titulo_id;

    if v_valor > v_saldo + 0.01 then
      raise exception
        'Alocação de % excede o saldo do título % (saldo %). Aloque no máximo o saldo; o resto fica como crédito do cliente.',
        v_valor, coalesce(v_inv.nf_numero, v_titulo_id::text), v_saldo;
    end if;

    if v_valor > v_nao_aloc + 0.01 then
      raise exception
        'Alocação de % excede o que resta do recebimento (disponível %). O dinheiro não estica.',
        v_valor, v_nao_aloc;
    end if;

    insert into public.receipt_allocations (receipt_id, invoice_id, valor, origem_ref, allocated_by_id)
    values (p_recebimento_id, v_titulo_id, v_valor, p_origem_ref, auth.uid());

    v_nao_aloc := v_nao_aloc - v_valor;
    v_total    := v_total + v_valor;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'titulo_id', v_titulo_id, 'ja_alocado', false,
      'nf_numero', v_inv.nf_numero, 'projeto', v_proj.codigo,
      'saldo_anterior', v_saldo, 'alocado', v_valor, 'saldo_atual', v_saldo - v_valor,
      'situacao', case when v_saldo - v_valor <= 0.01 then 'quitado' else 'parcial' end));

    if public.fn_recalc_project_paid(v_proj.id) then
      v_quitados := v_quitados || jsonb_build_array(v_proj.codigo);
    end if;
  end loop;

  perform public.log_event(
    'recebimento.allocated', 'receipts', p_recebimento_id,
    jsonb_build_object('alocado_nesta_chamada', v_total, 'credito_restante', v_nao_aloc,
                       'titulos', v_result),
    jsonb_build_object('canal','mcp','ferramenta','allocate_recebimento','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'recebimento_id', p_recebimento_id,
    'valor_recebimento', v_rec.valor,
    'alocado_nesta_chamada', v_total,
    'credito_disponivel', v_nao_aloc,
    'titulos', v_result,
    'projetos_quitados', v_quitados);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_register_recebimento
-- ---------------------------------------------------------------------
create or replace function public.fn_register_recebimento(
  p_cliente_id           uuid,
  p_valor                numeric,
  p_data_recebimento     date,
  p_referencia_pagamento text,
  p_empresa_recebedora   public.empresa_faturadora_enum,
  p_alocacoes            jsonb default '[]'::jsonb,
  p_conta                text default null,
  p_origem_ref           text default null,
  p_observacoes          text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_exist  public.receipts%rowtype;
  v_cli    public.clients%rowtype;
  v_id     uuid;
  v_aloc   jsonb;
begin
  if coalesce(trim(p_referencia_pagamento),'') = '' then
    raise exception 'referencia_pagamento é obrigatória (linha do extrato ou identificador do comprovante). É ela que impede dupla baixa.';
  end if;
  if p_data_recebimento is null then
    raise exception 'data_recebimento é obrigatória. Não inventar data.';
  end if;
  if p_data_recebimento > current_date then
    raise exception 'data_recebimento no futuro (%). O sistema registra dinheiro que já entrou.', p_data_recebimento;
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'valor deve ser maior que zero. Estorno não entra por aqui — é decisão humana pela tela.';
  end if;

  -- Idempotência e trava de dupla baixa: a mesma linha de extrato não entra duas vezes
  select * into v_exist from public.receipts where referencia_pagamento = p_referencia_pagamento;
  if found then
    return jsonb_build_object('criado', false, 'motivo', 'referencia_ja_registrada',
      'recebimento_id', v_exist.id, 'valor', v_exist.valor,
      'data_recebimento', v_exist.data_recebimento);
  end if;

  -- CLIENTE é o centro: dinheiro sem dono não entra
  select * into v_cli from public.clients where id = p_cliente_id;
  if not found then
    raise exception 'Cliente % não encontrado. Recebimento sem cliente não é registrável.', p_cliente_id;
  end if;

  insert into public.receipts (
    client_id, empresa_recebedora, data_recebimento, valor,
    referencia_pagamento, conta, origem_ref, observacoes, created_by_id
  ) values (
    p_cliente_id, p_empresa_recebedora, p_data_recebimento, p_valor,
    p_referencia_pagamento, p_conta, p_origem_ref, p_observacoes, auth.uid()
  ) returning id into v_id;

  perform public.log_event(
    'recebimento.created', 'receipts', v_id,
    jsonb_build_object('cliente', v_cli.name, 'valor', p_valor,
                       'data_recebimento', p_data_recebimento,
                       'empresa_recebedora', p_empresa_recebedora,
                       'referencia', p_referencia_pagamento, 'conta', p_conta),
    jsonb_build_object('canal','mcp','ferramenta','register_recebimento','origem_ref', p_origem_ref)
  );

  -- Alocações são opcionais. Sem elas, o dinheiro fica como CRÉDITO do cliente
  -- (adiantamento) — que é um estado válido, não um erro.
  v_aloc := public.fn_allocate_recebimento(v_id, coalesce(p_alocacoes,'[]'::jsonb), p_origem_ref);

  return jsonb_build_object(
    'criado', true,
    'recebimento_id', v_id,
    'cliente', v_cli.name,
    'empresa_recebedora', p_empresa_recebedora,
    'valor', p_valor,
    'data_recebimento', p_data_recebimento,
    'alocado', v_aloc->'alocado_nesta_chamada',
    'credito_gerado', v_aloc->'credito_disponivel',
    'titulos', v_aloc->'titulos',
    'projetos_quitados', v_aloc->'projetos_quitados',
    'dica', case when (v_aloc->>'credito_disponivel')::numeric > 0.01
                 then 'Sobrou crédito não alocado para este cliente (adiantamento). Quando a nota sair, use allocate_recebimento.'
                 else null end);
end;
$$;

-- ---------------------------------------------------------------------
-- fn_update_execution_status
-- ---------------------------------------------------------------------
create or replace function public.fn_update_execution_status(
  p_projeto_codigo text,
  p_novo_status    public.execution_status,
  p_data_efetiva   date default null,
  p_motivo         text default null,
  p_origem_ref     text default null,
  p_recarga        boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj  public.projects%rowtype;
  v_data  date;
  v_pos_old int;
  v_pos_new int;
begin
  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  if v_proj.execution_status = p_novo_status then
    return jsonb_build_object('sem_alteracao', true, 'projeto', v_proj.codigo, 'status', v_proj.execution_status);
  end if;

  -- Política: faturamento e pago são derivados do financeiro, não se digitam aqui
  if p_novo_status in ('faturamento','pago') then
    raise exception
      'Status % é consequência do módulo Financeiro: use create_titulo (faturamento) ou register_recebimento (pago — o projeto quita sozinho quando nenhum título tem saldo).', p_novo_status;
  end if;

  v_pos_old := array_position(enum_range(null::public.execution_status), v_proj.execution_status);
  v_pos_new := array_position(enum_range(null::public.execution_status), p_novo_status);

  -- Política: voltar atrás é correção e exige motivo registrado
  if v_pos_new < v_pos_old and coalesce(trim(p_motivo),'') = '' then
    raise exception 'Retrocesso de % para % é correção e exige motivo.', v_proj.execution_status, p_novo_status;
  end if;

  v_data := coalesce(p_data_efetiva, current_date);
  if v_data > current_date then
    raise exception 'data_efetiva no futuro (%). O sistema registra fato ocorrido.', v_data;
  end if;

  if p_recarga then perform set_config('ag.backfill','on',true); end if;

  update public.projects
     set execution_status  = p_novo_status,
         field_started_at   = case when p_novo_status = 'em_campo'        then coalesce(field_started_at,  v_data) else field_started_at  end,
         field_completed_at = case when p_novo_status = 'campo_concluido' then coalesce(field_completed_at, v_data) else field_completed_at end,
         delivered_at       = case when p_novo_status = 'entregue'        then coalesce(delivered_at,      v_data) else delivered_at      end
   where id = v_proj.id;

  if p_recarga then perform set_config('ag.backfill','off',true); end if;

  insert into public.project_status_history (project_id, from_status, to_status, changed_by_id, modulo, notes)
  values (v_proj.id, v_proj.execution_status::text, p_novo_status::text, auth.uid(), 'mcp', p_motivo);

  perform public.log_event(
    'project.execution_status_changed', 'projects', v_proj.id,
    jsonb_build_object('de', v_proj.execution_status, 'para', p_novo_status,
                       'data_efetiva', v_data, 'motivo', p_motivo,
                       'retrocesso', (v_pos_new < v_pos_old)),
    jsonb_build_object('canal','mcp','ferramenta','update_execution_status','origem_ref', p_origem_ref,'recarga', p_recarga)
  );

  return jsonb_build_object('sem_alteracao', false, 'projeto', v_proj.codigo, 'nome', v_proj.name,
    'de', v_proj.execution_status, 'para', p_novo_status, 'data_efetiva', v_data,
    'retrocesso', (v_pos_new < v_pos_old));
end;
$$;