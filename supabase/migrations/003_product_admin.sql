-- 商品管理 RPC: 新規作成 or 更新（p_id が null なら INSERT、それ以外は UPDATE）
create or replace function upsert_product(
  p_id         uuid,
  p_name       text,
  p_price      integer,
  p_category   text,
  p_toppings   text[],
  p_set_box    boolean,
  p_is_stopped boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_price < 0 then
    raise exception '価格は 0 以上である必要があります。';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception '商品名は必須です。';
  end if;

  if p_category is null or trim(p_category) = '' then
    raise exception 'カテゴリは必須です。';
  end if;

  if p_id is null then
    v_id := gen_random_uuid();
    insert into products (id, name, price, category, toppings, set_box, is_stopped)
    values (
      v_id,
      trim(p_name),
      p_price,
      trim(p_category),
      coalesce(p_toppings, '{}'),
      coalesce(p_set_box, false),
      coalesce(p_is_stopped, false)
    );
  else
    v_id := p_id;
    update products
    set name       = trim(p_name),
        price      = p_price,
        category   = trim(p_category),
        toppings   = coalesce(p_toppings, '{}'),
        set_box    = coalesce(p_set_box, false),
        is_stopped = p_is_stopped
    where id = p_id;

    if not found then
      raise exception '商品が見つかりません: %', p_id;
    end if;
  end if;

  return v_id;
end;
$$;

-- 商品削除 RPC
create or replace function delete_product(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from products where id = p_id;

  if not found then
    raise exception '商品が見つかりません: %', p_id;
  end if;
end;
$$;

-- 権限設定
revoke execute on function upsert_product(uuid, text, integer, text, text[], boolean, boolean) from public;
grant  execute on function upsert_product(uuid, text, integer, text, text[], boolean, boolean) to anon, authenticated;

revoke execute on function delete_product(uuid) from public;
grant  execute on function delete_product(uuid) to anon, authenticated;

-- リセット関数を管理画面から呼び出せるよう anon にも許可
grant execute on function reset_order_numbers() to anon, authenticated;
