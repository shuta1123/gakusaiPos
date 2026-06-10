export type OrderStatus = "cooking" | "ready" | "done";
export type OrderSource = "pos" | "smartphone";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  toppings: string[];
  set_box: boolean;
  is_stopped: boolean;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  toppings: string[];
}

export interface Order {
  id: string;
  order_number: number;
  items: OrderItem[];
  total_price: number;
  discount: number;
  payment_method: string;
  status: OrderStatus;
  source: OrderSource;
  created_at: string;
}
