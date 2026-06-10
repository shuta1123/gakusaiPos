-- 前方マイグレーション: 001 が適用済みの環境向けアップグレード
-- 新規環境では 001_initial_schema.sql が最終状態で作成されるため不要
-- 既存環境でも正しく動作するよう前方互換マイグレーションとして提供

-- 旧関数を削除（p_total_price あり版 + 旧 next_order_number）
drop function if exists create_order(text, jsonb, integer, integer, text);
drop function if exists next_order_number(text);

-- order_number_sequences を anon から保護（RLS 有効化）
alter table order_number_sequences enable row level security;

-- 注文作成 RPC: DB から価格を計算、items も DB データで再構築
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

-- ステータス更新 RPC: search_path を固定
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

-- 注文番号リセット RPC（既存注文との unique 衝突を防ぐため orders を全削除してからリセット）
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

-- 実行権限を明示的に設定
revoke execute on function create_order(text, jsonb, integer, text) from public;
grant  execute on function create_order(text, jsonb, integer, text) to anon, authenticated;

revoke execute on function update_order_status(uuid, text) from public;
grant  execute on function update_order_status(uuid, text) to anon, authenticated;

revoke execute on function reset_order_numbers() from public;
grant  execute on function reset_order_numbers() to service_role;

-- RLS ポリシーを最終状態に揃える（旧ポリシーの cleanup を含む）
alter table products enable row level security;
alter table orders enable row level security;

do $$
begin
  drop policy if exists "products write all" on products;
  drop policy if exists "products read all" on products;
  create policy "products read all" on products for select using (true);

  drop policy if exists "orders write all" on orders;
  drop policy if exists "orders insert" on orders;
  drop policy if exists "orders update status" on orders;
  drop policy if exists "orders read all" on orders;
  create policy "orders read all" on orders for select using (true);
end;
$$;
