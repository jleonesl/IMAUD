// Auto-generated from the live SITMAUD Supabase schema on 2026-11-14.
// Regenerate after schema changes; this file is a type snapshot, not a migration.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          adjustment_amount: number
          base_amount: number
          coefficient_snapshot: number | null
          consolidated_unit_count_snapshot: number | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          period_end: string
          period_start: string
          property_id: string
          status: string
          tariff_rule_id: string
          total_amount: number
          udc_currency_code: string | null
          udc_rate_id: string | null
          udc_value_snapshot: number | null
        }
        Insert: {
          adjustment_amount?: number
          base_amount: number
          coefficient_snapshot?: number | null
          consolidated_unit_count_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          period_end: string
          period_start: string
          property_id: string
          status?: string
          tariff_rule_id: string
          total_amount: number
          udc_currency_code?: string | null
          udc_rate_id?: string | null
          udc_value_snapshot?: number | null
        }
        Update: {
          adjustment_amount?: number
          base_amount?: number
          coefficient_snapshot?: number | null
          consolidated_unit_count_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          period_end?: string
          period_start?: string
          property_id?: string
          status?: string
          tariff_rule_id?: string
          total_amount?: number
          udc_currency_code?: string | null
          udc_rate_id?: string | null
          udc_value_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_tariff_rule_id_fkey"
            columns: ["tariff_rule_id"]
            isOneToOne: false
            referencedRelation: "tariff_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_udc_rate_id_fkey"
            columns: ["udc_rate_id"]
            isOneToOne: false
            referencedRelation: "udc_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          correlation_id: string | null
          entity_id: string | null
          entity_table: string
          id: number
          occurred_at: string
          request_ip: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_table: string
          id?: never
          occurred_at?: string
          request_ip?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_table?: string
          id?: never
          occurred_at?: string
          request_ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      citizen_accounts: {
        Row: {
          activated_at: string
          activated_by: string | null
          auth_user_id: string
          contributor_id: string
          identity_type: string
          is_active: boolean
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          auth_user_id: string
          contributor_id: string
          identity_type: string
          is_active?: boolean
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          auth_user_id?: string
          contributor_id?: string
          identity_type?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "citizen_accounts_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: true
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      condominium_typology_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_typology: string
          organization_id: string
          previous_typology: string | null
          reason: string
          sector_typology: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_typology: string
          organization_id: string
          previous_typology?: string | null
          reason: string
          sector_typology: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_typology?: string
          organization_id?: string
          previous_typology?: string | null
          reason?: string
          sector_typology?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominium_typology_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "residential_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contributor_documents: {
        Row: {
          contributor_id: string
          created_at: string
          description: string | null
          document_type: string
          id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          contributor_id: string
          created_at?: string
          description?: string | null
          document_type: string
          id?: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          contributor_id?: string
          created_at?: string
          description?: string | null
          document_type?: string
          id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributor_documents_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      contributors: {
        Row: {
          contact_address: string | null
          contact_parish_name: string | null
          contact_sector_name: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          identification_number: string
          identification_type: string
          is_property_owner: boolean | null
          kind: Database["public"]["Enums"]["contributor_kind"]
          last_name: string | null
          legal_name: string | null
          phone: string | null
          responsible_email: string | null
          responsible_identification: string | null
          responsible_name: string | null
          responsible_phone: string | null
          rif: string | null
          service_account_type: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_address?: string | null
          contact_parish_name?: string | null
          contact_sector_name?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          identification_number: string
          identification_type: string
          is_property_owner?: boolean | null
          kind: Database["public"]["Enums"]["contributor_kind"]
          last_name?: string | null
          legal_name?: string | null
          phone?: string | null
          responsible_email?: string | null
          responsible_identification?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          rif?: string | null
          service_account_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_address?: string | null
          contact_parish_name?: string | null
          contact_sector_name?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          identification_number?: string
          identification_type?: string
          is_property_owner?: boolean | null
          kind?: Database["public"]["Enums"]["contributor_kind"]
          last_name?: string | null
          legal_name?: string | null
          phone?: string | null
          responsible_email?: string | null
          responsible_identification?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          rif?: string | null
          service_account_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      demo_payment_allocations: {
        Row: {
          amount: number
          assessment_id: string
          demo_payment_id: string
          id: string
        }
        Insert: {
          amount: number
          assessment_id: string
          demo_payment_id: string
          id?: string
        }
        Update: {
          amount?: number
          assessment_id?: string
          demo_payment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_payment_allocations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_payment_allocations_demo_payment_id_fkey"
            columns: ["demo_payment_id"]
            isOneToOne: false
            referencedRelation: "demo_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_payment_treasury_events: {
        Row: {
          actor_user_id: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          payment_id: string
          prior_status: string
          reference: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          payment_id: string
          prior_status: string
          reference?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          payment_id?: string
          prior_status?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_payment_treasury_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "demo_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_payments: {
        Row: {
          amount: number
          bank_code: string | null
          contributor_id: string
          created_at: string
          currency_code: string
          external_reference: string | null
          id: string
          paid_at: string
          payment_method: string
          proof_mime_type: string | null
          proof_original_name: string | null
          proof_size_bytes: number | null
          proof_storage_path: string | null
          receipt_number: string
          registered_by: string
          treasury_bank_reference: string | null
          treasury_checked_at: string | null
          treasury_checked_by: string | null
          treasury_notes: string | null
          treasury_status: string
        }
        Insert: {
          amount: number
          bank_code?: string | null
          contributor_id: string
          created_at?: string
          currency_code?: string
          external_reference?: string | null
          id?: string
          paid_at?: string
          payment_method: string
          proof_mime_type?: string | null
          proof_original_name?: string | null
          proof_size_bytes?: number | null
          proof_storage_path?: string | null
          receipt_number: string
          registered_by: string
          treasury_bank_reference?: string | null
          treasury_checked_at?: string | null
          treasury_checked_by?: string | null
          treasury_notes?: string | null
          treasury_status?: string
        }
        Update: {
          amount?: number
          bank_code?: string | null
          contributor_id?: string
          created_at?: string
          currency_code?: string
          external_reference?: string | null
          id?: string
          paid_at?: string
          payment_method?: string
          proof_mime_type?: string | null
          proof_original_name?: string | null
          proof_size_bytes?: number | null
          proof_storage_path?: string | null
          receipt_number?: string
          registered_by?: string
          treasury_bank_reference?: string | null
          treasury_checked_at?: string | null
          treasury_checked_by?: string | null
          treasury_notes?: string | null
          treasury_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_payments_bank_code_fkey"
            columns: ["bank_code"]
            isOneToOne: false
            referencedRelation: "payment_banks"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "demo_payments_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_activity_archive: {
        Row: {
          action: string | null
          actor_legacy_id: string | null
          batch_id: string
          entity_id: string | null
          entity_table: string | null
          id: number
          occurred_at: string | null
          payload: Json
          source_event_id: string | null
        }
        Insert: {
          action?: string | null
          actor_legacy_id?: string | null
          batch_id: string
          entity_id?: string | null
          entity_table?: string | null
          id?: never
          occurred_at?: string | null
          payload?: Json
          source_event_id?: string | null
        }
        Update: {
          action?: string | null
          actor_legacy_id?: string | null
          batch_id?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: never
          occurred_at?: string | null
          payload?: Json
          source_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_activity_archive_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "legacy_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_id_map: {
        Row: {
          batch_id: string
          id: number
          source_id: string
          source_table: string
          target_id: string
          target_table: string
        }
        Insert: {
          batch_id: string
          id?: never
          source_id: string
          source_table: string
          target_id: string
          target_table: string
        }
        Update: {
          batch_id?: string
          id?: never
          source_id?: string
          source_table?: string
          target_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_id_map_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "legacy_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_import_batches: {
        Row: {
          completed_at: string | null
          id: string
          imported_record_counts: Json
          notes: string | null
          reconciliation: Json
          source_cutoff: string | null
          source_name: string
          source_record_counts: Json
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          imported_record_counts?: Json
          notes?: string | null
          reconciliation?: Json
          source_cutoff?: string | null
          source_name: string
          source_record_counts?: Json
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          imported_record_counts?: Json
          notes?: string | null
          reconciliation?: Json
          source_cutoff?: string | null
          source_name?: string
          source_record_counts?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      organization_units: {
        Row: {
          id: string
          is_active: boolean
          organization_id: string
          property_id: string
          unit_label: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          organization_id: string
          property_id: string
          unit_label: string
        }
        Update: {
          id?: string
          is_active?: boolean
          organization_id?: string
          property_id?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "residential_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      parishes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          assessment_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          assessment_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          assessment_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_banks: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          short_name: string
          source: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          short_name: string
          source?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          short_name?: string
          source?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          contributor_id: string
          created_at: string
          currency_code: string
          external_reference: string | null
          id: string
          paid_at: string | null
          payment_method: string
          receipt_number: string
          registered_by: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          contributor_id: string
          created_at?: string
          currency_code: string
          external_reference?: string | null
          id?: string
          paid_at?: string | null
          payment_method: string
          receipt_number: string
          registered_by?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          contributor_id?: string
          created_at?: string
          currency_code?: string
          external_reference?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          receipt_number?: string
          registered_by?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string
        }
        Insert: {
          code: string
          description: string
        }
        Update: {
          code?: string
          description?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          cadastral_code: string | null
          consolidated_units: number | null
          contract_number: string | null
          contributor_id: string
          created_at: string
          id: string
          is_active: boolean
          is_consolidated_master: boolean
          latitude: number | null
          longitude: number | null
          notes: string | null
          organization_id: string | null
          organization_name: string | null
          parish_id: string | null
          parish_name: string | null
          property_type: string
          property_use: string
          reference: string | null
          sector_id: string | null
          sector_name: string | null
          typology_override: string | null
          typology_override_reason: string | null
          updated_at: string
        }
        Insert: {
          address: string
          cadastral_code?: string | null
          consolidated_units?: number | null
          contract_number?: string | null
          contributor_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_consolidated_master?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          organization_id?: string | null
          organization_name?: string | null
          parish_id?: string | null
          parish_name?: string | null
          property_type?: string
          property_use?: string
          reference?: string | null
          sector_id?: string | null
          sector_name?: string | null
          typology_override?: string | null
          typology_override_reason?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          cadastral_code?: string | null
          consolidated_units?: number | null
          contract_number?: string | null
          contributor_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_consolidated_master?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          organization_id?: string | null
          organization_name?: string | null
          parish_id?: string | null
          parish_name?: string | null
          property_type?: string
          property_use?: string
          reference?: string | null
          sector_id?: string | null
          sector_name?: string | null
          typology_override?: string | null
          typology_override_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "residential_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      property_relationships: {
        Row: {
          contributor_id: string
          created_at: string
          ends_on: string | null
          id: string
          is_current: boolean
          is_payment_responsible: boolean
          notes: string | null
          property_id: string
          relationship_role: string
          source_legacy_id: string | null
          starts_on: string | null
        }
        Insert: {
          contributor_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          is_payment_responsible?: boolean
          notes?: string | null
          property_id: string
          relationship_role: string
          source_legacy_id?: string | null
          starts_on?: string | null
        }
        Update: {
          contributor_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          is_payment_responsible?: boolean
          notes?: string | null
          property_id?: string
          relationship_role?: string
          source_legacy_id?: string | null
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_relationships_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_relationships_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      residential_organizations: {
        Row: {
          billing_typology: string | null
          billing_typology_assigned_at: string | null
          billing_typology_assigned_by: string | null
          billing_typology_reason: string | null
          consolidated_billing: boolean
          contributor_id: string
          created_at: string
          display_name: string
          id: string
          notes: string | null
          organization_type: string
          representative_email: string | null
          representative_id: string | null
          representative_name: string | null
          representative_phone: string | null
          unit_count: number | null
        }
        Insert: {
          billing_typology?: string | null
          billing_typology_assigned_at?: string | null
          billing_typology_assigned_by?: string | null
          billing_typology_reason?: string | null
          consolidated_billing?: boolean
          contributor_id: string
          created_at?: string
          display_name: string
          id?: string
          notes?: string | null
          organization_type: string
          representative_email?: string | null
          representative_id?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          unit_count?: number | null
        }
        Update: {
          billing_typology?: string | null
          billing_typology_assigned_at?: string | null
          billing_typology_assigned_by?: string | null
          billing_typology_reason?: string | null
          consolidated_billing?: boolean
          contributor_id?: string
          created_at?: string
          display_name?: string
          id?: string
          notes?: string | null
          organization_type?: string
          representative_email?: string | null
          representative_id?: string | null
          representative_name?: string | null
          representative_phone?: string | null
          unit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "residential_organizations_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: true
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          default_typology: string | null
          id: string
          is_active: boolean
          name: string
          parish_id: string
        }
        Insert: {
          default_typology?: string | null
          id?: string
          is_active?: boolean
          name: string
          parish_id: string
        }
        Update: {
          default_typology?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parish_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          granted_at: string
          granted_by: string
          permission_code: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          permission_code: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          permission_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "staff_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      tariff_rules: {
        Row: {
          amount: number
          id: string
          notes: string | null
          parish_id: string | null
          property_type: string | null
          schedule_id: string
          sector_id: string | null
          typology_code: string
          unit_basis: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          parish_id?: string | null
          property_type?: string | null
          schedule_id: string
          sector_id?: string | null
          typology_code: string
          unit_basis: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          parish_id?: string | null
          property_type?: string | null
          schedule_id?: string
          sector_id?: string | null
          typology_code?: string
          unit_basis?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_rules_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_rules_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "tariff_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_rules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_schedules: {
        Row: {
          approved_by: string | null
          conversion_method: string | null
          created_at: string
          currency_unit: string
          id: string
          is_approved: boolean
          ordinance_reference: string
          title: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          approved_by?: string | null
          conversion_method?: string | null
          created_at?: string
          currency_unit: string
          id?: string
          is_approved?: boolean
          ordinance_reference: string
          title: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          approved_by?: string | null
          conversion_method?: string | null
          created_at?: string
          currency_unit?: string
          id?: string
          is_approved?: boolean
          ordinance_reference?: string
          title?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      udc_rates: {
        Row: {
          created_at: string
          effective_date: string
          fetched_at: string
          id: string
          rates_by_currency: Json
          source_name: string
          source_published_at: string | null
          source_url: string
          udc_currency_code: string
          udc_currency_name: string
          udc_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          fetched_at?: string
          id?: string
          rates_by_currency?: Json
          source_name?: string
          source_published_at?: string | null
          source_url: string
          udc_currency_code: string
          udc_currency_name: string
          udc_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          fetched_at?: string
          id?: string
          rates_by_currency?: Json
          source_name?: string
          source_published_at?: string | null
          source_url?: string
          udc_currency_code?: string
          udc_currency_name?: string
          udc_value?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_citizen_portal_account: {
        Args: { p_contributor_id: string; p_user_email: string }
        Returns: Json
      }
      calculate_udc_tariff: {
        Args: { p_period_date?: string; p_typology_code: string }
        Returns: {
          coefficient: number
          monthly_amount: number
          source_url: string
          typology_code: string
          udc_currency_code: string
          udc_currency_name: string
          udc_effective_date: string
          udc_value: number
        }[]
      }
      check_citizen_login_limit: { Args: { p_hash: string }; Returns: boolean }
      correct_sector_typology: {
        Args: { p_new_typology: string; p_reason: string; p_sector_id: string }
        Returns: {
          new_typology: string
          old_typology: string
          sector_id: string
        }[]
      }
      create_current_month_demo_obligation: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      get_dashboard_metrics: { Args: never; Returns: Json }
      get_demo_dashboard_metrics: { Args: never; Returns: Json }
      get_filtered_demo_report: {
        Args: {
          p_export?: boolean
          p_from: string
          p_kind: string
          p_to: string
        }
        Returns: Json
      }
      get_my_citizen_portal: { Args: never; Returns: Json }
      has_permission: { Args: { permission_code: string }; Returns: boolean }
      preview_sector_udc: {
        Args: { p_effective_date?: string; p_sector_id: string }
        Returns: {
          amount_bs: number
          coefficient: number
          parish_name: string
          sector_name: string
          tariff_approved: boolean
          typology_code: string
          udc_currency_code: string
          udc_effective_date: string
          udc_value: number
        }[]
      }
      register_demo_condominium: {
        Args: {
          p_address: string
          p_contributor_id: string
          p_display_name: string
          p_parish_id: string
          p_representative_id?: string
          p_representative_name?: string
          p_sector_id: string
          p_unit_count: number
        }
        Returns: Json
      }
      register_demo_condominium_full: {
        Args: {
          p_address: string
          p_billing_typology: string
          p_display_name: string
          p_email: string
          p_legal_name: string
          p_parish_id: string
          p_phone: string
          p_responsible_email: string
          p_responsible_id: string
          p_responsible_name: string
          p_responsible_phone: string
          p_rif: string
          p_sector_id: string
          p_typology_reason: string
          p_unit_count: number
        }
        Returns: Json
      }
      register_demo_condominium_with_typology: {
        Args: {
          p_address: string
          p_billing_typology?: string
          p_contributor_id: string
          p_display_name: string
          p_parish_id: string
          p_representative_id?: string
          p_representative_name?: string
          p_sector_id: string
          p_typology_reason?: string
          p_unit_count: number
        }
        Returns: Json
      }
      register_demo_payment: {
        Args: {
          p_assessment_ids: string[]
          p_bank_code?: string
          p_contributor_id: string
          p_method: string
          p_reference?: string
        }
        Returns: {
          amount: number
          paid_at: string
          payment_id: string
          periods_paid: number
          receipt_number: string
        }[]
      }
      register_demo_payment_with_proof: {
        Args: {
          p_assessment_ids: string[]
          p_bank_code?: string
          p_contributor_id: string
          p_method: string
          p_proof_original_name?: string
          p_proof_storage_path?: string
          p_reference?: string
        }
        Returns: {
          amount: number
          paid_at: string
          payment_id: string
          periods_paid: number
          receipt_number: string
        }[]
      }
      review_demo_payment_treasury: {
        Args: {
          p_action: string
          p_notes?: string
          p_payment_id: string
          p_reference?: string
        }
        Returns: Json
      }
      set_staff_permission: {
        Args: { p_code: string; p_enabled: boolean; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      contributor_kind: "natural_venezolano" | "natural_extranjero" | "juridico"
      payment_status: "pending" | "confirmed" | "reversed"
      staff_role: "intendente" | "administrador_analista" | "recaudador"
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
      contributor_kind: [
        "natural_venezolano",
        "natural_extranjero",
        "juridico",
      ],
      payment_status: ["pending", "confirmed", "reversed"],
      staff_role: ["intendente", "administrador_analista", "recaudador"],
    },
  },
} as const
