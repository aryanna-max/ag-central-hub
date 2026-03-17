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
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          schedule_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          schedule_date?: string
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
          created_at: string
          daily_rate: number | null
          id: string
          km_current: number | null
          model: string
          plate: string
          status: Database["public"]["Enums"]["vehicle_status"]
          tracker_url: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          daily_rate?: number | null
          id?: string
          km_current?: number | null
          model: string
          plate: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          tracker_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          daily_rate?: number | null
          id?: string
          km_current?: number | null
          model?: string
          plate?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          tracker_url?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
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
      attendance_status: "presente" | "falta" | "justificado" | "atrasado"
      employee_status:
        | "disponivel"
        | "ferias"
        | "licenca"
        | "afastado"
        | "desligado"
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
      attendance_status: ["presente", "falta", "justificado", "atrasado"],
      employee_status: [
        "disponivel",
        "ferias",
        "licenca",
        "afastado",
        "desligado",
      ],
      vehicle_status: ["disponivel", "em_uso", "manutencao", "indisponivel"],
    },
  },
} as const
