-- =============================================================================
-- ADR-052 — Projeto sem contrapartida financeira (doação / cortesia)
-- Data: 2026-08-19
-- Destino: supabase/migrations/20260819120000_adr052_isencao_faturamento.sql
--
-- Caso de origem: 2026-HCA-001 (Henrique Camara), entregue 30/04/2026, alerta
-- entrega_concluida 3c83c8db-d49d-431b-a439-a8865840f70d impossível de fechar.
--
-- !!! PASSO 0 OBRIGATÓRIO ANTES DE APLICAR !!!
-- Este arquivo faz `create or replace` em fn_on_status_change e fn_resolve_alert.
-- O repo NÃO é fonte de verdade do schema (ver docs/arquitetura/INVENTARIO_DERIVA_SCHEMA.md).
-- Dumpe os corpos reais em produção e faça o diff contra as seções 3 e 4 abaixo:
--
--   select p.proname, pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('fn_on_status_change','fn_resolve_alert','fn_update_project');
--
-- Divergiu? Corrija ESTE arquivo antes de aplicar. Não aplique e conserte depois.
-- =============================================================================

begin;

-- =============================================================================
-- 1. COLUNAS E DOMÍNIO
-- =============================================================================

-- 1.1 Trilha de autorização da isenção.
--     Estado CORRENTE da decisão. O histórico continua em event_log.
alter table public.projects
  add column if not exists isencao_motivo         text,
  add column if not exists isencao_autorizada_por uuid,
  add column if not exists isencao_autorizada_em  timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_isencao_autorizada_por_fkey'
  ) then
    alter table public.projects
      add constraint projects_isencao_autorizada_por_fkey
      foreign key (isencao_autorizada_por) references public.profiles(id);
  end if;
end $$;

comment on column public.projects.isencao_motivo is
  'ADR-052. Por que o projeto não gera faturamento. Obrigatório (>=10 chars) quando billing_type = sem_faturamento.';
comment on column public.projects.isencao_autorizada_por is
  'ADR-052. Quem autorizou a isenção. Só master/diretor. Gravado por fn_isentar_faturamento_projeto.';
comment on column public.projects.isencao_autorizada_em is
  'ADR-052. Quando a isenção foi autorizada.';

-- 1.2 Domínio de billing_type. NOT VALID: obriga escrita nova, preserva linha legada.
--     Não vira enum PG de propósito — billing_type não tem ordem (ao contrário de
--     execution_status, cuja ordem o código usa em array_position/enum_range).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_projects_billing_type') then
    alter table public.projects
      add constraint ck_projects_billing_type check (
        billing_type is null or billing_type in (
          'entrega_nf',
          'entrega_recibo',
          'medicao_mensal',
          'sem_faturamento',   -- ADR-052: doação / cortesia
          'fixo_mensal',
          'sem_documento',     -- LEGADO — ambíguo, reclassificar
          'misto'              -- LEGADO — ambíguo, reclassificar
        )
      ) not valid;
  end if;
end $$;

comment on column public.projects.billing_type is
  'Política de faturamento do projeto. entrega_nf | entrega_recibo | medicao_mensal | sem_faturamento (ADR-052) | fixo_mensal | sem_documento (legado) | misto (legado). Interpretado por fn_politica_documento_entrega.';

-- 1.3 Isenção justificada — BICONDICIONAL, nos dois sentidos:
--     sem_faturamento sem motivo/autor => recusado (não existe doação anônima);
--     motivo preenchido com outro billing_type => recusado (reverter obriga a limpar).
--     Entra VALIDADA: sem_faturamento é valor novo, nenhuma linha pode violar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_projects_isencao_coerente') then
    alter table public.projects
      add constraint ck_projects_isencao_coerente check (
        (coalesce(billing_type,'') = 'sem_faturamento')
        =
        (coalesce(length(btrim(isencao_motivo)),0) >= 10
         and isencao_autorizada_por is not null
         and isencao_autorizada_em  is not null)
      );
  end if;
end $$;

create index if not exists idx_projects_isentos
  on public.projects (isencao_autorizada_em desc)
  where billing_type = 'sem_faturamento';


-- =============================================================================
-- 2. POLÍTICA — a decisão sai de dentro do trigger e vira função nomeada
-- =============================================================================
-- Uma pergunta: "a ENTREGA deste projeto exige documento?"
-- Chamada pelo PRODUTOR do alerta (fn_on_status_change) e pelo CONSUMIDOR
-- (fn_resolve_alert). Fonte única — os dois não podem mais divergir.
--
-- Retorna classificação, não booleano: a pergunta tem quatro respostas de negócio.
-- O rótulo em português é apresentação e fica no trigger.

create or replace function public.fn_politica_documento_entrega(p_billing_type text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case coalesce(p_billing_type, '')
    when 'entrega_nf'      then 'nf'
    when 'entrega_recibo'  then 'recibo'
    when 'medicao_mensal'  then 'nenhum'          -- documento nasce da medição
    when 'fixo_mensal'     then 'nenhum'          -- recorrente (RECURRING_BILLING_TYPES)
    when 'sem_faturamento' then 'nenhum'          -- ADR-052: doação / cortesia
    when 'sem_documento'   then 'nenhum'          -- LEGADO
    else 'indefinido'                             -- null, 'misto', desconhecido
  end;
$$;

comment on function public.fn_politica_documento_entrega(text) is
  'ADR-052. Política única: a entrega deste billing_type exige documento? nf | recibo | nenhum | indefinido. Chamada por fn_on_status_change (cria alerta) e fn_resolve_alert (baixa alerta). Não duplicar esta regra em outro lugar.';

grant execute on function public.fn_politica_documento_entrega(text) to authenticated, service_role;


-- =============================================================================
-- 3. TRIGGER — fn_on_status_change passa a consultar a política
-- =============================================================================
-- !!! DIFF CONTRA PRODUÇÃO ANTES DE APLICAR (Passo 0) !!!
-- Base: supabase/migrations/20260811143000_5458ee17-d9e3-4f20-a8e6-65218169e141.sql
-- Única mudança semântica: o CASE inline do bloco "Entregue" vira chamada à política.
-- Comportamento IDÊNTICO para entrega_nf / entrega_recibo / medicao_mensal / null.

create or replace function public.fn_on_status_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid       uuid;
  v_politica  text;
  v_doc_label text;
  v_backfill  boolean;
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

    -- ADR-052: a decisão mora em fn_politica_documento_entrega, não neste CASE.
    v_politica := public.fn_politica_documento_entrega(NEW.billing_type);

    v_doc_label := case v_politica
      when 'nf'         then 'Emitir NF'
      when 'recibo'     then 'Emitir Recibo'
      when 'indefinido' then 'Verificar documento'
      else null   -- 'nenhum' => doação, medição mensal, recorrente: não gera alerta
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


-- =============================================================================
-- 4. BAIXA DE ALERTA — fn_resolve_alert consulta a MESMA política
-- =============================================================================
-- !!! DIFF CONTRA PRODUÇÃO ANTES DE APLICAR (Passo 0) !!!
-- Base: supabase/migrations/20260811150100_70ec944d-fbb0-4aba-840f-3c92993fdb5e.sql (vigente, com papel rh)
--
-- Decisão #62 do ADR-042 preservada: alerta que pede documento continua exigindo
-- o documento. O que muda: ele pergunta ANTES se o projeto pede documento.
-- Regra da saída nomeada: nenhum ramo termina sem dizer o que fazer.

create or replace function public.fn_resolve_alert(
  p_alert_id   uuid,
  p_resolucao  text,
  p_origem_ref text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_alert      public.alerts%rowtype;
  v_proj       public.projects%rowtype;
  v_roles      public.app_role[];
  v_politica   text;
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
    when 'rh'           then array['master','diretor','financeiro','rh']::public.app_role[]
    when 'sala_tecnica' then array['master','diretor','sala_tecnica']::public.app_role[]
    when 'diretoria'    then array['master','diretor']::public.app_role[]
    else array['master','diretor','operacional','sala_tecnica','comercial','financeiro']::public.app_role[]
  end;

  if not public.has_any_role(auth.uid(), v_roles) then
    raise exception 'Sem permissão: alerta destinado a % exige papel compatível.', v_alert.recipient;
  end if;

  -- Política: alerta de emissão de documento exige o documento (Decisão #62),
  -- MAS só se o projeto realmente exige documento (ADR-052).
  if v_alert.alert_type = 'entrega_concluida' and v_alert.reference_type = 'project' then

    select * into v_proj from public.projects where id = v_alert.reference_id;

    if not found then
      -- Projeto sumiu: alerta órfão. Baixa manual liberada.
      v_politica := 'nenhum';
    else
      v_politica := public.fn_politica_documento_entrega(v_proj.billing_type);
    end if;

    if v_politica = 'indefinido' then
      raise exception
        'Projeto % está sem política de faturamento definida (billing_type = %). Defina com update_project, ou registre a isenção com isentar_faturamento, antes de baixar este alerta.',
        coalesce(v_proj.codigo,'?'), coalesce(v_proj.billing_type,'nulo');
    end if;

    if v_politica in ('nf','recibo') then
      select exists (
        select 1 from public.invoices i
        where i.project_id = v_alert.reference_id and i.status <> 'cancelada'
      ) into v_tem_titulo;

      if not v_tem_titulo then
        raise exception
          'Este alerta pede emissão de documento e não existe título para o projeto. Registre com create_titulo — o título resolve o alerta sozinho. Se o serviço foi doação/cortesia, use isentar_faturamento e depois baixe este alerta.';
      end if;
    end if;

    -- v_politica = 'nenhum' => baixa manual liberada, com a resolucao já obrigatória acima.
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
    jsonb_build_object(
      'alert_type', v_alert.alert_type,
      'recipient', v_alert.recipient,
      'resolucao', p_resolucao,
      'politica_documento', v_politica
    ),
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


-- =============================================================================
-- 5. ENGINE — isentar projeto de faturamento (doação / cortesia)
-- =============================================================================
-- Renunciar receita é ato de diretoria, não edição de campo. Por isso NÃO passa
-- por fn_update_project: tem autor, motivo, pré-condição e evento próprio.

create or replace function public.fn_isentar_faturamento_projeto(
  p_projeto_codigo text,
  p_motivo         text,
  p_origem_ref     text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj       public.projects%rowtype;
  v_tem_titulo boolean;
  v_anterior   text;
  v_alertas    integer;
begin
  -- 1. Autorização: quem assina a renúncia é quem é dono do dinheiro renunciado.
  --    financeiro NÃO entra: registra o que aconteceu, não decide deixar de cobrar.
  if not public.has_any_role(auth.uid(), array['master','diretor']::public.app_role[]) then
    raise exception 'Isentar projeto de faturamento é decisão de diretoria. Exige papel master ou diretor.';
  end if;

  -- 2. Motivo obrigatório e substantivo
  if coalesce(length(btrim(p_motivo)),0) < 10 then
    raise exception 'Informe o motivo da isenção (mínimo 10 caracteres). Ex.: "Doação institucional autorizada pela diretoria em 19/08/2026".';
  end if;

  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  -- 3. Idempotente: já isento devolve objeto, não erro
  if coalesce(v_proj.billing_type,'') = 'sem_faturamento' then
    return jsonb_build_object(
      'isentado', false,
      'motivo', 'ja_isento',
      'projeto_codigo', v_proj.codigo,
      'isencao_motivo', v_proj.isencao_motivo,
      'isencao_autorizada_em', v_proj.isencao_autorizada_em
    );
  end if;

  -- 4. Não se doa o que já foi faturado
  select exists (
    select 1 from public.invoices i
    where i.project_id = v_proj.id and i.status <> 'cancelada'
  ) into v_tem_titulo;

  if v_tem_titulo then
    raise exception 'Projeto % já tem título emitido. Cancele o título antes de registrar a isenção — doação não convive com documento fiscal.', v_proj.codigo;
  end if;

  v_anterior := v_proj.billing_type;

  update public.projects
     set billing_type           = 'sem_faturamento',
         isencao_motivo         = btrim(p_motivo),
         isencao_autorizada_por = auth.uid(),
         isencao_autorizada_em  = now()
   where id = v_proj.id;

  select count(*) into v_alertas
    from public.alerts a
   where a.alert_type = 'entrega_concluida'
     and a.reference_type = 'project'
     and a.reference_id = v_proj.id
     and a.resolved = false;

  -- valor_renunciado no evento: é o que torna respondível "quanto a AG doou em 2026".
  perform public.log_event(
    'project.faturamento_isentado', 'projects', v_proj.id,
    jsonb_build_object(
      'billing_type_anterior', v_anterior,
      'motivo', btrim(p_motivo),
      'valor_renunciado', v_proj.contract_value,
      'cliente_id', v_proj.client_id,
      'entregue_em', v_proj.delivered_at,
      'empresa_faturadora', v_proj.empresa_faturadora
    ),
    jsonb_build_object('canal','mcp','ferramenta','isentar_faturamento','origem_ref', p_origem_ref)
  );

  -- A isenção NÃO baixa o alerta. Isentar é decidir não fazer, não é cumprir.
  -- O alerta morre por ato nomeado (resolve_alert), nunca como efeito colateral.
  return jsonb_build_object(
    'isentado', true,
    'projeto_codigo', v_proj.codigo,
    'projeto_nome', v_proj.name,
    'billing_type_anterior', v_anterior,
    'valor_renunciado', v_proj.contract_value,
    'alertas_pendentes', v_alertas,
    'proximo_passo',
      case when v_alertas > 0
        then 'A isenção não baixa o alerta. Use resolve_alert informando a resolução.'
        else 'Nenhum alerta de emissão pendente para este projeto.'
      end
  );
end;
$$;

comment on function public.fn_isentar_faturamento_projeto(text, text, text) is
  'ADR-052. Marca projeto como doação/cortesia (billing_type = sem_faturamento). Só master/diretor. Motivo obrigatório. Recusa se já houver título. NÃO baixa alerta — use resolve_alert depois.';

grant execute on function public.fn_isentar_faturamento_projeto(text, text, text) to authenticated, service_role;


-- =============================================================================
-- 6. ENGINE — reverter a isenção
-- =============================================================================
-- Sem isto, um clique errado é permanente e a ck_projects_isencao_coerente trava
-- o projeto. Não é exposta como ferramenta MCP nesta onda (menos superfície).

create or replace function public.fn_reverter_isencao_faturamento(
  p_projeto_codigo    text,
  p_novo_billing_type text,
  p_motivo            text,
  p_origem_ref        text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj     public.projects%rowtype;
  v_isencao  text;
begin
  if not public.has_any_role(auth.uid(), array['master','diretor']::public.app_role[]) then
    raise exception 'Reverter isenção de faturamento é decisão de diretoria. Exige papel master ou diretor.';
  end if;

  if coalesce(length(btrim(p_motivo)),0) < 10 then
    raise exception 'Informe o motivo da reversão (mínimo 10 caracteres).';
  end if;

  if p_novo_billing_type not in ('entrega_nf','entrega_recibo','medicao_mensal','fixo_mensal') then
    raise exception 'novo_billing_type inválido (%). Use entrega_nf, entrega_recibo, medicao_mensal ou fixo_mensal.', p_novo_billing_type;
  end if;

  select * into v_proj from public.projects where codigo = p_projeto_codigo;
  if not found then
    raise exception 'Projeto % não encontrado.', p_projeto_codigo;
  end if;

  if coalesce(v_proj.billing_type,'') <> 'sem_faturamento' then
    return jsonb_build_object(
      'revertido', false,
      'motivo', 'nao_estava_isento',
      'projeto_codigo', v_proj.codigo,
      'billing_type', v_proj.billing_type
    );
  end if;

  v_isencao := v_proj.isencao_motivo;

  update public.projects
     set billing_type           = p_novo_billing_type,
         isencao_motivo         = null,
         isencao_autorizada_por = null,
         isencao_autorizada_em  = null
   where id = v_proj.id;

  perform public.log_event(
    'project.isencao_revertida', 'projects', v_proj.id,
    jsonb_build_object(
      'isencao_motivo_anterior', v_isencao,
      'isencao_autorizada_por_anterior', v_proj.isencao_autorizada_por,
      'novo_billing_type', p_novo_billing_type,
      'motivo', btrim(p_motivo)
    ),
    jsonb_build_object('canal','sql','ferramenta','reverter_isencao_faturamento','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'revertido', true,
    'projeto_codigo', v_proj.codigo,
    'novo_billing_type', p_novo_billing_type,
    'proximo_passo', 'Projeto voltou a exigir documento na entrega. Se já foi entregue, registre o título com create_titulo.'
  );
end;
$$;

comment on function public.fn_reverter_isencao_faturamento(text, text, text, text) is
  'ADR-052. Reverte isenção de faturamento. Só master/diretor, motivo obrigatório. Limpa as colunas de isenção (exigido pela ck_projects_isencao_coerente).';

grant execute on function public.fn_reverter_isencao_faturamento(text, text, text, text) to authenticated, service_role;


-- =============================================================================
-- 7. LEITURA — isenção deixa de ser write-only
-- =============================================================================
-- Responde: quanto a AG doou, para quem, autorizado por quem, quando.

create or replace view public.v_projetos_isentos as
select
  p.id                     as project_id,
  p.codigo                 as projeto_codigo,
  p.name                   as projeto_nome,
  p.client_id,
  c.name                   as cliente,
  p.empresa_faturadora,
  p.contract_value         as valor_renunciado,
  p.delivered_at           as entregue_em,
  p.isencao_motivo,
  p.isencao_autorizada_por,
  pr.full_name             as autorizada_por_nome,
  p.isencao_autorizada_em
from public.projects p
left join public.clients  c  on c.id  = p.client_id
left join public.profiles pr on pr.id = p.isencao_autorizada_por
where p.billing_type = 'sem_faturamento';

-- Sem isto a view roda como o DONO e a RLS das tabelas de baixo é ignorada.
alter view public.v_projetos_isentos set (security_invoker = on);

comment on view public.v_projetos_isentos is
  'ADR-052. Projetos doados/cortesia, com valor renunciado e trilha de autorização.';

grant select on public.v_projetos_isentos to authenticated;

commit;


-- =============================================================================
-- PASSO 3 (fora desta migration) — emenda cirúrgica em fn_update_project
-- =============================================================================
-- NÃO reproduzido aqui de propósito: o corpo em produção pode divergir do repo e
-- um `create or replace` reconstruído a partir de fragmentos apagaria código vivo.
-- Aplicar sobre o corpo dumpado no Passo 0, logo após a validação de billing_type:
--
--   if p_billing_type = 'sem_faturamento' then
--     raise exception 'Isenção de faturamento não se define por update_project. Use isentar_faturamento — ela exige motivo e autorização da diretoria.';
--   end if;
--
--   if coalesce(v_proj.billing_type,'') = 'sem_faturamento'
--      and p_billing_type is not null
--      and p_billing_type <> 'sem_faturamento' then
--     raise exception 'Projeto % está isento de faturamento por decisão registrada. Reverta com fn_reverter_isencao_faturamento antes de mudar o billing_type.', v_proj.codigo;
--   end if;
--
-- Nota: a ck_projects_isencao_coerente JÁ protege o banco sem esta emenda — a
-- transação falha na constraint. A emenda melhora a mensagem, não a segurança.
-- =============================================================================
