export type OrderStatus = "cooking" | "ready" | "done";
export type PaymentMethod = "cash" | string;

export interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  toppings: string[];
}

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
        Relationships: [];
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
        Relationships: [];
      };
      order_number_sequences: {
        Row: { source: "pos" | "smartphone"; current_number: number };
        Insert: Database["public"]["Tables"]["order_number_sequences"]["Row"];
        Update: Partial<Database["public"]["Tables"]["order_number_sequences"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order: {
        Args: {
          p_source: string;
          p_items: OrderItem[];
          p_discount: number;
          p_payment_method: string;
        };
        Returns: number;
      };
      update_order_status: {
        Args: { p_order_id: string; p_status: string };
        Returns: void;
      };
      reset_order_numbers: {
        Args: Record<string, never>;
        Returns: void;
      };
      upsert_product: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_price: number;
          p_category: string;
          p_toppings: string[];
          p_set_box: boolean;
          p_is_stopped: boolean;
        };
        Returns: string;
      };
      delete_product: {
        Args: { p_id: string };
        Returns: void;
      };
    };
  };
}
