-- =====================================================================
-- ADR-045 — Ferramentas MCP de Cadastro (Onda 3 do ADR-042)
-- Engines: fn_update_project, fn_update_client, fn_create_client, fn_create_project
-- (merge_clients NÃO entra aqui — fica para a ADR-046)
--
-- Padrão da casa: SECURITY INVOKER, set search_path to 'public', returns jsonb
-- (snapshot + message humana), auditoria via public.log_event(canal='mcp'),
-- aceita p_recarga. Idempotente. SEM DROP/DELETE/RENAME de tabela/coluna/dado.
--
-- Índices únicos ADITIVOS: ux_clients_codigo, ux_clients_cnpj (parcial),
-- ux_projects_codigo. Pré-voo 11/08: zero colisão — sobem limpos.
--
-- RLS: as 4 funções fazem SELECT ... FOR UPDATE + UPDATE/INSERT em
-- projects/clients. A lição do bug de receipts (11/08) é que o papel
-- invocador precisa de política de UPDATE existente ANTES, senão o
-- FOR UPDATE some a linha e a transação faz rollback. Este bloco garante
-- isso de forma idempotente e ADITIVA (não derruba política existente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers determinísticos (sem dependência de extensão)
-- ---------------------------------------------------------------------

-- Normalização de nome para dedup anti-POLIMIX: minúsculo, sem acento,
-- sem pontuação, espaços colapsados. translate() em vez de unaccent para
-- não depender de extensão instalada.
create or replace function public.fn_normalize_name(p_txt text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select nullif(
    trim(regexp_replace(
      regexp_replace(
        lower(translate(coalesce(p_txt,''),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9 ]', ' ', 'g'),   -- pontuação vira espaço
      '\s+', ' ', 'g')),           -- colapsa espaços
    '');
$$;

comment on function public.fn_normalize_name is
  'ADR-045: chave de dedup de nome (minúsculo/sem acento/sem pontuação/espaço único). Base do freio anti-POLIMIX.';

-- Validação de CNPJ com dígitos verificadores. Retorna os 14 dígitos
-- (só números) se válido; null se inválido/ausente.
create or replace function public.fn_cnpj_digits(p_cnpj text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v_d   text;
  v_i   int;
  v_sum int;
  v_dv1 int;
  v_dv2 int;
  v_pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
begin
  if p_cnpj is null then return null; end if;
  v_d := regexp_replace(p_cnpj, '\D', '', 'g');
  if length(v_d) <> 14 then return null; end if;
  -- rejeita repetição total (00000000000000, 11111111111111, ...)
  if v_d ~ ('^(' || substring(v_d,1,1) || '){14}$') then return null; end if;

  v_sum := 0;
  for v_i in 1..12 loop
    v_sum := v_sum + (substring(v_d, v_i, 1))::int * v_pesos1[v_i];
  end loop;
  v_dv1 := v_sum % 11;
  v_dv1 := case when v_dv1 < 2 then 0 else 11 - v_dv1 end;
  if v_dv1 <> substring(v_d, 13, 1)::int then return null; end if;

  v_sum := 0;
  for v_i in 1..13 loop
    v_sum := v_sum + (substring(v_d, v_i, 1))::int * v_pesos2[v_i];
  end loop;
  v_dv2 := v_sum % 11;
  v_dv2 := case when v_dv2 < 2 then 0 else 11 - v_dv2 end;
  if v_dv2 <> substring(v_d, 14, 1)::int then return null; end if;

  return v_d;
end;
$$;

comment on function public.fn_cnpj_digits is
  'ADR-045: valida CNPJ pelos dígitos verificadores. Retorna os 14 dígitos se válido, null se inválido. Comparação de identidade fiscal é sempre por dígitos.';

-- ---------------------------------------------------------------------
-- 1. Índices únicos ADITIVOS (idempotentes)
--    Pré-voo 11/08: zero colisão em clients.codigo e projects.codigo.
--    Guarda: aborta com mensagem LEGÍVEL se houver duplicata (em vez de
--    deixar o CREATE UNIQUE INDEX falhar com erro críptico e travar a
--    migration inteira). clients.cnpj NÃO foi pré-voado — esta é a rede.
-- ---------------------------------------------------------------------
do $$
declare v_dup text;
begin
  select string_agg(codigo || ' (' || n || 'x)', ', ') into v_dup
  from (select codigo, count(*) n from public.clients
        where codigo is not null group by codigo having count(*) > 1) d;
  if v_dup is not null then
    raise exception 'ADR-045 abortado: clients.codigo duplicado (%). Resolver antes de subir ux_clients_codigo.', v_dup;
  end if;

  select string_agg(cnpj_norm || ' (' || n || 'x)', ', ') into v_dup
  from (select regexp_replace(cnpj,'\D','','g') cnpj_norm, count(*) n
        from public.clients where cnpj is not null
        group by regexp_replace(cnpj,'\D','','g') having count(*) > 1) d;
  if v_dup is not null then
    raise exception 'ADR-045 abortado: CNPJ duplicado em clients (%). Estes são candidatos a merge_clients (ADR-046); resolver antes de subir ux_clients_cnpj.', v_dup;
  end if;

  select string_agg(codigo || ' (' || n || 'x)', ', ') into v_dup
  from (select codigo, count(*) n from public.projects
        where codigo is not null group by codigo having count(*) > 1) d;
  if v_dup is not null then
    raise exception 'ADR-045 abortado: projects.codigo duplicado (%). Resolver antes de subir ux_projects_codigo.', v_dup;
  end if;
end $$;

create unique index if not exists ux_clients_codigo
  on public.clients (codigo)
  where codigo is not null;

create unique index if not exists ux_clients_cnpj
  on public.clients (regexp_replace(cnpj, '\D', '', 'g'))
  where cnpj is not null;

create unique index if not exists ux_projects_codigo
  on public.projects (codigo)
  where codigo is not null;

-- ---------------------------------------------------------------------
-- 2. RLS — garantir política de INSERT/UPDATE para os papéis-alvo.
--    ADITIVO: usa guardas IF NOT EXISTS; não derruba nem altera política
--    existente. clients já tem políticas role-scoped (migration 20260810);
--    projects ainda tem a política ampla "Auth full access" (FOR ALL).
--    Estas políticas role-scoped tornam o requisito do FOR UPDATE explícito
--    e à prova de futuro (quando projects for endurecido como clients foi).
-- ---------------------------------------------------------------------
do $$
begin
  -- clients: INSERT (create_client → master/diretor/comercial;
  -- update_client/financeiro também gravam) — mantém o conjunto já vigente.
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='clients'
                   and policyname='adr045_clients_insert') then
    create policy adr045_clients_insert on public.clients
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','comercial','financeiro']::public.app_role[]));
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='clients'
                   and policyname='adr045_clients_update') then
    create policy adr045_clients_update on public.clients
      for update to authenticated
      using (public.has_any_role(auth.uid(),
        array['master','diretor','comercial','financeiro']::public.app_role[]))
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','comercial','financeiro']::public.app_role[]));
  end if;

  -- projects: INSERT (create_project → master/diretor/comercial) e
  -- UPDATE (update_project; FOR UPDATE de geração de seq/guarda).
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='projects'
                   and policyname='adr045_projects_insert') then
    create policy adr045_projects_insert on public.projects
      for insert to authenticated
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','comercial']::public.app_role[]));
  end if;

  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='projects'
                   and policyname='adr045_projects_update') then
    create policy adr045_projects_update on public.projects
      for update to authenticated
      using (public.has_any_role(auth.uid(),
        array['master','diretor','comercial','financeiro']::public.app_role[]))
      with check (public.has_any_role(auth.uid(),
        array['master','diretor','comercial','financeiro']::public.app_role[]));
  end if;
end $$;

-- =====================================================================
-- 3. Engines — SECURITY INVOKER (padrão ADR-042)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_update_client — tool update_client
--   Papel: master/diretor/comercial/financeiro
--   Recusas: inexistente; nenhum campo; CNPJ inválido; CNPJ/nome que já
--   pertence a outro cliente (aponta merge_clients); tipo fora de {pj,pf}.
-- ---------------------------------------------------------------------
create or replace function public.fn_update_client(
  p_client_id uuid,
  p_name      text default null,
  p_cnpj      text default null,
  p_tipo      text default null,
  p_segmento  text default null,
  p_recarga   boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_cli    public.clients%rowtype;
  v_cnpj   text;
  v_norm   text;
  v_outro  public.clients%rowtype;
  v_muda   boolean := false;
begin
  if not public.has_any_role(auth.uid(),
       array['master','diretor','comercial','financeiro']::public.app_role[]) then
    raise exception 'Sem permissão para editar cliente. Exige master, diretor, comercial ou financeiro.';
  end if;

  if p_name is null and p_cnpj is null and p_tipo is null and p_segmento is null then
    raise exception 'Nenhum campo para atualizar. Informe ao menos um de: name, cnpj, tipo, segmento.';
  end if;

  select * into v_cli from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente % não encontrado.', p_client_id;
  end if;

  if p_tipo is not null and lower(p_tipo) not in ('pj','pf') then
    raise exception 'tipo inválido (%). Use pj ou pf.', p_tipo;
  end if;

  -- CNPJ: valida e recusa colisão com OUTRO cliente
  if p_cnpj is not null and coalesce(trim(p_cnpj),'') <> '' then
    v_cnpj := public.fn_cnpj_digits(p_cnpj);
    if v_cnpj is null then
      raise exception 'CNPJ inválido (%). Confira os 14 dígitos e o dígito verificador.', p_cnpj;
    end if;
    select * into v_outro from public.clients
     where id <> p_client_id
       and cnpj is not null
       and regexp_replace(cnpj,'\D','','g') = v_cnpj
     limit 1;
    if found then
      raise exception 'CNPJ % já pertence ao cliente "%" (%). Se são o mesmo cliente, use merge_clients (ADR-046).',
        p_cnpj, v_outro.name, v_outro.id;
    end if;
  end if;

  -- Nome: recusa nome normalizado idêntico a OUTRO cliente
  if p_name is not null and coalesce(trim(p_name),'') <> '' then
    v_norm := public.fn_normalize_name(p_name);
    select * into v_outro from public.clients
     where id <> p_client_id
       and public.fn_normalize_name(name) = v_norm
     limit 1;
    if found then
      raise exception 'Já existe outro cliente com nome equivalente: "%" (%). Se são o mesmo, use merge_clients (ADR-046); se é filial, cadastre com parent_client_id e nome distinto.',
        v_outro.name, v_outro.id;
    end if;
  end if;

  update public.clients
     set name     = case when p_name     is not null and trim(p_name) <> ''     then p_name     else name     end,
         cnpj     = case when p_cnpj     is not null and trim(p_cnpj) <> ''     then p_cnpj     else cnpj     end,
         tipo     = case when p_tipo     is not null                            then lower(p_tipo) else tipo  end,
         segmento = case when p_segmento is not null                            then p_segmento else segmento end
   where id = p_client_id;
  get diagnostics v_muda = row_count;

  select * into v_cli from public.clients where id = p_client_id;

  perform public.log_event(
    'client.updated', 'clients', p_client_id,
    jsonb_build_object('name', v_cli.name, 'cnpj', v_cli.cnpj, 'tipo', v_cli.tipo,
                       'segmento', v_cli.segmento),
    jsonb_build_object('canal','mcp','ferramenta','update_client','recarga', p_recarga)
  );

  return jsonb_build_object(
    'atualizado', true, 'client_id', v_cli.id, 'codigo', v_cli.codigo,
    'name', v_cli.name, 'cnpj', v_cli.cnpj, 'tipo', v_cli.tipo, 'segmento', v_cli.segmento,
    'message', 'Cliente ' || v_cli.name || ' atualizado.');
end;
$$;

-- ---------------------------------------------------------------------
-- fn_create_client — tool create_client (coração anti-POLIMIX)
--   Papel: master/diretor/comercial
--   Recusas: nome vazio; CNPJ inválido; CNPJ já cadastrado; nome
--   normalizado equivalente (orienta parent_client_id); parent inexistente;
--   codigo fora de ^[A-Z]{3}$ ou já em uso; sem sigla livre derivável.
-- ---------------------------------------------------------------------
create or replace function public.fn_create_client(
  p_name            text,
  p_cnpj            text default null,
  p_tipo            text default null,
  p_segmento        text default null,
  p_codigo          text default null,
  p_parent_client_id uuid default null,
  p_recarga         boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_cnpj    text;
  v_norm    text;
  v_outro   public.clients%rowtype;
  v_parent  public.clients%rowtype;
  v_codigo  text;
  v_base    text;
  v_try     text;
  v_i       int;
  v_id      uuid;
  v_new     public.clients%rowtype;
begin
  if not public.has_any_role(auth.uid(),
       array['master','diretor','comercial']::public.app_role[]) then
    raise exception 'Sem permissão para criar cliente. Exige master, diretor ou comercial.';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Nome do cliente é obrigatório.';
  end if;

  if p_tipo is not null and lower(p_tipo) not in ('pj','pf') then
    raise exception 'tipo inválido (%). Use pj ou pf.', p_tipo;
  end if;

  -- CNPJ: valida e recusa duplicidade
  if p_cnpj is not null and trim(p_cnpj) <> '' then
    v_cnpj := public.fn_cnpj_digits(p_cnpj);
    if v_cnpj is null then
      raise exception 'CNPJ inválido (%). Confira os 14 dígitos e o dígito verificador.', p_cnpj;
    end if;
    select * into v_outro from public.clients
     where cnpj is not null and regexp_replace(cnpj,'\D','','g') = v_cnpj
     limit 1;
    if found then
      raise exception 'CNPJ % já cadastrado no cliente "%" (%). Não duplicar — use update_client ou merge_clients (ADR-046).',
        p_cnpj, v_outro.name, v_outro.id;
    end if;
  end if;

  -- Dedup por nome normalizado — o freio POLIMIX
  v_norm := public.fn_normalize_name(p_name);
  if v_norm is null then
    raise exception 'Nome do cliente é inválido (só pontuação/espaços).';
  end if;
  select * into v_outro from public.clients
   where public.fn_normalize_name(name) = v_norm
   limit 1;
  if found then
    raise exception 'Já existe cliente com nome equivalente: "%" (%). Se é o mesmo, não duplique; se é filial/SPE, cadastre com parent_client_id e um nome distinto (ex.: incluir a razão social da filial).',
      v_outro.name, v_outro.id;
  end if;

  -- Pai (matriz→filha / SPE do Grupo)
  if p_parent_client_id is not null then
    select * into v_parent from public.clients where id = p_parent_client_id;
    if not found then
      raise exception 'parent_client_id % não encontrado.', p_parent_client_id;
    end if;
  end if;

  -- Código (sigla 3 letras). Se informado, valida e checa uso.
  -- Se ausente, deriva das letras do nome e busca a primeira sigla livre.
  if p_codigo is not null and trim(p_codigo) <> '' then
    v_codigo := upper(trim(p_codigo));
    if v_codigo !~ '^[A-Z]{3}$' then
      raise exception 'codigo inválido (%). A sigla do cliente tem exatamente 3 letras (A-Z).', p_codigo;
    end if;
    if exists (select 1 from public.clients where codigo = v_codigo) then
      raise exception 'Sigla % já está em uso por outro cliente. Escolha outra ou deixe em branco para o sistema derivar.', v_codigo;
    end if;
  else
    v_base := regexp_replace(upper(translate(p_name,
                'áàâãäéèêëíìîïóòôõöúùûüçñ','AAAAAEEEEIIIIOOOOOUUUUCN')),
                '[^A-Z]','','g');
    if length(v_base) < 3 then
      raise exception 'Não foi possível derivar uma sigla de 3 letras do nome "%". Informe codigo manualmente.', p_name;
    end if;
    v_codigo := substring(v_base,1,3);
    if exists (select 1 from public.clients where codigo = v_codigo) then
      -- tenta 1ª+2ª+cada letra seguinte, depois combinações simples
      v_codigo := null;
      for v_i in 3..length(v_base) loop
        v_try := substring(v_base,1,2) || substring(v_base,v_i,1);
        if not exists (select 1 from public.clients where codigo = v_try) then
          v_codigo := v_try; exit;
        end if;
      end loop;
      if v_codigo is null then
        for v_i in 1..length(v_base)-2 loop
          v_try := substring(v_base,v_i,3);
          if not exists (select 1 from public.clients where codigo = v_try) then
            v_codigo := v_try; exit;
          end if;
        end loop;
      end if;
      if v_codigo is null then
        raise exception 'Sem sigla de 3 letras livre derivável de "%". Informe codigo manualmente.', p_name;
      end if;
    end if;
  end if;

  insert into public.clients (name, cnpj, tipo, segmento, codigo, parent_client_id, is_active)
  values (p_name, nullif(trim(coalesce(p_cnpj,'')),''),
          case when p_tipo is not null then lower(p_tipo) else null end,
          p_segmento, v_codigo, p_parent_client_id, true)
  returning id into v_id;

  select * into v_new from public.clients where id = v_id;

  perform public.log_event(
    'client.created', 'clients', v_id,
    jsonb_build_object('name', v_new.name, 'cnpj', v_new.cnpj, 'codigo', v_new.codigo,
                       'tipo', v_new.tipo, 'segmento', v_new.segmento,
                       'parent_client_id', v_new.parent_client_id),
    jsonb_build_object('canal','mcp','ferramenta','create_client','recarga', p_recarga)
  );

  return jsonb_build_object(
    'criado', true, 'client_id', v_new.id, 'codigo', v_new.codigo, 'name', v_new.name,
    'cnpj', v_new.cnpj, 'tipo', v_new.tipo, 'segmento', v_new.segmento,
    'parent_client_id', v_new.parent_client_id,
    'message', 'Cliente ' || v_new.name || ' criado com sigla ' || v_new.codigo || '.');
end;
$$;

-- ---------------------------------------------------------------------
-- fn_update_project — tool update_project
--   Papel: qualquer editor (master/diretor/comercial/financeiro).
--   Campo FISCAL (empresa_faturadora/cnpj_tomador): só master/diretor/financeiro.
--   Guarda fiscal: trocar empresa_faturadora exige motivo E bloqueia se já
--   houver título emitido. Guarda de magnitude: 0<valor<100 sem
--   permitir_valor_baixo recusa (o bug VIM 15,75).
-- ---------------------------------------------------------------------
create or replace function public.fn_update_project(
  p_project_id           uuid,
  p_empresa_faturadora   text default null,   -- ag_topografia | ag_cartografia
  p_contract_value       numeric default null,
  p_tipo_documento       text default null,   -- nota_fiscal | recibo
  p_billing_type         text default null,   -- entrega_nf | medicao_mensal | entrega_recibo
  p_cnpj_tomador         text default null,
  p_motivo               text default null,   -- OBRIGATÓRIO se mudar empresa_faturadora
  p_permitir_valor_baixo boolean default false,
  p_recarga              boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_proj      public.projects%rowtype;
  v_is_fiscal boolean;
  v_pode_fiscal boolean;
  v_cnpj      text;
  v_troca_emp boolean;
  v_tem_titulo boolean;
begin
  if not public.has_any_role(auth.uid(),
       array['master','diretor','comercial','financeiro']::public.app_role[]) then
    raise exception 'Sem permissão para editar projeto. Exige master, diretor, comercial ou financeiro.';
  end if;

  if p_empresa_faturadora is null and p_contract_value is null
     and p_tipo_documento is null and p_billing_type is null
     and p_cnpj_tomador is null then
    raise exception 'Nenhum campo para atualizar. Informe ao menos um de: empresa_faturadora, contract_value, tipo_documento, billing_type, cnpj_tomador.';
  end if;

  select * into v_proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Projeto % não encontrado.', p_project_id;
  end if;

  -- Campo fiscal exige papel fiscal
  v_is_fiscal := (p_empresa_faturadora is not null) or (p_cnpj_tomador is not null);
  if v_is_fiscal then
    v_pode_fiscal := public.has_any_role(auth.uid(),
      array['master','diretor','financeiro']::public.app_role[]);
    if not v_pode_fiscal then
      raise exception 'Campo fiscal (empresa_faturadora/cnpj_tomador) só pode ser alterado por master, diretor ou financeiro.';
    end if;
  end if;

  -- Empresa faturadora
  if p_empresa_faturadora is not null then
    if p_empresa_faturadora not in ('ag_topografia','ag_cartografia') then
      raise exception 'empresa_faturadora inválida (%). Use ag_topografia (GONZAGA E BERLIM 16.841.054/0001-10) ou ag_cartografia (AG CARTOGRAFIA 48.282.440/0001-05).', p_empresa_faturadora;
    end if;
    v_troca_emp := (p_empresa_faturadora is distinct from v_proj.empresa_faturadora);
    if v_troca_emp then
      if coalesce(trim(p_motivo),'') = '' then
        raise exception 'Trocar a empresa faturadora exige motivo (parâmetro motivo).';
      end if;
      -- Guarda fiscal: não trocar a PJ emissora com título já emitido
      select exists (
        select 1 from public.invoices i
        where i.project_id = v_proj.id and i.status <> 'cancelada'
      ) into v_tem_titulo;
      if v_tem_titulo then
        raise exception 'Projeto % já tem título emitido pela empresa atual (%). Ajuste/cancele os títulos antes de trocar a empresa faturadora.',
          v_proj.codigo, v_proj.empresa_faturadora;
      end if;
    end if;
  end if;

  -- Valor: negativo nunca; guarda de magnitude (0<valor<100 cheira erro de escala)
  if p_contract_value is not null then
    if p_contract_value < 0 then
      raise exception 'contract_value não pode ser negativo (%).', p_contract_value;
    end if;
    if p_contract_value > 0 and p_contract_value < 100 and not p_permitir_valor_baixo then
      raise exception 'Valor % parece erro de escala (o bug VIM 15,75 = 15.750). Se o valor é mesmo esse, repita com permitir_valor_baixo=true.', p_contract_value;
    end if;
  end if;

  -- tipo_documento (texto legado em projects: nota_fiscal | recibo)
  if p_tipo_documento is not null and lower(p_tipo_documento) not in ('nota_fiscal','recibo') then
    raise exception 'tipo_documento inválido (%). Em projects use nota_fiscal ou recibo.', p_tipo_documento;
  end if;

  -- billing_type (domínio confirmado 11/08)
  if p_billing_type is not null
     and p_billing_type not in ('entrega_nf','medicao_mensal','entrega_recibo') then
    raise exception 'billing_type inválido (%). Use entrega_nf, medicao_mensal ou entrega_recibo.', p_billing_type;
  end if;

  -- CNPJ do tomador
  if p_cnpj_tomador is not null and trim(p_cnpj_tomador) <> '' then
    v_cnpj := public.fn_cnpj_digits(p_cnpj_tomador);
    if v_cnpj is null then
      raise exception 'cnpj_tomador inválido (%). Confira os 14 dígitos e o dígito verificador.', p_cnpj_tomador;
    end if;
  end if;

  update public.projects
     set empresa_faturadora = case when p_empresa_faturadora is not null then p_empresa_faturadora else empresa_faturadora end,
         contract_value     = case when p_contract_value    is not null then p_contract_value     else contract_value end,
         tipo_documento     = case when p_tipo_documento    is not null then lower(p_tipo_documento) else tipo_documento end,
         billing_type       = case when p_billing_type      is not null then p_billing_type       else billing_type end,
         cnpj_tomador       = case when p_cnpj_tomador is not null and trim(p_cnpj_tomador) <> '' then p_cnpj_tomador else cnpj_tomador end
   where id = p_project_id;

  select * into v_proj from public.projects where id = p_project_id;

  perform public.log_event(
    'project.updated', 'projects', p_project_id,
    jsonb_build_object('codigo', v_proj.codigo, 'empresa_faturadora', v_proj.empresa_faturadora,
                       'contract_value', v_proj.contract_value, 'tipo_documento', v_proj.tipo_documento,
                       'billing_type', v_proj.billing_type, 'cnpj_tomador', v_proj.cnpj_tomador,
                       'motivo', p_motivo, 'troca_empresa', coalesce(v_troca_emp,false)),
    jsonb_build_object('canal','mcp','ferramenta','update_project','recarga', p_recarga)
  );

  return jsonb_build_object(
    'atualizado', true, 'project_id', v_proj.id, 'codigo', v_proj.codigo, 'nome', v_proj.name,
    'empresa_faturadora', v_proj.empresa_faturadora, 'contract_value', v_proj.contract_value,
    'tipo_documento', v_proj.tipo_documento, 'billing_type', v_proj.billing_type,
    'cnpj_tomador', v_proj.cnpj_tomador,
    'message', 'Projeto ' || v_proj.codigo || ' atualizado.');
end;
$$;

-- ---------------------------------------------------------------------
-- fn_create_project — tool create_project
--   Papel: master/diretor/comercial. Campo fiscal na criação é inerente
--   (nasce com empresa_faturadora) — a criação é o caminho de exceção/backfill.
--   client_id obrigatório (cliente é o centro). Código ANO-SIGLA-SEQ único.
--   sigla = clients.codigo (sem sigla → recusa). Guarda de magnitude.
-- ---------------------------------------------------------------------
create or replace function public.fn_create_project(
  p_client_id            uuid,
  p_name                 text,
  p_empresa_faturadora   text,
  p_ano                  int default null,
  p_contract_value       numeric default null,
  p_billing_type         text default null,
  p_tipo_documento       text default null,
  p_cnpj_tomador         text default null,
  p_service              text default null,
  p_status               public.project_status default 'planejamento',
  p_execution_status     public.execution_status default 'aguardando_campo',
  p_permitir_valor_baixo boolean default false,
  p_recarga              boolean default false
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_cli     public.clients%rowtype;
  v_ano     int;
  v_seq     int;
  v_codigo  text;
  v_cnpj    text;
  v_tipo    text;
  v_id      uuid;
  v_new     public.projects%rowtype;
begin
  if not public.has_any_role(auth.uid(),
       array['master','diretor','comercial']::public.app_role[]) then
    raise exception 'Sem permissão para criar projeto. Exige master, diretor ou comercial.';
  end if;

  if p_client_id is null then
    raise exception 'client_id é obrigatório: cliente é o centro do sistema, projeto não nasce solto.';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Nome do projeto é obrigatório.';
  end if;
  if p_empresa_faturadora is null
     or p_empresa_faturadora not in ('ag_topografia','ag_cartografia') then
    raise exception 'empresa_faturadora obrigatória e deve ser ag_topografia (GONZAGA E BERLIM 16.841.054/0001-10) ou ag_cartografia (AG CARTOGRAFIA 48.282.440/0001-05).';
  end if;

  -- Trava a linha do cliente: serializa a geração de seq por sigla
  -- (exige política de UPDATE em clients para o papel — garantida acima).
  select * into v_cli from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente % não encontrado. Cliente é o centro — cadastre o cliente antes do projeto.', p_client_id;
  end if;
  if v_cli.codigo is null or trim(v_cli.codigo) = '' then
    raise exception 'Cliente "%" não tem sigla (codigo). Defina a sigla no cliente antes de criar projeto — o código do projeto é ANO-SIGLA-SEQ.', v_cli.name;
  end if;

  -- Valor: negativo nunca; guarda de magnitude
  if p_contract_value is not null then
    if p_contract_value < 0 then
      raise exception 'contract_value não pode ser negativo (%).', p_contract_value;
    end if;
    if p_contract_value > 0 and p_contract_value < 100 and not p_permitir_valor_baixo then
      raise exception 'Valor % parece erro de escala (o bug VIM 15,75 = 15.750). Se o valor é mesmo esse, repita com permitir_valor_baixo=true.', p_contract_value;
    end if;
  end if;

  if p_billing_type is not null
     and p_billing_type not in ('entrega_nf','medicao_mensal','entrega_recibo') then
    raise exception 'billing_type inválido (%). Use entrega_nf, medicao_mensal ou entrega_recibo.', p_billing_type;
  end if;

  v_tipo := coalesce(lower(nullif(trim(coalesce(p_tipo_documento,'')),'')), 'nota_fiscal');
  if v_tipo not in ('nota_fiscal','recibo') then
    raise exception 'tipo_documento inválido (%). Em projects use nota_fiscal ou recibo.', p_tipo_documento;
  end if;

  if p_cnpj_tomador is not null and trim(p_cnpj_tomador) <> '' then
    v_cnpj := public.fn_cnpj_digits(p_cnpj_tomador);
    if v_cnpj is null then
      raise exception 'cnpj_tomador inválido (%). Confira os 14 dígitos e o dígito verificador.', p_cnpj_tomador;
    end if;
  end if;

  -- Código ANO-SIGLA-SEQ. seq = maior seq já usado por (ano, sigla) + 1.
  v_ano := coalesce(p_ano, extract(year from current_date)::int);
  select coalesce(max((regexp_replace(codigo, '^\d{4}-' || v_cli.codigo || '-', ''))::int), 0)
    into v_seq
    from public.projects
   where codigo ~ ('^' || v_ano::text || '-' || v_cli.codigo || '-\d+$');
  v_seq := v_seq + 1;
  v_codigo := v_ano::text || '-' || v_cli.codigo || '-' || lpad(v_seq::text, 3, '0');

  insert into public.projects (
    client_id, name, empresa_faturadora, codigo, contract_value,
    billing_type, tipo_documento, cnpj_tomador, service,
    status, execution_status, is_active
  ) values (
    p_client_id, p_name, p_empresa_faturadora, v_codigo, p_contract_value,
    p_billing_type, v_tipo, nullif(trim(coalesce(p_cnpj_tomador,'')),''), p_service,
    p_status, p_execution_status, true
  ) returning id into v_id;

  select * into v_new from public.projects where id = v_id;

  perform public.log_event(
    'project.created', 'projects', v_id,
    jsonb_build_object('codigo', v_new.codigo, 'cliente', v_cli.name, 'name', v_new.name,
                       'empresa_faturadora', v_new.empresa_faturadora,
                       'contract_value', v_new.contract_value, 'billing_type', v_new.billing_type,
                       'tipo_documento', v_new.tipo_documento),
    jsonb_build_object('canal','mcp','ferramenta','create_project','recarga', p_recarga)
  );

  return jsonb_build_object(
    'criado', true, 'project_id', v_new.id, 'codigo', v_new.codigo, 'nome', v_new.name,
    'client_id', v_new.client_id, 'cliente', v_cli.name,
    'empresa_faturadora', v_new.empresa_faturadora, 'contract_value', v_new.contract_value,
    'billing_type', v_new.billing_type, 'tipo_documento', v_new.tipo_documento,
    'status', v_new.status, 'execution_status', v_new.execution_status,
    'message', 'Projeto ' || v_new.codigo || ' criado para ' || v_cli.name || '.');
end;
$$;