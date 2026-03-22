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
          alert_type: string
          assigned_to: string | null
          created_at: string
          id: string
          message: string | null
          priority: Database["public"]["Enums"]["alert_priority"]
          read: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id: string | null
          reference_type: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          action_type?: string | null
          action_url?: string | null
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          action_type?: string | null
          action_url?: string | null
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          read?: boolean
          recipient?: Database["public"]["Enums"]["alert_recipient"]
          reference_id?: string | null
          reference_type?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
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
      attendance: {
        Row: {
          created_at: string
          created_by_id: string | null
          date: string
          employee_id: string
          id: string
          notes: string | null
          project_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          date?: string
          employee_id: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
          created_by: string | null
          created_by_id: string | null
          id: string
          is_closed: boolean
          kanban_filled: boolean
          notes: string | null
          project_id: string | null
          schedule_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_id?: string | null
          id?: string
          is_closed?: boolean
          kanban_filled?: boolean
          notes?: string | null
          project_id?: string | null
          schedule_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_id?: string | null
          id?: string
          is_closed?: boolean
          kanban_filled?: boolean
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
          obra_id: string | null
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
          obra_id?: string | null
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
          obra_id?: string | null
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
          fiscal_alert: boolean
          id: string
          intermediary_reason: string | null
          item_type: string
          nature: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          project_id: string | null
          project_name: string | null
          receiver_document: string | null
          receiver_id: string | null
          receiver_name: string | null
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
          project_name?: string | null
          receiver_document?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
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
          project_name?: string | null
          receiver_document?: string | null
          receiver_id?: string | null
          receiver_name?: string | null
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
          approved_by: string | null
          approved_by_id: string | null
          created_at: string
          id: string
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
          approved_by?: string | null
          approved_by_id?: string | null
          created_at?: string
          id?: string
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
          approved_by?: string | null
          approved_by_id?: string | null
          created_at?: string
          id?: string
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
        Relationships: []
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
            foreignKeyName: "measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          month: number
          notes?: string | null
          obra_id: string
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
          month?: number
          notes?: string | null
          obra_id?: string
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
      projects: {
        Row: {
          client: string | null
          client_cnpj: string | null
          client_name: string | null
          contract_value: number | null
          created_at: string
          empresa_faturadora: string
          end_date: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          lead_id: string | null
          location: string | null
          longitude: number | null
          name: string
          notes: string | null
          obra_id: string | null
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
          client_name?: string | null
          contract_value?: number | null
          created_at?: string
          empresa_faturadora?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          lead_id?: string | null
          location?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          obra_id?: string | null
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
          client_name?: string | null
          contract_value?: number | null
          created_at?: string
          empresa_faturadora?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          lead_id?: string | null
          location?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          obra_id?: string | null
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
          client_name: string | null
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
          opportunity_id: string | null
          payment_conditions: string | null
          rejected_at: string | null
          rejection_reason: string | null
          responsible: string | null
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
          client_name?: string | null
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
          opportunity_id?: string | null
          payment_conditions?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible?: string | null
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
          client_name?: string | null
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
          opportunity_id?: string | null
          payment_conditions?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          responsible?: string | null
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
      [_ in never]: never
    }
    Functions: {
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
      app_role: [
        "master",
        "diretor",
        "operacional",
        "sala_tecnica",
        "comercial",
        "financeiro",
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
