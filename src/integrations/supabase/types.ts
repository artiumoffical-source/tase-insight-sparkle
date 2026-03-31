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
      cached_fundamentals: {
        Row: {
          data: Json
          id: string
          last_updated: string
          ticker: string
        }
        Insert: {
          data?: Json
          id?: string
          last_updated?: string
          ticker: string
        }
        Update: {
          data?: Json
          id?: string
          last_updated?: string
          ticker?: string
        }
        Relationships: []
      }
      data_issue_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          reporter_email: string | null
          resolved: boolean
          ticker: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          reporter_email?: string | null
          resolved?: boolean
          ticker: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reporter_email?: string | null
          resolved?: boolean
          ticker?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          ai_body_he: string
          ai_summary_he: string
          ai_title_he: string
          author: string
          category: string
          created_at: string
          id: string
          original_date: string | null
          original_source: string
          original_title: string
          original_url: string
          published_at: string | null
          related_ticker: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_body_he?: string
          ai_summary_he?: string
          ai_title_he?: string
          author?: string
          category?: string
          created_at?: string
          id?: string
          original_date?: string | null
          original_source?: string
          original_title?: string
          original_url?: string
          published_at?: string | null
          related_ticker?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_body_he?: string
          ai_summary_he?: string
          ai_title_he?: string
          author?: string
          category?: string
          created_at?: string
          id?: string
          original_date?: string | null
          original_source?: string
          original_title?: string
          original_url?: string
          published_at?: string | null
          related_ticker?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_audit_results: {
        Row: {
          checks: Json
          created_at: string
          health: string
          id: string
          last_audited: string
          ticker: string
          verified_by_admin: boolean
        }
        Insert: {
          checks?: Json
          created_at?: string
          health?: string
          id?: string
          last_audited?: string
          ticker: string
          verified_by_admin?: boolean
        }
        Update: {
          checks?: Json
          created_at?: string
          health?: string
          id?: string
          last_audited?: string
          ticker?: string
          verified_by_admin?: boolean
        }
        Relationships: []
      }
      tase_symbols: {
        Row: {
          currency: string | null
          exchange: string
          id: string
          logo_url: string | null
          name: string
          name_he: string
          security_id: string | null
          ticker: string
          type: string | null
          updated_at: string
        }
        Insert: {
          currency?: string | null
          exchange?: string
          id?: string
          logo_url?: string | null
          name?: string
          name_he?: string
          security_id?: string | null
          ticker: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          currency?: string | null
          exchange?: string
          id?: string
          logo_url?: string | null
          name?: string
          name_he?: string
          security_id?: string | null
          ticker?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
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
      watchlist: {
        Row: {
          created_at: string
          id: string
          name: string
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          ticker: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
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
      app_role: ["superadmin", "admin", "user"],
    },
  },
} as const
