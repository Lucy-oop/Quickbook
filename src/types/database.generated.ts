export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          currency_code: string | null
          custom_fields: Json
          description: string | null
          expense_group: Database["public"]["Enums"]["expense_group"] | null
          id: string
          is_active: boolean
          is_cash_like: boolean
          is_system: boolean
          name_en: string
          name_my: string | null
          opening_balance: number
          parent_id: string | null
          subtype: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          custom_fields?: Json
          description?: string | null
          expense_group?: Database["public"]["Enums"]["expense_group"] | null
          id?: string
          is_active?: boolean
          is_cash_like?: boolean
          is_system?: boolean
          name_en: string
          name_my?: string | null
          opening_balance?: number
          parent_id?: string | null
          subtype?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          custom_fields?: Json
          description?: string | null
          expense_group?: Database["public"]["Enums"]["expense_group"] | null
          id?: string
          is_active?: boolean
          is_cash_like?: boolean
          is_system?: boolean
          name_en?: string
          name_my?: string | null
          opening_balance?: number
          parent_id?: string | null
          subtype?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_keys: string[] | null
          created_at: string
          id: number
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          tenant_id: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_keys?: string[] | null
          created_at?: string
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          tenant_id: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_keys?: string[] | null
          created_at?: string
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          tenant_id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          created_by: string | null
          credit_limit: number
          currency_code: string | null
          custom_fields: Json
          email: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["contact_kind"]
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          tax_number: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency_code?: string | null
          custom_fields?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["contact_kind"]
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_number?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          currency_code?: string | null
          custom_fields?: Json
          email?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["contact_kind"]
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_number?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          decimal_digits: number
          is_active: boolean
          name: string
          name_my: string | null
          symbol: string
        }
        Insert: {
          code: string
          decimal_digits?: number
          is_active?: boolean
          name: string
          name_my?: string | null
          symbol: string
        }
        Update: {
          code?: string
          decimal_digits?: number
          is_active?: boolean
          name?: string
          name_my?: string | null
          symbol?: string
        }
        Relationships: []
      }
      custom_fields_schema: {
        Row: {
          created_at: string
          created_by: string | null
          default_value: Json | null
          entity: Database["public"]["Enums"]["custom_field_entity"]
          field_key: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          help_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          is_searchable: boolean
          is_unique: boolean
          label_en: string
          label_my: string | null
          options: Json
          show_in_list: boolean
          show_on_print: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
          validation: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_value?: Json | null
          entity: Database["public"]["Enums"]["custom_field_entity"]
          field_key: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_unique?: boolean
          label_en: string
          label_my?: string | null
          options?: Json
          show_in_list?: boolean
          show_on_print?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
          validation?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_value?: Json | null
          entity?: Database["public"]["Enums"]["custom_field_entity"]
          field_key?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_searchable?: boolean
          is_unique?: boolean
          label_en?: string
          label_my?: string | null
          options?: Json
          show_in_list?: boolean
          show_on_print?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_schema_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_schema_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          doc_type: string
          next_number: number
          padding: number
          period_key: string
          prefix: string
          tenant_id: string
        }
        Insert: {
          doc_type: string
          next_number?: number
          padding?: number
          period_key?: string
          prefix?: string
          tenant_id: string
        }
        Update: {
          doc_type?: string
          next_number?: number
          padding?: number
          period_key?: string
          prefix?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number
          code: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          id: string
          is_active: boolean
          name: string
          name_my: string | null
          note: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          phone: string | null
          position: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_salary?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          is_active?: boolean
          name: string
          name_my?: string | null
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone?: string | null
          position?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_salary?: number
          code?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          name_my?: string | null
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          phone?: string | null
          position?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_code: string
          created_at: string
          created_by: string | null
          id: string
          quote_code: string
          rate: number
          rate_date: string
          source: string
          tenant_id: string | null
        }
        Insert: {
          base_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          quote_code: string
          rate: number
          rate_date?: string
          source?: string
          tenant_id?: string | null
        }
        Update: {
          base_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          quote_code?: string
          rate?: number
          rate_date?: string
          source?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_quote_code_fkey"
            columns: ["quote_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "exchange_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          custom_fields: Json
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          line_cost: number | null
          line_no: number
          line_total: number | null
          product_id: string | null
          quantity: number
          sku: string | null
          tax_amount: number
          tax_rate: number
          tenant_id: string
          unit: string | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          line_cost?: number | null
          line_no?: number
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          sku?: string | null
          tax_amount?: number
          tax_rate?: number
          tenant_id: string
          unit?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          line_cost?: number | null
          line_no?: number
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          sku?: string | null
          tax_amount?: number
          tax_rate?: number
          tenant_id?: string
          unit?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number | null
          contact_id: string | null
          contact_snapshot: Json
          cost_total: number
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          discount_amount: number
          due_date: string | null
          exchange_rate: number
          id: string
          issue_date: string
          issued_at: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          notes: string | null
          number: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          terms: string | null
          total: number
          total_base: number | null
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          balance_due?: number | null
          contact_id?: string | null
          contact_snapshot?: Json
          cost_total?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          discount_amount?: number
          due_date?: string | null
          exchange_rate?: number
          id?: string
          issue_date?: string
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          notes?: string | null
          number?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          terms?: string | null
          total?: number
          total_base?: number | null
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          balance_due?: number | null
          contact_id?: string | null
          contact_snapshot?: Json
          cost_total?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          discount_amount?: number
          due_date?: string | null
          exchange_rate?: number
          id?: string
          issue_date?: string
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          notes?: string | null
          number?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          terms?: string | null
          total?: number
          total_base?: number | null
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_same_tenant"
            columns: ["warehouse_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          invited_phone: string | null
          joined_at: string | null
          permission_overrides: Json
          revoked_at: string | null
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
          warehouse_scope: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          invited_phone?: string | null
          joined_at?: string | null
          permission_overrides?: Json
          revoked_at?: string | null
          role_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          warehouse_scope?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_at?: string
          invited_by?: string | null
          invited_email?: string | null
          invited_phone?: string | null
          joined_at?: string | null
          permission_overrides?: Json
          revoked_at?: string | null
          role_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          warehouse_scope?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          amount_base: number | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          direction: string
          exchange_rate: number
          id: string
          invoice_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          number: string | null
          paid_on: string
          reference: string | null
          tenant_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_base?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          direction?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          number?: string | null
          paid_on?: string
          reference?: string | null
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_base?: number | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          direction?: string
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          number?: string | null
          paid_on?: string
          reference?: string | null
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          base_amount: number
          bonus_amount: number
          created_at: string
          deduction_amount: number
          employee_id: string
          note: string | null
          pay_period: string
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          base_amount?: number
          bonus_amount?: number
          created_at?: string
          deduction_amount?: number
          employee_id: string
          note?: string | null
          pay_period: string
          tenant_id: string
          transaction_id: string
        }
        Update: {
          base_amount?: number
          bonus_amount?: number
          created_at?: string
          deduction_amount?: number
          employee_id?: string
          note?: string | null
          pay_period?: string
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          is_sensitive: boolean
          key: string
          label_en: string
          label_my: string | null
          module: string
        }
        Insert: {
          description?: string | null
          is_sensitive?: boolean
          key: string
          label_en: string
          label_my?: string | null
          module: string
        }
        Update: {
          description?: string | null
          is_sensitive?: boolean
          key?: string
          label_en?: string
          label_my?: string | null
          module?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_my: string | null
          parent_id: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_my?: string | null
          parent_id?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_my?: string | null
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_my: string | null
          reorder_level: number
          reorder_quantity: number
          selling_price: number
          sku: string | null
          tax_rate: number
          tenant_id: string
          track_inventory: boolean
          unit: string
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_my?: string | null
          reorder_level?: number
          reorder_quantity?: number
          selling_price?: number
          sku?: string | null
          tax_rate?: number
          tenant_id: string
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_my?: string | null
          reorder_level?: number
          reorder_quantity?: number
          selling_price?: number
          sku?: string | null
          tax_rate?: number
          tenant_id?: string
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_owner_role: boolean
          is_system: boolean
          key: string
          name_en: string
          name_my: string | null
          rank: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner_role?: boolean
          is_system?: boolean
          key: string
          name_en: string
          name_my?: string | null
          rank?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner_role?: boolean
          is_system?: boolean
          key?: string
          name_en?: string
          name_my?: string | null
          rank?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_permissions: {
        Row: {
          granted_at: string
          permission_key: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          permission_key: string
          role_id: string
        }
        Update: {
          granted_at?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "roles_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          available: number | null
          avg_cost: number
          product_id: string
          quantity: number
          reserved: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          available?: number | null
          avg_cost?: number
          product_id: string
          quantity?: number
          reserved?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          available?: number | null
          avg_cost?: number
          product_id?: string
          quantity?: number
          reserved?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_same_tenant"
            columns: ["warehouse_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          custom_fields: Json
          id: string
          invoice_id: string | null
          kind: Database["public"]["Enums"]["stock_move_kind"]
          notes: string | null
          occurred_at: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          transfer_group: string | null
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          invoice_id?: string | null
          kind: Database["public"]["Enums"]["stock_move_kind"]
          notes?: string | null
          occurred_at?: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          transfer_group?: string | null
          unit_cost?: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["stock_move_kind"]
          notes?: string | null
          occurred_at?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          transfer_group?: string | null
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_same_tenant"
            columns: ["warehouse_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          allow_negative_stock: boolean
          base_currency: string
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          default_locale: string
          email: string | null
          fiscal_year_start_month: number
          id: string
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          subscription_plan: string
          subscription_status: string
          tax_number: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_negative_stock?: boolean
          base_currency?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_locale?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          subscription_plan?: string
          subscription_status?: string
          tax_number?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_negative_stock?: boolean
          base_currency?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          default_locale?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          subscription_plan?: string
          subscription_status?: string
          tax_number?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      transaction_lines: {
        Row: {
          account_id: string
          credit: number
          credit_base: number | null
          debit: number
          debit_base: number | null
          exchange_rate: number
          id: string
          line_no: number
          memo: string | null
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          credit_base?: number | null
          debit?: number
          debit_base?: number | null
          exchange_rate?: number
          id?: string
          line_no?: number
          memo?: string | null
          tenant_id: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          credit_base?: number | null
          debit?: number
          debit_base?: number | null
          exchange_rate?: number
          id?: string
          line_no?: number
          memo?: string | null
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          amount_base: number | null
          attachment_url: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          description: string | null
          exchange_rate: number
          id: string
          invoice_id: string | null
          occurred_on: string
          payment_account_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tax_amount: number
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_base?: number | null
          attachment_url?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          description?: string | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          occurred_on?: string
          payment_account_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tax_amount?: number
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_base?: number | null
          attachment_url?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          custom_fields?: Json
          description?: string | null
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          occurred_on?: string
          payment_account_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tax_amount?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          last_tenant_id: string | null
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          last_tenant_id?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          last_tenant_id?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_last_tenant_id_fkey"
            columns: ["last_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          custom_fields: Json
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          name_my: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          custom_fields?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          name_my?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          custom_fields?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name_my?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_invoices: {
        Row: {
          balance_due: number | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_snapshot: Json | null
          cost_total: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          currency_code: string | null
          custom_fields: Json | null
          days_overdue: number | null
          discount_amount: number | null
          due_date: string | null
          exchange_rate: number | null
          id: string | null
          issue_date: string | null
          issued_at: string | null
          kind: Database["public"]["Enums"]["invoice_kind"] | null
          notes: string | null
          number: string | null
          paid_amount: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string | null
          terms: string | null
          total: number | null
          total_base: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_same_tenant"
            columns: ["warehouse_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      v_low_stock: {
        Row: {
          barcode: string | null
          name: string | null
          name_my: string | null
          product_id: string | null
          quantity: number | null
          reorder_level: number | null
          reorder_quantity: number | null
          sku: string | null
          tenant_id: string | null
          threshold: number | null
          unit: string | null
        }
        Insert: {
          barcode?: string | null
          name?: string | null
          name_my?: string | null
          product_id?: string | null
          quantity?: never
          reorder_level?: number | null
          reorder_quantity?: number | null
          sku?: string | null
          tenant_id?: string | null
          threshold?: number | null
          unit?: string | null
        }
        Update: {
          barcode?: string | null
          name?: string | null
          name_my?: string | null
          product_id?: string | null
          quantity?: never
          reorder_level?: number | null
          reorder_quantity?: number | null
          sku?: string | null
          tenant_id?: string | null
          threshold?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_products: {
        Row: {
          barcode: string | null
          category_id: string | null
          category_name: string | null
          cost_price: number | null
          created_at: string | null
          currency_code: string | null
          custom_fields: Json | null
          description: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_low_stock: boolean | null
          name: string | null
          name_my: string | null
          reorder_level: number | null
          reorder_quantity: number | null
          selling_price: number | null
          sku: string | null
          stock_on_hand: number | null
          tax_rate: number | null
          tenant_id: string | null
          track_inventory: boolean | null
          unit: string | null
          updated_at: string | null
          wholesale_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_levels: {
        Row: {
          available: number | null
          avg_cost: number | null
          product_id: string | null
          quantity: number | null
          reserved: number | null
          tenant_id: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          available?: number | null
          avg_cost?: never
          product_id?: string | null
          quantity?: number | null
          reserved?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          available?: number | null
          avg_cost?: never
          product_id?: string | null
          quantity?: number | null
          reserved?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_product_same_tenant"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "v_products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "stock_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_same_tenant"
            columns: ["warehouse_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          invited_phone: string | null
          joined_at: string | null
          permission_overrides: Json
          revoked_at: string | null
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
          warehouse_scope: string[]
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_warehouse: {
        Args: { p_tenant_id: string; p_warehouse_id: string }
        Returns: boolean
      }
      create_product_with_stock: {
        Args: {
          p_product: Json
          p_quantity?: number
          p_tenant_id: string
          p_unit_cost?: number
          p_warehouse_id?: string
        }
        Returns: string
      }
      create_tenant: {
        Args: {
          p_base_currency?: string
          p_business_type?: Database["public"]["Enums"]["business_type"]
          p_locale?: string
          p_name: string
          p_phone?: string
        }
        Returns: {
          address: string | null
          allow_negative_stock: boolean
          base_currency: string
          business_type: Database["public"]["Enums"]["business_type"]
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          default_locale: string
          email: string | null
          fiscal_year_start_month: number
          id: string
          is_active: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          subscription_plan: string
          subscription_status: string
          tax_number: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_summary: {
        Args: { p_from?: string; p_tenant_id: string; p_to?: string }
        Returns: Json
      }
      has_permission: {
        Args: { p_permission: string; p_tenant_id: string }
        Returns: boolean
      }
      invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          reason: string
          role_name_en: string
          role_name_my: string
          tenant_name: string
          valid: boolean
        }[]
      }
      invite_member: {
        Args: {
          p_email?: string
          p_phone?: string
          p_role_key: string
          p_tenant_id: string
          p_warehouse_scope?: string[]
        }
        Returns: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          invited_phone: string | null
          joined_at: string | null
          permission_overrides: Json
          revoked_at: string | null
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
          warehouse_scope: string[]
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_owner: { Args: { p_tenant_id: string }; Returns: boolean }
      masked_avg_cost: {
        Args: {
          p_product_id: string
          p_tenant_id: string
          p_warehouse_id: string
        }
        Returns: number
      }
      masked_invoice_cost: {
        Args: { p_invoice_id: string; p_tenant_id: string }
        Returns: number
      }
      masked_product_cost: {
        Args: { p_product_id: string; p_tenant_id: string }
        Returns: number
      }
      next_document_number: {
        Args: { p_doc_type: string; p_tenant_id: string }
        Returns: string
      }
      post_invoice: {
        Args: {
          p_invoice_id: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_paid_amount?: number
        }
        Returns: {
          balance_due: number | null
          contact_id: string | null
          contact_snapshot: Json
          cost_total: number
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          discount_amount: number
          due_date: string | null
          exchange_rate: number
          id: string
          issue_date: string
          issued_at: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          notes: string | null
          number: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          terms: string | null
          total: number
          total_base: number | null
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_salary_expense: {
        Args: {
          p_account_id: string
          p_base: number
          p_bonus?: number
          p_deduction?: number
          p_description?: string
          p_employee_id: string
          p_exchange_rate?: number
          p_note?: string
          p_occurred_on?: string
          p_pay_period: string
          p_payment_account_id?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_tenant_id: string
        }
        Returns: {
          account_id: string | null
          amount: number
          amount_base: number | null
          attachment_url: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          description: string | null
          exchange_rate: number
          id: string
          invoice_id: string | null
          occurred_on: string
          payment_account_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tax_amount: number
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reinvite_member: {
        Args: {
          p_email: string
          p_role_key: string
          p_tenant_id: string
          p_warehouse_scope?: string[]
        }
        Returns: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          invited_phone: string | null
          joined_at: string | null
          permission_overrides: Json
          revoked_at: string | null
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
          warehouse_scope: string[]
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_ar_ap: {
        Args: { p_kind?: string; p_tenant_id: string }
        Returns: {
          contact_id: string
          contact_name: string
          current_due: number
          days_1_30: number
          days_31_60: number
          days_61_90: number
          days_90_plus: number
          total_due: number
        }[]
      }
      report_cash_flow: {
        Args: {
          p_bucket?: string
          p_from: string
          p_tenant_id: string
          p_to: string
        }
        Returns: {
          inflow: number
          net: number
          outflow: number
          period: string
        }[]
      }
      report_expense_breakdown: {
        Args: { p_from?: string; p_tenant_id: string; p_to?: string }
        Returns: {
          entry_count: number
          expense_group: Database["public"]["Enums"]["expense_group"]
          total: number
        }[]
      }
      report_expenses: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_name_my: string
          amount: number
          entry_count: number
          share: number
        }[]
      }
      report_income: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_name_my: string
          amount: number
          entry_count: number
          share: number
        }[]
      }
      report_profit_loss: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          amount: number
          section: string
        }[]
      }
      report_sales: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          amount: number
          invoice_count: number
          label: string
          section: string
        }[]
      }
      report_sales_trend: {
        Args: { p_from?: string; p_tenant_id: string; p_to?: string }
        Returns: {
          day: string
          expenses: number
          orders: number
          sales: number
        }[]
      }
      report_stock_valuation: {
        Args: { p_tenant_id: string; p_warehouse_id?: string }
        Returns: {
          avg_cost: number
          name: string
          name_my: string
          product_id: string
          quantity: number
          retail_value: number
          sku: string
          stock_value: number
          unit: string
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      report_top_products: {
        Args: {
          p_from?: string
          p_limit?: number
          p_tenant_id: string
          p_to?: string
        }
        Returns: {
          name: string
          product_id: string
          quantity: number
          revenue: number
        }[]
      }
      seed_default_accounts: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      set_member_status: {
        Args: {
          p_membership_id: string
          p_status: Database["public"]["Enums"]["membership_status"]
        }
        Returns: {
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_at: string
          invited_by: string | null
          invited_email: string | null
          invited_phone: string | null
          joined_at: string | null
          permission_overrides: Json
          revoked_at: string | null
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
          warehouse_scope: string[]
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_tenant_ids: { Args: never; Returns: string[] }
      user_warehouse_scope: { Args: { p_tenant_id: string }; Returns: string[] }
      void_invoice: {
        Args: { p_invoice_id: string; p_reason?: string }
        Returns: {
          balance_due: number | null
          contact_id: string | null
          contact_snapshot: Json
          cost_total: number
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          discount_amount: number
          due_date: string | null
          exchange_rate: number
          id: string
          issue_date: string
          issued_at: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          notes: string | null
          number: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipping_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          terms: string | null
          total: number
          total_base: number | null
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_transaction: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: {
          account_id: string | null
          amount: number
          amount_base: number | null
          attachment_url: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          custom_fields: Json
          description: string | null
          exchange_rate: number
          id: string
          invoice_id: string | null
          occurred_on: string
          payment_account_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tax_amount: number
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      audit_action:
        | "insert"
        | "update"
        | "delete"
        | "login"
        | "export"
        | "void"
        | "restore"
      business_type:
        | "retail"
        | "service"
        | "restaurant"
        | "wholesale"
        | "manufacturing"
        | "other"
      contact_kind: "customer" | "supplier" | "both"
      custom_field_entity:
        | "product"
        | "contact"
        | "transaction"
        | "invoice"
        | "invoice_item"
        | "warehouse"
        | "member"
      custom_field_type:
        | "text"
        | "textarea"
        | "number"
        | "decimal"
        | "date"
        | "datetime"
        | "boolean"
        | "select"
        | "multiselect"
        | "email"
        | "phone"
        | "url"
        | "barcode"
        | "file"
        | "currency"
      expense_group: "payroll" | "office" | "inventory" | "other"
      invoice_kind: "sales" | "purchase" | "quote" | "pos"
      invoice_status:
        | "draft"
        | "issued"
        | "partial"
        | "paid"
        | "overdue"
        | "void"
      membership_status: "invited" | "active" | "suspended" | "revoked"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "kbz_pay"
        | "wave_pay"
        | "aya_pay"
        | "cb_pay"
        | "card"
        | "credit"
        | "other"
      stock_move_kind:
        | "in"
        | "out"
        | "adjustment"
        | "transfer"
        | "sale"
        | "purchase"
        | "return"
        | "wastage"
      transaction_status: "draft" | "posted" | "void"
      transaction_type: "income" | "expense" | "transfer" | "journal"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      audit_action: [
        "insert",
        "update",
        "delete",
        "login",
        "export",
        "void",
        "restore",
      ],
      business_type: [
        "retail",
        "service",
        "restaurant",
        "wholesale",
        "manufacturing",
        "other",
      ],
      contact_kind: ["customer", "supplier", "both"],
      custom_field_entity: [
        "product",
        "contact",
        "transaction",
        "invoice",
        "invoice_item",
        "warehouse",
        "member",
      ],
      custom_field_type: [
        "text",
        "textarea",
        "number",
        "decimal",
        "date",
        "datetime",
        "boolean",
        "select",
        "multiselect",
        "email",
        "phone",
        "url",
        "barcode",
        "file",
        "currency",
      ],
      expense_group: ["payroll", "office", "inventory", "other"],
      invoice_kind: ["sales", "purchase", "quote", "pos"],
      invoice_status: ["draft", "issued", "partial", "paid", "overdue", "void"],
      membership_status: ["invited", "active", "suspended", "revoked"],
      payment_method: [
        "cash",
        "bank_transfer",
        "kbz_pay",
        "wave_pay",
        "aya_pay",
        "cb_pay",
        "card",
        "credit",
        "other",
      ],
      stock_move_kind: [
        "in",
        "out",
        "adjustment",
        "transfer",
        "sale",
        "purchase",
        "return",
        "wastage",
      ],
      transaction_status: ["draft", "posted", "void"],
      transaction_type: ["income", "expense", "transfer", "journal"],
    },
  },
} as const

