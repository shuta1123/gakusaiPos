-- products テーブル
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null check (price >= 0),
  category text not null,
  toppings text[] not null default '{}',
  set_box boolean not null default false,
  is_stopped boolean not null default false,
  created_at timestamptz not null default now()
);

-- orders テーブル（source と order_number の番号帯を CHECK で強制）
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique,
  items jsonb not null default '[]',
  total_price integer not null check (total_price >= 0),
  discount integer not null default 0 check (discount >= 0),
  payment_method text not null default 'cash',
  status text not null default 'cooking' check (status in ('cooking', 'ready', 'done')),
  source text not null check (source in ('pos', 'smartphone')),
  created_at timestamptz not null default now(),
  constraint order_number_range_check check (
    (source = 'pos'        and order_number between 100 and 499) or
    (source = 'smartphone' and order_number between 500 and 999)
  )
);

-- 注文番号のシーケンス管理（POS: 100-499 / スマホ: 500-999）
create table if not exists order_number_sequences (
  source text primary key check (source in ('pos', 'smartphone')),
  current_number integer not null
);

insert into order_number_sequences (source, current_number)
values ('pos', 99), ('smartphone', 499)
on conflict do nothing;

-- RLS: order_number_sequences は anon から直接アクセス不可
alter table order_number_sequences enable row level security;
-- ポリシーなし → anon/authenticated は読み書き不可、RPC 経由のみ許可

-- 旧シグネチャの関数を削除（p_total_price 引数を廃止し DB 側で価格を計算する設計に変更）
drop function if exists create_order(text, jsonb, integer, integer, text);

-- 注文作成 RPC: 採番と INSERT をアトミックに実行
-- 合計金額は DB から計算、items も DB データで再構築（クライアント供給値を信頼しない）
create or replace function create_order(
  p_source         text,
  p_items          jsonb,
  p_discount       integer,
  p_payment_method text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max             integer;
  v_order_number    integer;
  v_total_price     integer := 0;
  v_stored_items    jsonb   := '[]'::jsonb;
  v_item            jsonb;
  v_qty             integer;
  v_product_price   integer;
  v_product_stopped boolean;
  v_product_name    text;
begin
  if p_discount < 0 then
    raise exception '割引額は 0 以上である必要があります。';
  end if;

  if p_source not in ('pos', 'smartphone') then
    raise exception '不正なソース: %', p_source;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '注文明細が空です。';
  end if;

  -- 各商品を DB から検証し、合計金額を計算、保存用 items を再構築
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_qty <= 0 then
      raise exception '商品数量は 1 以上である必要があります。';
    end if;

    select price, is_stopped, name
    into v_product_price, v_product_stopped, v_product_name
    from products
    where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception '商品が見つかりません: %', v_item->>'product_id';
    end if;

    if v_product_stopped then
      raise exception '販売停止中の商品が含まれています: %', v_product_name;
    end if;

    v_total_price  := v_total_price + v_product_price * v_qty;
    v_stored_items := v_stored_items || jsonb_build_array(jsonb_build_object(
      'product_id',   v_item->>'product_id',
      'product_name', v_product_name,
      'price',        v_product_price,
      'quantity',     v_qty,
      'toppings',     coalesce(v_item->'toppings', '[]'::jsonb)
    ));
  end loop;

  -- discount は合計金額を超えた場合は合計金額にクランプ（0円会計を許容）
  if p_discount > v_total_price then
    p_discount := v_total_price;
  end if;

  select case p_source when 'pos' then 499 else 999 end into v_max;

  update order_number_sequences
  set current_number = current_number + 1
  where source = p_source
  returning current_number into v_order_number;

  if v_order_number > v_max then
    raise exception '注文番号が上限（%）に達しました。管理者に連絡してください。', v_max;
  end if;

  insert into orders (order_number, items, total_price, discount, payment_method, status, source)
  values (v_order_number, v_stored_items, v_total_price - p_discount, p_discount, p_payment_method, 'cooking', p_source);

  return v_order_number;
end;
$$;

-- ステータス更新 RPC（status 列のみ変更可、SECURITY DEFINER で RLS を回避）
create or replace function update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('cooking', 'ready', 'done') then
    raise exception '不正なステータス: %', p_status;
  end if;

  update orders set status = p_status where id = p_order_id;
end;
$$;

-- 注文番号リセット RPC（営業開始前に管理画面から service_role 経由で実行）
-- 既存注文との unique 衝突を防ぐため orders を全削除してからリセット
create or replace function reset_order_numbers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from orders;
  update order_number_sequences set current_number = 99  where source = 'pos';
  update order_number_sequences set current_number = 499 where source = 'smartphone';
end;
$$;

-- SECURITY DEFINER 関数の実行権限を明示的に設定
revoke execute on function create_order(text, jsonb, integer, text) from public;
grant  execute on function create_order(text, jsonb, integer, text) to anon, authenticated;

revoke execute on function update_order_status(uuid, text) from public;
grant  execute on function update_order_status(uuid, text) to anon, authenticated;

-- リセット関数は service_role のみ（anon から呼び出し不可）
revoke execute on function reset_order_numbers() from public;
grant  execute on function reset_order_numbers() to service_role;

-- Realtime を有効化（冪等: 既存登録済みでも失敗しないDOブロック）
do $$
begin
  alter publication supabase_realtime add table orders;
exception when others then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table products;
exception when others then null;
end;
$$;

-- RLS を有効化
alter table products enable row level security;
alter table orders enable row level security;

-- ポリシー（冪等: 既存なら再作成）
do $$
begin
  -- products: anon は読み取り専用（価格・販売停止の改ざんを防ぐ）
  drop policy if exists "products read all" on products;
  create policy "products read all" on products for select using (true);

  drop policy if exists "products write all" on products;

  -- orders: SELECT のみ許可（INSERT/UPDATE は RPC 経由のみ）
  drop policy if exists "orders read all" on orders;
  create policy "orders read all" on orders for select using (true);

  drop policy if exists "orders write all" on orders;
  drop policy if exists "orders insert" on orders;
  drop policy if exists "orders update status" on orders;
end;
$$;
