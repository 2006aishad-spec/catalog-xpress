export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          entity_id: string | null
          entity_type: string
          from_state: string | null
          id: string
          metadata: Json
          to_state: string | null
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          from_state?: string | null
          id?: string
          metadata?: Json
          to_state?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          from_state?: string | null
          id?: string
          metadata?: Json
          to_state?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_signals: {
        Row: {
          created_at: string
          details: Json
          id: string
          related_intent_id: string | null
          related_tx_id: string | null
          resolved: boolean
          severity: string
          signal_type: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          related_intent_id?: string | null
          related_tx_id?: string | null
          resolved?: boolean
          severity?: string
          signal_type: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          related_intent_id?: string | null
          related_tx_id?: string | null
          resolved?: boolean
          severity?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_signals_related_intent_id_fkey"
            columns: ["related_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_signals_related_tx_id_fkey"
            columns: ["related_tx_id"]
            isOneToOne: false
            referencedRelation: "provider_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          source: string
          status: string
          store_id: string
          updated_at: string
          variant: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          source?: string
          status?: string
          store_id: string
          updated_at?: string
          variant?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          source?: string
          status?: string
          store_id?: string
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          activation_status: string
          amount: number
          confirmed_at: string
          confirmed_by: string
          created_at: string
          currency: string
          id: string
          notified_email: boolean
          notified_whatsapp: boolean
          payment_intent_id: string
          provider_transaction_id: string | null
          receipt_number: string
          store_id: string
        }
        Insert: {
          activation_status?: string
          amount: number
          confirmed_at?: string
          confirmed_by?: string
          created_at?: string
          currency?: string
          id?: string
          notified_email?: boolean
          notified_whatsapp?: boolean
          payment_intent_id: string
          provider_transaction_id?: string | null
          receipt_number: string
          store_id: string
        }
        Update: {
          activation_status?: string
          amount?: number
          confirmed_at?: string
          confirmed_by?: string
          created_at?: string
          currency?: string
          id?: string
          notified_email?: boolean
          notified_whatsapp?: boolean
          payment_intent_id?: string
          provider_transaction_id?: string | null
          receipt_number?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_provider_transaction_id_fkey"
            columns: ["provider_transaction_id"]
            isOneToOne: false
            referencedRelation: "provider_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          created_at: string
          customer_identifier: string
          customer_msisdn_hint: string | null
          expected_amount: number
          expected_currency: string
          expires_at: string
          id: string
          matched_transaction_id: string | null
          plan_id: string
          provider_id: string
          reference: string
          review_reason: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_identifier?: string
          customer_msisdn_hint?: string | null
          expected_amount: number
          expected_currency?: string
          expires_at: string
          id?: string
          matched_transaction_id?: string | null
          plan_id: string
          provider_id: string
          reference: string
          review_reason?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_identifier?: string
          customer_msisdn_hint?: string | null
          expected_amount?: number
          expected_currency?: string
          expires_at?: string
          id?: string
          matched_transaction_id?: string | null
          plan_id?: string
          provider_id?: string
          reference?: string
          review_reason?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_matched_tx_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "provider_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          provider_code: string
          provider_type: string
          receiving_msisdn: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          provider_code: string
          provider_type?: string
          receiving_msisdn?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          provider_code?: string
          provider_type?: string
          receiving_msisdn?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_requests: {
        Row: {
          admin_note: string | null
          amount: number
          contact_name: string
          contact_phone: string
          created_at: string
          currency: string
          id: string
          plan_code: string
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number
          contact_name?: string
          contact_phone?: string
          created_at?: string
          currency?: string
          id?: string
          plan_code: string
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          contact_name?: string
          contact_phone?: string
          created_at?: string
          currency?: string
          id?: string
          plan_code?: string
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_period: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price_amount: number
          price_currency: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price_amount?: number
          price_currency?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price_amount?: number
          price_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          colors: string[]
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          sale_price: number | null
          sizes: string[]
          sku: string | null
          sort_order: number
          stock: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price?: number
          sale_price?: number | null
          sizes?: string[]
          sku?: string | null
          sort_order?: number
          stock?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          sale_price?: number | null
          sizes?: string[]
          sku?: string | null
          sort_order?: number
          stock?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          phone: string | null
          phone_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          phone?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          is_used: boolean
          new_balance: number | null
          provider_id: string
          provider_transaction_id: string
          raw_event_id: string
          recipient_msisdn: string | null
          sender_msisdn: string | null
          transaction_date: string | null
          transaction_time: string | null
          used_by_intent_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          is_used?: boolean
          new_balance?: number | null
          provider_id: string
          provider_transaction_id: string
          raw_event_id: string
          recipient_msisdn?: string | null
          sender_msisdn?: string | null
          transaction_date?: string | null
          transaction_time?: string | null
          used_by_intent_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_used?: boolean
          new_balance?: number | null
          provider_id?: string
          provider_transaction_id?: string
          raw_event_id?: string
          recipient_msisdn?: string | null
          sender_msisdn?: string | null
          transaction_date?: string | null
          transaction_time?: string | null
          used_by_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_transactions_raw_event_id_fkey"
            columns: ["raw_event_id"]
            isOneToOne: false
            referencedRelation: "raw_sms_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_transactions_used_by_intent_id_fkey"
            columns: ["used_by_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_sms_events: {
        Row: {
          gateway_device_id: string
          id: string
          parse_error: string | null
          processing_status: string
          raw_body: string
          received_at_device: string | null
          received_at_server: string
          sender_shortcode: string | null
        }
        Insert: {
          gateway_device_id?: string
          id?: string
          parse_error?: string | null
          processing_status?: string
          raw_body: string
          received_at_device?: string | null
          received_at_server?: string
          sender_shortcode?: string | null
        }
        Update: {
          gateway_device_id?: string
          id?: string
          parse_error?: string | null
          processing_status?: string
          raw_body?: string
          received_at_device?: string | null
          received_at_server?: string
          sender_shortcode?: string | null
        }
        Relationships: []
      }
      store_events: {
        Row: {
          created_at: string
          device: string | null
          event_type: string
          id: string
          product_id: string | null
          source: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          event_type: string
          id?: string
          product_id?: string | null
          source?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          product_id?: string | null
          source?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner_url: string | null
          category: string
          created_at: string
          currency: string
          description: string
          id: string
          location: string
          logo_url: string | null
          name: string
          owner_id: string
          owner_name: string | null
          plan: string
          primary_color: string
          slug: string
          status: string
          tagline: string
          trial_ends_at: string | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          banner_url?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          location?: string
          logo_url?: string | null
          name: string
          owner_id: string
          owner_name?: string | null
          plan?: string
          primary_color?: string
          slug: string
          status?: string
          tagline?: string
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          id?: string
          location?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          owner_name?: string | null
          plan?: string
          primary_color?: string
          slug?: string
          status?: string
          tagline?: string
          trial_ends_at?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      djp_activate_intent: {
        Args: { _actor?: string; _intent_id: string }
        Returns: Json
      }
      djp_expire_intents: { Args: never; Returns: number }
      djp_match_transaction: { Args: { _tx_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trial_expired: { Args: { _store_id: string }; Returns: boolean }
      owns_store: { Args: { _store_id: string }; Returns: boolean }
      plan_max_categories: { Args: { _plan: string }; Returns: number }
      plan_max_products: { Args: { _plan: string }; Returns: number }
      store_is_published: { Args: { _store_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
