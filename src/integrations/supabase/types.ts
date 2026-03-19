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
          alert_type: string
          created_at: string
          id: string
          message: string | null
          priority: Database["public"]["Enums"]["alert_priority"]
          read: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id: string | null
          reference_type: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient?: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          title?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          confirmed_at: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          project_id: string | null
          reasons: string | null
          status: string
          substituted_by: string | null
          substituted_by_name: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          project_id?: string | null
          reasons?: string | null
          status?: string
          substituted_by?: string | null
          substituted_by_name?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          project_id?: string | null
          reasons?: string | null
          status?: string
          substituted_by?: string | null
          substituted_by_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_substituted_by_fkey"
            columns: ["substituted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_rules: {
        Row: {
          benefit_type: string
          created_at: string
          daily_value: number | null
          effective_date: string | null
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          benefit_type: string
          created_at?: string
          daily_value?: number | null
          effective_date?: string | null
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          benefit_type?: string
          created_at?: string
          daily_value?: number | null
          effective_date?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          is_primary: boolean
          role: string | null
        }
        Insert: {
          client_id: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: string | null
        }
        Update: {
          client_id?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_id: string | null
          name: string
          notes: string | null
          phone: string | null
          segmento: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          segmento?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          segmento?: string | null
          state?: string | null
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
          notes: string | null
          obra_id: string | null
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
          notes?: string | null
          obra_id?: string | null
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
          notes?: string | null
          obra_id?: string | null
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
            foreignKeyName: "daily_schedule_entries_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
          created_by: string | null
          id: string
          is_closed: boolean
          notes: string | null
          schedule_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          schedule_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          schedule_date?: string
          status?: string
        }
        Relationships: []
      }
      daily_team_assignments: {
        Row: {
          created_at: string
          daily_schedule_id: string
          id: string
          location_override: string | null
          notes: string | null
          obra_id: string | null
          team_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          daily_schedule_id: string
          id?: string
          location_override?: string | null
          notes?: string | null
          obra_id?: string | null
          team_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          daily_schedule_id?: string
          id?: string
          location_override?: string | null
          notes?: string | null
          obra_id?: string | null
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
            foreignKeyName: "daily_team_assignments_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
      employee_absences: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          created_at: string
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payment_methods: {
        Row: {
          active: boolean | null
          bank: string | null
          created_at: string | null
          employee_id: string | null
          holder_name: string | null
          id: string
          intermediary_note: string | null
          is_intermediary: boolean | null
          key_value: string | null
          preference: string | null
          type: string
        }
        Insert: {
          active?: boolean | null
          bank?: string | null
          created_at?: string | null
          employee_id?: string | null
          holder_name?: string | null
          id?: string
          intermediary_note?: string | null
          is_intermediary?: boolean | null
          key_value?: string | null
          preference?: string | null
          type: string
        }
        Update: {
          active?: boolean | null
          bank?: string | null
          created_at?: string | null
          employee_id?: string | null
          holder_name?: string | null
          id?: string
          intermediary_note?: string | null
          is_intermediary?: boolean | null
          key_value?: string | null
          preference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payment_methods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_transport: {
        Row: {
          created_at: string
          daily_value: number | null
          employee_id: string
          id: string
          notes: string | null
          transport_type: string
        }
        Insert: {
          created_at?: string
          daily_value?: number | null
          employee_id: string
          id?: string
          notes?: string | null
          transport_type: string
        }
        Update: {
          created_at?: string
          daily_value?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
          transport_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_transport_employee_id_fkey"
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
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role: string
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: []
      }
      field_expense_items: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          expense_type: string
          id: string
          intermediary_reason: string | null
          nature: string
          paid_at: string | null
          payment_status: string
          project_id: string | null
          project_name: string | null
          receiver_id: string | null
          receiver_name: string | null
          sheet_id: string
          value: number
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          expense_type: string
          id?: string
          intermediary_reason?: string | null
          nature?: string
          paid_at?: string | null
          payment_status?: string
          project_id?: string | null
          project_name?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
          sheet_id: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          expense_type?: string
          id?: string
          intermediary_reason?: string | null
          nature?: string
          paid_at?: string | null
          payment_status?: string
          project_id?: string | null
          project_name?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
          sheet_id?: string
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
          approved_by: string | null
          created_at: string
          id: string
          period_end: string
          period_start: string
          return_comment: string | null
          status: string
          total_value: number | null
          updated_at: string
          week_ref: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          return_comment?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          week_ref: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          return_comment?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          week_ref?: string
        }
        Relationships: []
      }
      field_payment_items: {
        Row: {
          actual_receiver_id: string | null
          actual_receiver_name: string | null
          created_at: string
          daily_value: number | null
          days_worked: number | null
          description: string | null
          discount_value: number | null
          employee_id: string
          expense_type: string | null
          field_payment_id: string
          id: string
          intermediary_reason: string | null
          nature: string | null
          notes: string | null
          others_value: number | null
          paid_at: string | null
          paid_by: string | null
          payment_method_id: string | null
          payment_status: string | null
          project_id: string | null
          project_name: string | null
          total_value: number | null
          transport_value: number | null
          updated_at: string | null
        }
        Insert: {
          actual_receiver_id?: string | null
          actual_receiver_name?: string | null
          created_at?: string
          daily_value?: number | null
          days_worked?: number | null
          description?: string | null
          discount_value?: number | null
          employee_id: string
          expense_type?: string | null
          field_payment_id: string
          id?: string
          intermediary_reason?: string | null
          nature?: string | null
          notes?: string | null
          others_value?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          project_id?: string | null
          project_name?: string | null
          total_value?: number | null
          transport_value?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_receiver_id?: string | null
          actual_receiver_name?: string | null
          created_at?: string
          daily_value?: number | null
          days_worked?: number | null
          description?: string | null
          discount_value?: number | null
          employee_id?: string
          expense_type?: string | null
          field_payment_id?: string
          id?: string
          intermediary_reason?: string | null
          nature?: string | null
          notes?: string | null
          others_value?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          project_id?: string | null
          project_name?: string | null
          total_value?: number | null
          transport_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_payment_items_actual_receiver_id_fkey"
            columns: ["actual_receiver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_payment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_payment_items_field_payment_id_fkey"
            columns: ["field_payment_id"]
            isOneToOne: false
            referencedRelation: "field_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_payment_items_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "employee_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_payment_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      field_payments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["field_payment_status"] | null
          total_value: number | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["field_payment_status"] | null
          total_value?: number | null
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["field_payment_status"] | null
          total_value?: number | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      lead_interactions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          interaction_type: Database["public"]["Enums"]["lead_interaction_type"]
          lead_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: Database["public"]["Enums"]["lead_interaction_type"]
          lead_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: Database["public"]["Enums"]["lead_interaction_type"]
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
          cnpj: string | null
          company: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          name: string
          notes: string | null
          obra_id: string | null
          phone: string | null
          responsible: string | null
          servico: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          cnpj?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          name: string
          notes?: string | null
          obra_id?: string | null
          phone?: string | null
          responsible?: string | null
          servico?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          cnpj?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          name?: string
          notes?: string | null
          obra_id?: string | null
          phone?: string | null
          responsible?: string | null
          servico?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
          nf_data: string | null
          nf_numero: string | null
          notes: string | null
          obra_id: string | null
          pdf_signed_url: string | null
          period_end: string
          period_start: string
          retencao_pct: number
          status: string
          team_id: string | null
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
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          obra_id?: string | null
          pdf_signed_url?: string | null
          period_end: string
          period_start: string
          retencao_pct?: number
          status?: string
          team_id?: string | null
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
          nf_data?: string | null
          nf_numero?: string | null
          notes?: string | null
          obra_id?: string | null
          pdf_signed_url?: string | null
          period_end?: string
          period_start?: string
          retencao_pct?: number
          status?: string
          team_id?: string | null
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
            foreignKeyName: "measurements_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_schedules: {
        Row: {
          created_at: string
          end_date: string
          id: string
          month: number
          notes: string | null
          obra_id: string
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
          month: number
          notes?: string | null
          obra_id: string
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
          month?: number
          notes?: string | null
          obra_id?: string
          schedule_type?: string
          start_date?: string
          team_id?: string
          vehicle_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_schedules_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
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
      obras: {
        Row: {
          client: string | null
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
        }
        Update: {
          client?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          client: string | null
          client_id: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          responsible: string | null
          service: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
          value: number | null
        }
        Insert: {
          client?: string | null
          client_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          responsible?: string | null
          service?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          client?: string | null
          client_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          responsible?: string | null
          service?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account: string | null
          agency: string | null
          bank_name: string | null
          created_at: string
          employee_id: string
          id: string
          is_primary: boolean | null
          key_value: string | null
          type: string
        }
        Insert: {
          account?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_primary?: boolean | null
          key_value?: string | null
          type: string
        }
        Update: {
          account?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_primary?: boolean | null
          key_value?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reviews: {
        Row: {
          action: string
          comments: string | null
          created_at: string
          field_payment_id: string
          flagged_items: Json | null
          id: string
          reviewer: string | null
        }
        Insert: {
          action: string
          comments?: string | null
          created_at?: string
          field_payment_id: string
          flagged_items?: Json | null
          id?: string
          reviewer?: string | null
        }
        Update: {
          action?: string
          comments?: string | null
          created_at?: string
          field_payment_id?: string
          flagged_items?: Json | null
          id?: string
          reviewer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reviews_field_payment_id_fkey"
            columns: ["field_payment_id"]
            isOneToOne: false
            referencedRelation: "field_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_benefits: {
        Row: {
          almoco_type: string | null
          created_at: string
          has_restaurant: boolean | null
          has_ticker: boolean | null
          has_transport: boolean | null
          id: string
          is_active: boolean | null
          observations: string | null
          payment_day: string | null
          project_id: string
          project_name: string
          ticker_value: number | null
          transport_value: number | null
          updated_at: string
        }
        Insert: {
          almoco_type?: string | null
          created_at?: string
          has_restaurant?: boolean | null
          has_ticker?: boolean | null
          has_transport?: boolean | null
          id?: string
          is_active?: boolean | null
          observations?: string | null
          payment_day?: string | null
          project_id: string
          project_name: string
          ticker_value?: number | null
          transport_value?: number | null
          updated_at?: string
        }
        Update: {
          almoco_type?: string | null
          created_at?: string
          has_restaurant?: boolean | null
          has_ticker?: boolean | null
          has_transport?: boolean | null
          id?: string
          is_active?: boolean | null
          observations?: string | null
          payment_day?: string | null
          project_id?: string
          project_name?: string
          ticker_value?: number | null
          transport_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_benefits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          client_cnpj: string | null
          contract_value: number | null
          created_at: string
          empresa_faturadora: string
          end_date: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          responsible: string | null
          responsible_id: string | null
          service: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tipo_documento: string
          updated_at: string
        }
        Insert: {
          client?: string | null
          client_cnpj?: string | null
          contract_value?: number | null
          created_at?: string
          empresa_faturadora?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          responsible?: string | null
          responsible_id?: string | null
          service?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tipo_documento?: string
          updated_at?: string
        }
        Update: {
          client?: string | null
          client_cnpj?: string | null
          contract_value?: number | null
          created_at?: string
          empresa_faturadora?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          responsible?: string | null
          responsible_id?: string | null
          service?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tipo_documento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_activity_log: {
        Row: {
          action: string
          created_at: string
          daily_schedule_id: string
          details: string | null
          id: string
          new_status: string | null
          old_status: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          daily_schedule_id: string
          details?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          daily_schedule_id?: string
          details?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_activity_log_daily_schedule_id_fkey"
            columns: ["daily_schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          performed_by: string
          previous_status: string | null
          reason: string | null
          schedule_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          performed_by: string
          previous_status?: string | null
          reason?: string | null
          schedule_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          performed_by?: string
          previous_status?: string | null
          reason?: string | null
          schedule_id?: string | null
        }
        Relationships: []
      }
      schedule_reopen_history: {
        Row: {
          action: string
          created_at: string
          daily_schedule_id: string
          id: string
          performed_by: string | null
          reason: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          daily_schedule_id: string
          id?: string
          performed_by?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          daily_schedule_id?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_reopen_history_daily_schedule_id_fkey"
            columns: ["daily_schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
        ]
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
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          daily_rate: number | null
          home_address: string | null
          id: string
          km_current: number | null
          model: string
          owner_name: string | null
          plate: string
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
          km_current?: number | null
          model: string
          owner_name?: string | null
          plate: string
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
          km_current?: number | null
          model?: string
          owner_name?: string | null
          plate?: string
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
      attendance_status: "presente" | "falta" | "justificado" | "atrasado"
      employee_status:
        | "disponivel"
        | "ferias"
        | "licenca"
        | "afastado"
        | "desligado"
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
      opportunity_stage:
        | "prospeccao"
        | "qualificacao"
        | "proposta_enviada"
        | "negociacao"
        | "fechado_ganho"
        | "fechado_perdido"
      project_status:
        | "planejamento"
        | "execucao"
        | "entrega"
        | "faturamento"
        | "concluido"
        | "pausado"
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
      attendance_status: ["presente", "falta", "justificado", "atrasado"],
      employee_status: [
        "disponivel",
        "ferias",
        "licenca",
        "afastado",
        "desligado",
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
      ],
      opportunity_stage: [
        "prospeccao",
        "qualificacao",
        "proposta_enviada",
        "negociacao",
        "fechado_ganho",
        "fechado_perdido",
      ],
      project_status: [
        "planejamento",
        "execucao",
        "entrega",
        "faturamento",
        "concluido",
        "pausado",
      ],
      vehicle_status: ["disponivel", "em_uso", "manutencao", "indisponivel"],
    },
  },
} as const
