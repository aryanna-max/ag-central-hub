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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          action_label: string | null
          action_type: string | null
          action_url: string | null
          alert_status: string | null
          alert_type: string
          assigned_to: string | null
          created_at: string
          id: string
          message: string | null
          origem_modulo: string | null
          priority: Database["public"]["Enums"]["alert_priority"]
          read: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id: string | null
          reference_type: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          scheduled_at: string | null
          tipo: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          action_type?: string | null
          action_url?: string | null
          alert_status?: string | null
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string | null
          origem_modulo?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_at?: string | null
          tipo?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          action_type?: string | null
          action_url?: string | null
          alert_status?: string | null
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string | null
          origem_modulo?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient?: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scheduled_at?: string | null
          tipo?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          calendar_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          google_event_id: string | null
          id: string
          module: string
          related_id: string | null
          related_type: string | null
          title: string
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          google_event_id?: string | null
          id?: string
          module: string
          related_id?: string | null
          related_type?: string | null
          title: string
        }
        Update: {
          calendar_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          google_event_id?: string | null
          id?: string
          module?: string
          related_id?: string | null
          related_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          city: string | null
          cnpj: string | null
          codigo: string | null
          contato_cliente: string | null
          contato_financeiro: string | null
          created_at: string
          default_payment_days: number | null
          email: string | null
          estado: string | null
          financial_notes: string | null
          id: string
          is_active: boolean
          lead_id: string | null
          name: string
          notes: string | null
          numero: string | null
          phone: string | null
          requires_nf: boolean | null
          rua: string | null
          segmento: string | null
          state: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          city?: string | null
          cnpj?: string | null
          codigo?: string | null
          contato_cliente?: string | null
          contato_financeiro?: string | null
          created_at?: string
          default_payment_days?: number | null
          email?: string | null
          estado?: string | null
          financial_notes?: string | null
          id?: string
          is_active?: boolean
          lead_id?: string | null
          name: string
          notes?: string | null
          numero?: string | null
          phone?: string | null
          requires_nf?: boolean | null
          rua?: string | null
          segmento?: string | null
          state?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          city?: string | null
          cnpj?: string | null
          codigo?: string | null
          contato_cliente?: string | null
          contato_financeiro?: string | null
          created_at?: string
          default_payment_days?: number | null
          email?: string | null
          estado?: string | null
          financial_notes?: string | null
          id?: string
          is_active?: boolean
          lead_id?: string | null
          name?: string
          notes?: string | null
          numero?: string | null
          phone?: string | null
          requires_nf?: boolean | null
          rua?: string | null
          segmento?: string | null
          state?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedule_entries: {
        Row: {
          absence_reason: string | null
          attendance: Database["public"]["Enums"]["attendance_status"] | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          daily_schedule_id: string
          daily_team_assignment_id: string | null
          employee_id: string
          id: string
          is_vacation_override: boolean | null
          notes: string | null
          project_id: string | null
          removal_reason: Database["public"]["Enums"]["removal_reason"] | null
          removed_at: string | null
          team_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          absence_reason?: string | null
          attendance?: Database["public"]["Enums"]["attendance_status"] | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          daily_schedule_id: string
          daily_team_assignment_id?: string | null
          employee_id: string
          id?: string
          is_vacation_override?: boolean | null
          notes?: string | null
          project_id?: string | null
          removal_reason?: Database["public"]["Enums"]["removal_reason"] | null
          removed_at?: string | null
          team_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          absence_reason?: string | null
          attendance?: Database["public"]["Enums"]["attendance_status"] | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          daily_schedule_id?: string
          daily_team_assignment_id?: string | null
          employee_id?: string
          id?: string
          is_vacation_override?: boolean | null
          notes?: string | null
          project_id?: string | null
          removal_reason?: Database["public"]["Enums"]["removal_reason"] | null
          removed_at?: string | null
          team_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedule_entries_daily_schedule_id_fkey"
            columns: ["daily_schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_entries_daily_team_assignment_id_fkey"
            columns: ["daily_team_assignment_id"]
            isOneToOne: false
            referencedRelation: "daily_team_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedule_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_schedules: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by_id: string | null
          id: string
          is_closed: boolean
          is_legacy: boolean | null
          kanban_filled: boolean
          monthly_schedule_id: string | null
          notes: string | null
          project_id: string | null
          schedule_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_closed?: boolean
          is_legacy?: boolean | null
          kanban_filled?: boolean
          monthly_schedule_id?: string | null
          notes?: string | null
          project_id?: string | null
          schedule_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_closed?: boolean
          is_legacy?: boolean | null
          kanban_filled?: boolean
          monthly_schedule_id?: string | null
          notes?: string | null
          project_id?: string | null
          schedule_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedules_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedules_monthly_schedule_id_fkey"
            columns: ["monthly_schedule_id"]
            isOneToOne: false
            referencedRelation: "monthly_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_team_assignments: {
        Row: {
          created_at: string
          daily_schedule_id: string
          id: string
          location_override: string | null
          notes: string | null
          project_id: string | null
          team_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          daily_schedule_id: string
          id?: string
          location_override?: string | null
          notes?: string | null
          project_id?: string | null
          team_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          daily_schedule_id?: string
          id?: string
          location_override?: string | null
          notes?: string | null
          project_id?: string | null
          team_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_team_assignments_daily_schedule_id_fkey"
            columns: ["daily_schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_team_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_project_authorizations: {
        Row: {
          created_at: string | null
          docs: Json | null
          employee_id: string
          expiry_date: string | null
          id: string
          integration_date: string | null
          project_id: string
          registered_by: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          docs?: Json | null
          employee_id: string
          expiry_date?: string | null
          id?: string
          integration_date?: string | null
          project_id: string
          registered_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          docs?: Json | null
          employee_id?: string
          expiry_date?: string | null
          id?: string
          integration_date?: string | null
          project_id?: string
          registered_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_project_authorizations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_project_authorizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_project_authorizations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacations: {
        Row: {
          created_at: string | null
          created_by_id: string | null
          daily_rate: number | null
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          payment_method: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_id?: string | null
          daily_rate?: number | null
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_id?: string | null
          daily_rate?: number | null
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacations_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_vacations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          has_vt: boolean | null
          id: string
          matricula: string | null
          name: string
          phone: string | null
          photo_url: string | null
          role: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          vt_cash: boolean | null
          vt_value: number | null
        }
        Insert: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          has_vt?: boolean | null
          id?: string
          matricula?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          vt_cash?: boolean | null
          vt_value?: number | null
        }
        Update: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          has_vt?: boolean | null
          id?: string
          matricula?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          vt_cash?: boolean | null
          vt_value?: number | null
        }
        Relationships: []
      }
      field_expense_discounts: {
        Row: {
          amount: number
          created_at: string
          created_by_id: string | null
          discount_type: string
          id: string
          observation: string
          sheet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by_id?: string | null
          discount_type: string
          id?: string
          observation: string
          sheet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by_id?: string | null
          discount_type?: string
          id?: string
          observation?: string
          sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_expense_discounts_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_expense_discounts_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "field_expense_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      field_expense_items: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          expense_type: string
          fiscal_alert: boolean
          id: string
          intermediary_reason: string | null
          item_type: string
          nature: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          project_id: string | null
          receiver_id: string | null
          receiver_type: string | null
          sheet_id: string
          total_value: number | null
          value: number
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          expense_type: string
          fiscal_alert?: boolean
          id?: string
          intermediary_reason?: string | null
          item_type?: string
          nature?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          project_id?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sheet_id: string
          total_value?: number | null
          value?: number
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          expense_type?: string
          fiscal_alert?: boolean
          id?: string
          intermediary_reason?: string | null
          item_type?: string
          nature?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          project_id?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sheet_id?: string
          total_value?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "field_expense_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_expense_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_expense_items_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_expense_items_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "field_expense_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      field_expense_sheets: {
        Row: {
          approved_at: string | null
          approved_by_id: string | null
          codigo: string | null
          created_at: string
          id: string
          is_legacy: boolean | null
          period_end: string
          period_start: string
          project_id: string | null
          return_comment: string | null
          status: string
          total_value: number | null
          updated_at: string
          week_label: string | null
          week_number: number
          week_year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_id?: string | null
          codigo?: string | null
          created_at?: string
          id?: string
          is_legacy?: boolean | null
          period_end: string
          period_start: string
          project_id?: string | null
          return_comment?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          week_label?: string | null
          week_number: number
          week_year: number
        }
        Update: {
          approved_at?: string | null
          approved_by_id?: string | null
          codigo?: string | null
          created_at?: string
          id?: string
          is_legacy?: boolean | null
          period_end?: string
          period_start?: string
          project_id?: string | null
          return_comment?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          week_label?: string | null
          week_number?: number
          week_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "field_expense_sheets_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_expense_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string
          project_service_id: string | null
          value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          project_service_id?: string | null
          value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          project_service_id?: string | null
          value?: number
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
            foreignKeyName: "invoice_items_project_service_id_fkey"
            columns: ["project_service_id"]
            isOneToOne: false
            referencedRelation: "project_services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cnpj_tomador: string | null
          codigo: string | null
          created_at: string | null
          created_by_id: string | null
          empresa_faturadora:
            | Database["public"]["Enums"]["empresa_faturadora_enum"]
            | null
          id: string
          nf_data: string | null
          nf_numero: string | null
          notes: string | null
          project_id: string
          retencao: number | null
          status: string | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          updated_at: string | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          cnpj_tomador?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by_id?: string | null
          empresa_faturadora?:
            | Database["public"]["Enums"]["empresa_faturadora_enum"]
            | null
          id?: string
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          project_id: string
          retencao?: number | null
          status?: string | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          cnpj_tomador?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by_id?: string | null
          empresa_faturadora?:
            | Database["public"]["Enums"]["empresa_faturadora_enum"]
            | null
          id?: string
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          project_id?: string
          retencao?: number | null
          status?: string | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          interaction_type: string
          lead_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: string
          lead_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_id: string | null
          client_type: string | null
          cnpj: string | null
          codigo: string | null
          company: string | null
          converted_project_id: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          responsible_id: string | null
          servico: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          client_id?: string | null
          client_type?: string | null
          cnpj?: string | null
          codigo?: string | null
          company?: string | null
          converted_project_id?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          responsible_id?: string | null
          servico?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          client_id?: string | null
          client_type?: string | null
          cnpj?: string | null
          codigo?: string | null
          company?: string | null
          converted_project_id?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          responsible_id?: string | null
          servico?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          codigo_bm: string
          created_at: string | null
          dias_fds: number
          dias_semana: number
          empresa_faturadora: string
          id: string
          instrucao_faturamento: string | null
          nf_data: string | null
          nf_numero: string | null
          notes: string | null
          pdf_signed_url: string | null
          period_end: string
          period_start: string
          project_id: string | null
          project_service_id: string | null
          responsavel_cobranca_id: string | null
          retencao_pct: number
          status: string
          tipo_documento: string
          updated_at: string | null
          valor_bruto: number | null
          valor_diaria_fds: number
          valor_diaria_semana: number
          valor_nf: number | null
          valor_retencao: number | null
        }
        Insert: {
          codigo_bm: string
          created_at?: string | null
          dias_fds?: number
          dias_semana?: number
          empresa_faturadora?: string
          id?: string
          instrucao_faturamento?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          pdf_signed_url?: string | null
          period_end: string
          period_start: string
          project_id?: string | null
          project_service_id?: string | null
          responsavel_cobranca_id?: string | null
          retencao_pct?: number
          status?: string
          tipo_documento?: string
          updated_at?: string | null
          valor_bruto?: number | null
          valor_diaria_fds?: number
          valor_diaria_semana?: number
          valor_nf?: number | null
          valor_retencao?: number | null
        }
        Update: {
          codigo_bm?: string
          created_at?: string | null
          dias_fds?: number
          dias_semana?: number
          empresa_faturadora?: string
          id?: string
          instrucao_faturamento?: string | null
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          pdf_signed_url?: string | null
          period_end?: string
          period_start?: string
          project_id?: string | null
          project_service_id?: string | null
          responsavel_cobranca_id?: string | null
          retencao_pct?: number
          status?: string
          tipo_documento?: string
          updated_at?: string | null
          valor_bruto?: number | null
          valor_diaria_fds?: number
          valor_diaria_semana?: number
          valor_nf?: number | null
          valor_retencao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_project_service_id_fkey"
            columns: ["project_service_id"]
            isOneToOne: false
            referencedRelation: "project_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_responsavel_cobranca_id_fkey"
            columns: ["responsavel_cobranca_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_schedules: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_legacy: boolean | null
          month: number
          notes: string | null
          project_id: string | null
          schedule_type: string
          start_date: string
          team_id: string
          vehicle_id: string | null
          year: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_legacy?: boolean | null
          month: number
          notes?: string | null
          project_id?: string | null
          schedule_type?: string
          start_date: string
          team_id: string
          vehicle_id?: string | null
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_legacy?: boolean | null
          month?: number
          notes?: string | null
          project_id?: string | null
          schedule_type?: string
          start_date?: string
          team_id?: string
          vehicle_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_benefits: {
        Row: {
          almoco_diferenca_value: number | null
          almoco_type: string | null
          cafe_enabled: boolean | null
          cafe_value: number | null
          created_at: string | null
          dia_pagamento: string | null
          hospedagem_enabled: boolean | null
          hospedagem_type: string | null
          hospedagem_value: number | null
          id: string
          jantar_enabled: boolean | null
          jantar_value: number | null
          pagamento_antecipado: boolean | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          almoco_diferenca_value?: number | null
          almoco_type?: string | null
          cafe_enabled?: boolean | null
          cafe_value?: number | null
          created_at?: string | null
          dia_pagamento?: string | null
          hospedagem_enabled?: boolean | null
          hospedagem_type?: string | null
          hospedagem_value?: number | null
          id?: string
          jantar_enabled?: boolean | null
          jantar_value?: number | null
          pagamento_antecipado?: boolean | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          almoco_diferenca_value?: number | null
          almoco_type?: string | null
          cafe_enabled?: boolean | null
          cafe_value?: number | null
          created_at?: string | null
          dia_pagamento?: string | null
          hospedagem_enabled?: boolean | null
          hospedagem_type?: string | null
          hospedagem_value?: number | null
          id?: string
          jantar_enabled?: boolean | null
          jantar_value?: number | null
          pagamento_antecipado?: boolean | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_benefits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_scope_items: {
        Row: {
          completed_at: string | null
          completed_by_id: string | null
          created_at: string | null
          description: string
          id: string
          is_completed: boolean | null
          order_index: number
          project_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_completed?: boolean | null
          order_index?: number
          project_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_completed?: boolean | null
          order_index?: number
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_scope_items_completed_by_id_fkey"
            columns: ["completed_by_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_services: {
        Row: {
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          cnpj_tomador: string | null
          contract_value: number | null
          created_at: string | null
          daily_rate: number | null
          end_date: string | null
          id: string
          monthly_rate: number | null
          nf_date: string | null
          nf_number: string | null
          notes: string | null
          project_id: string
          proposal_id: string | null
          scope_description: string | null
          service_type: string
          start_date: string | null
          status: Database["public"]["Enums"]["service_status"]
          updated_at: string | null
        }
        Insert: {
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          cnpj_tomador?: string | null
          contract_value?: number | null
          created_at?: string | null
          daily_rate?: number | null
          end_date?: string | null
          id?: string
          monthly_rate?: number | null
          nf_date?: string | null
          nf_number?: string | null
          notes?: string | null
          project_id: string
          proposal_id?: string | null
          scope_description?: string | null
          service_type: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string | null
        }
        Update: {
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          cnpj_tomador?: string | null
          contract_value?: number | null
          created_at?: string | null
          daily_rate?: number | null
          end_date?: string | null
          id?: string
          monthly_rate?: number | null
          nf_date?: string | null
          nf_number?: string | null
          notes?: string | null
          project_id?: string
          proposal_id?: string | null
          scope_description?: string | null
          service_type?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_services_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          changed_by_id: string | null
          created_at: string | null
          from_status: string | null
          id: string
          modulo: string | null
          notes: string | null
          project_id: string
          to_status: string
        }
        Insert: {
          changed_by_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          modulo?: string | null
          notes?: string | null
          project_id: string
          to_status: string
        }
        Update: {
          changed_by_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          modulo?: string | null
          notes?: string | null
          project_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bairro: string | null
          billing_type: string | null
          cep: string | null
          cidade: string | null
          client_id: string | null
          cnpj_tomador: string | null
          codigo: string | null
          conta_bancaria: string | null
          contato_engenheiro: string | null
          contato_financeiro: string | null
          contract_value: number | null
          created_at: string
          delivered_at: string | null
          delivery_days_estimated: number | null
          delivery_deadline: string | null
          empresa_faturadora: string
          end_date: string | null
          estado: string | null
          execution_status:
            | Database["public"]["Enums"]["execution_status"]
            | null
          field_completed_at: string | null
          field_days_estimated: number | null
          field_deadline: string | null
          field_started_at: string | null
          id: string
          instrucao_faturamento_variavel: boolean | null
          is_active: boolean | null
          latitude: number | null
          lead_id: string | null
          location: string | null
          longitude: number | null
          name: string
          needs_tech_prep: boolean | null
          notes: string | null
          numero: string | null
          parent_project_id: string | null
          referencia_contrato: string | null
          responsible_campo_id: string | null
          responsible_comercial_id: string | null
          responsible_diretor_id: string | null
          responsible_id: string | null
          responsible_tecnico_id: string | null
          rua: string | null
          scope_description: string | null
          service: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          billing_type?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          cnpj_tomador?: string | null
          codigo?: string | null
          conta_bancaria?: string | null
          contato_engenheiro?: string | null
          contato_financeiro?: string | null
          contract_value?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_days_estimated?: number | null
          delivery_deadline?: string | null
          empresa_faturadora?: string
          end_date?: string | null
          estado?: string | null
          execution_status?:
            | Database["public"]["Enums"]["execution_status"]
            | null
          field_completed_at?: string | null
          field_days_estimated?: number | null
          field_deadline?: string | null
          field_started_at?: string | null
          id?: string
          instrucao_faturamento_variavel?: boolean | null
          is_active?: boolean | null
          latitude?: number | null
          lead_id?: string | null
          location?: string | null
          longitude?: number | null
          name: string
          needs_tech_prep?: boolean | null
          notes?: string | null
          numero?: string | null
          parent_project_id?: string | null
          referencia_contrato?: string | null
          responsible_campo_id?: string | null
          responsible_comercial_id?: string | null
          responsible_diretor_id?: string | null
          responsible_id?: string | null
          responsible_tecnico_id?: string | null
          rua?: string | null
          scope_description?: string | null
          service?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tipo_documento?: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          billing_type?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          cnpj_tomador?: string | null
          codigo?: string | null
          conta_bancaria?: string | null
          contato_engenheiro?: string | null
          contato_financeiro?: string | null
          contract_value?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_days_estimated?: number | null
          delivery_deadline?: string | null
          empresa_faturadora?: string
          end_date?: string | null
          estado?: string | null
          execution_status?:
            | Database["public"]["Enums"]["execution_status"]
            | null
          field_completed_at?: string | null
          field_days_estimated?: number | null
          field_deadline?: string | null
          field_started_at?: string | null
          id?: string
          instrucao_faturamento_variavel?: boolean | null
          is_active?: boolean | null
          latitude?: number | null
          lead_id?: string | null
          location?: string | null
          longitude?: number | null
          name?: string
          needs_tech_prep?: boolean | null
          notes?: string | null
          numero?: string | null
          parent_project_id?: string | null
          referencia_contrato?: string | null
          responsible_campo_id?: string | null
          responsible_comercial_id?: string | null
          responsible_diretor_id?: string | null
          responsible_id?: string | null
          responsible_tecnico_id?: string | null
          rua?: string | null
          scope_description?: string | null
          service?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_campo_id_fkey"
            columns: ["responsible_campo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_comercial_id_fkey"
            columns: ["responsible_comercial_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_diretor_id_fkey"
            columns: ["responsible_diretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_tecnico_id_fkey"
            columns: ["responsible_tecnico_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string
          id: string
          proposal_id: string
          quantity: number | null
          sort_order: number | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          proposal_id: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          proposal_id?: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          client_id: string | null
          code: string
          created_at: string
          discount_pct: number | null
          empresa_faturadora: string
          estimated_duration: string | null
          estimated_value: number | null
          final_value: number | null
          id: string
          lead_id: string | null
          location: string | null
          payment_conditions: string | null
          rejected_at: string | null
          rejection_reason: string | null
          responsible_id: string | null
          scope: string | null
          sent_at: string | null
          service: string | null
          status: string
          technical_notes: string | null
          title: string
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          approved_at?: string | null
          client_id?: string | null
          code: string
          created_at?: string
          discount_pct?: number | null
          empresa_faturadora?: string
          estimated_duration?: string | null
          estimated_value?: number | null
          final_value?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          payment_conditions?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible_id?: string | null
          scope?: string | null
          sent_at?: string | null
          service?: string | null
          status?: string
          technical_notes?: string | null
          title: string
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          approved_at?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          discount_pct?: number | null
          empresa_faturadora?: string
          estimated_duration?: string | null
          estimated_value?: number | null
          final_value?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          payment_conditions?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible_id?: string | null
          scope?: string | null
          sent_at?: string | null
          service?: string | null
          status?: string
          technical_notes?: string | null
          title?: string
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          employee_id: string
          id: string
          joined_at: string
          role: string
          team_id: string
        }
        Insert: {
          employee_id: string
          id?: string
          joined_at?: string
          role?: string
          team_id: string
        }
        Update: {
          employee_id?: string
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          default_project_id: string | null
          default_vehicle_id: string | null
          description: string | null
          id: string
          is_active: boolean
          leader_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_project_id?: string | null
          default_vehicle_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_project_id?: string | null
          default_vehicle_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_default_project_id_fkey"
            columns: ["default_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_default_vehicle_id_fkey"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_tasks: {
        Row: {
          assigned_to_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string
          scope_item_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id: string
          scope_item_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string
          scope_item_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_tasks_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tasks_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tasks_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "project_scope_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_payment_history: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          daily_rate: number
          days_count: number
          employee_id: string | null
          fuel_value: number
          id: string
          maintenance_value: number
          month: number
          notes: string | null
          period_end: string | null
          period_start: string | null
          status: string
          toll_value: number
          total_value: number
          vehicle_id: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          daily_rate: number
          days_count: number
          employee_id?: string | null
          fuel_value?: number
          id?: string
          maintenance_value?: number
          month: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          toll_value?: number
          total_value: number
          vehicle_id: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          daily_rate?: number
          days_count?: number
          employee_id?: string | null
          fuel_value?: number
          id?: string
          maintenance_value?: number
          month?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          toll_value?: number
          total_value?: number
          vehicle_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_payment_history_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_payment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_payment_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          daily_rate: number | null
          home_address: string | null
          id: string
          is_rented: boolean
          km_current: number | null
          model: string
          owner_name: string | null
          plate: string
          rental_end: string | null
          rental_start: string | null
          responsible_employee_id: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          tracker_url: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_rate?: number | null
          home_address?: string | null
          id?: string
          is_rented?: boolean
          km_current?: number | null
          model: string
          owner_name?: string | null
          plate: string
          rental_end?: string | null
          rental_start?: string | null
          responsible_employee_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tracker_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          daily_rate?: number | null
          home_address?: string | null
          id?: string
          is_rented?: boolean
          km_current?: number | null
          model?: string
          owner_name?: string | null
          plate?: string
          rental_end?: string | null
          rental_start?: string | null
          responsible_employee_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          tracker_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_prazos_criticos: {
        Row: {
          client_name: string | null
          codigo: string | null
          data_limite: string | null
          dias_restantes: number | null
          id: string | null
          modulo: string | null
          name: string | null
          rota: string | null
          tipo_prazo: string | null
        }
        Relationships: []
      }
      vw_tarefas_dia: {
        Row: {
          assigned_to_id: string | null
          created_by_id: string | null
          delivery_deadline: string | null
          due_date: string | null
          employee_name: string | null
          id: string | null
          project_codigo: string | null
          project_id: string | null
          project_name: string | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_tasks_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tasks_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      absence_type:
        | "ferias"
        | "licenca_medica"
        | "licenca_maternidade"
        | "licenca_paternidade"
        | "afastamento"
        | "falta"
        | "outros"
      alert_priority: "urgente" | "importante" | "informacao"
      alert_recipient:
        | "operacional"
        | "comercial"
        | "financeiro"
        | "rh"
        | "sala_tecnica"
        | "diretoria"
        | "todos"
      app_role:
        | "master"
        | "diretor"
        | "operacional"
        | "sala_tecnica"
        | "comercial"
        | "financeiro"
      attendance_status: "presente" | "falta" | "justificado" | "atrasado"
      billing_mode: "fixo_mensal" | "diarias" | "esporadico"
      employee_status:
        | "disponivel"
        | "ferias"
        | "licenca"
        | "afastado"
        | "desligado"
      empresa_faturadora_enum: "ag_topografia" | "ag_cartografia"
      execution_status:
        | "aguardando_campo"
        | "em_campo"
        | "campo_concluido"
        | "aguardando_processamento"
        | "em_processamento"
        | "revisao"
        | "aprovado"
        | "entregue"
        | "faturamento"
        | "pago"
      field_payment_status:
        | "rascunho"
        | "em_revisao"
        | "aprovada"
        | "paga"
        | "cancelada"
        | "submetido"
        | "devolvido"
      lead_interaction_type:
        | "nota"
        | "ligacao"
        | "email"
        | "whatsapp"
        | "reuniao"
        | "visita"
      lead_source:
        | "whatsapp"
        | "telefone"
        | "email"
        | "site"
        | "indicacao"
        | "rede_social"
        | "licitacao"
        | "outros"
      lead_status:
        | "novo"
        | "em_contato"
        | "qualificado"
        | "convertido"
        | "descartado"
        | "proposta_enviada"
        | "aprovado"
        | "perdido"
      measurement_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "aprovada"
        | "nf_emitida"
        | "paga"
        | "cancelada"
      project_status:
        | "planejamento"
        | "execucao"
        | "entrega"
        | "faturamento"
        | "concluido"
        | "pausado"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "aprovada"
        | "rejeitada"
        | "expirada"
      removal_reason:
        | "campo_concluido"
        | "pausa_temporaria"
        | "reagendado"
        | "clima"
        | "equipamento"
        | "falta_equipe"
      service_status:
        | "planejamento"
        | "execucao"
        | "medicao"
        | "faturamento"
        | "concluido"
        | "cancelado"
      tipo_documento: "nf" | "recibo"
      vehicle_status: "disponivel" | "em_uso" | "manutencao" | "indisponivel"
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
      absence_type: [
        "ferias",
        "licenca_medica",
        "licenca_maternidade",
        "licenca_paternidade",
        "afastamento",
        "falta",
        "outros",
      ],
      alert_priority: ["urgente", "importante", "informacao"],
      alert_recipient: [
        "operacional",
        "comercial",
        "financeiro",
        "rh",
        "sala_tecnica",
        "diretoria",
        "todos",
      ],
      app_role: [
        "master",
        "diretor",
        "operacional",
        "sala_tecnica",
        "comercial",
        "financeiro",
      ],
      attendance_status: ["presente", "falta", "justificado", "atrasado"],
      billing_mode: ["fixo_mensal", "diarias", "esporadico"],
      employee_status: [
        "disponivel",
        "ferias",
        "licenca",
        "afastado",
        "desligado",
      ],
      empresa_faturadora_enum: ["ag_topografia", "ag_cartografia"],
      execution_status: [
        "aguardando_campo",
        "em_campo",
        "campo_concluido",
        "aguardando_processamento",
        "em_processamento",
        "revisao",
        "aprovado",
        "entregue",
        "faturamento",
        "pago",
      ],
      field_payment_status: [
        "rascunho",
        "em_revisao",
        "aprovada",
        "paga",
        "cancelada",
        "submetido",
        "devolvido",
      ],
      lead_interaction_type: [
        "nota",
        "ligacao",
        "email",
        "whatsapp",
        "reuniao",
        "visita",
      ],
      lead_source: [
        "whatsapp",
        "telefone",
        "email",
        "site",
        "indicacao",
        "rede_social",
        "licitacao",
        "outros",
      ],
      lead_status: [
        "novo",
        "em_contato",
        "qualificado",
        "convertido",
        "descartado",
        "proposta_enviada",
        "aprovado",
        "perdido",
      ],
      measurement_status: [
        "rascunho",
        "aguardando_aprovacao",
        "aprovada",
        "nf_emitida",
        "paga",
        "cancelada",
      ],
      project_status: [
        "planejamento",
        "execucao",
        "entrega",
        "faturamento",
        "concluido",
        "pausado",
      ],
      proposal_status: [
        "rascunho",
        "enviada",
        "aprovada",
        "rejeitada",
        "expirada",
      ],
      removal_reason: [
        "campo_concluido",
        "pausa_temporaria",
        "reagendado",
        "clima",
        "equipamento",
        "falta_equipe",
      ],
      service_status: [
        "planejamento",
        "execucao",
        "medicao",
        "faturamento",
        "concluido",
        "cancelado",
      ],
      tipo_documento: ["nf", "recibo"],
      vehicle_status: ["disponivel", "em_uso", "manutencao", "indisponivel"],
    },
  },
} as const
