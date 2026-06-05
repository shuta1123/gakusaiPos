export type OrderStatus = "cooking" | "ready" | "done";
export type PaymentMethod = "cash" | string;

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          price: number;
          category: string;
          toppings: string[];
          set_box: boolean;
          is_stopped: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          items: OrderItem[];
          total_price: number;
          discount: number;
          payment_method: PaymentMethod;
          status: OrderStatus;
          source: "pos" | "smartphone";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
    };
  };
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  toppings: string[];
}
