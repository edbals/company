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
      activity: {
        Row: {
          agent: string
          created_at: string
          entity_id: string | null
          id: string
          is_ai: boolean
          text: string
          user_id: string
        }
        Insert: {
          agent?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_ai?: boolean
          text: string
          user_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_ai?: boolean
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          ack_at: string | null
          ack_by: string | null
          created_at: string
          household_id: string
          id: string
          kind: string
          message: string
          plan_id: string | null
          user_id: string
        }
        Insert: {
          ack_at?: string | null
          ack_by?: string | null
          created_at?: string
          household_id: string
          id?: string
          kind: string
          message: string
          plan_id?: string | null
          user_id: string
        }
        Update: {
          ack_at?: string | null
          ack_by?: string | null
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          message?: string
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          turns: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          turns?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          turns?: Json
          user_id?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          option_id: string
          payload: Json
          quote_cost: number
          result: string | null
          status: string
          target_id: string
          undo_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          option_id: string
          payload?: Json
          quote_cost?: number
          result?: string | null
          status?: string
          target_id: string
          undo_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          option_id?: string
          payload?: Json
          quote_cost?: number
          result?: string | null
          status?: string
          target_id?: string
          undo_until?: string
          user_id?: string
        }
        Relationships: []
      }
      errands: {
        Row: {
          created_at: string
          id: string
          item: string
          need_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item: string
          need_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item?: string
          need_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          cost: number
          created_at: string
          description: string
          ends_at: string
          id: string
          owner_id: string | null
          place: string
          starts_at: string
          tags: string[]
          title: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          owner_id?: string | null
          place?: string
          starts_at: string
          tags?: string[]
          title: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          owner_id?: string | null
          place?: string
          starts_at?: string
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          pace: string
          status: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          pace?: string
          status?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          pace?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          elder_id: string
          id: string
        }
        Insert: {
          created_at?: string
          elder_id: string
          id?: string
        }
        Update: {
          created_at?: string
          elder_id?: string
          id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          household_id: string
          id: string
          revoked: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          household_id: string
          id?: string
          revoked?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          household_id?: string
          id?: string
          revoked?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_facts: {
        Row: {
          corrected_from: string | null
          created_at: string
          id: string
          kind: string
          source: string
          text: string
          user_id: string
        }
        Insert: {
          corrected_from?: string | null
          created_at?: string
          id?: string
          kind: string
          source?: string
          text: string
          user_id: string
        }
        Update: {
          corrected_from?: string | null
          created_at?: string
          id?: string
          kind?: string
          source?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          cost: number
          created_at: string
          ends_at: string
          event_id: string | null
          friend_name: string | null
          id: string
          pickup_at: string | null
          place: string
          ride_quote: number
          ride_status: string
          share_override: boolean | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          ends_at: string
          event_id?: string | null
          friend_name?: string | null
          id?: string
          pickup_at?: string | null
          place?: string
          ride_quote?: number
          ride_status?: string
          share_override?: boolean | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          ends_at?: string
          event_id?: string | null
          friend_name?: string | null
          id?: string
          pickup_at?: string | null
          place?: string
          ride_quote?: number
          ride_status?: string
          share_override?: boolean | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          consecutive_declines: number
          created_at: string
          declined_events: string[]
          display_name: string
          escalate_no_reply: boolean
          fewer_suggestions: boolean
          help_contact_consent: boolean
          id: string
          interests: string[]
          last_confirmed: string | null
          onboarded: boolean
          phone: string | null
          read_aloud: boolean
          ride_limit: number
          role: string | null
          share_errands: boolean
          share_outings: boolean
          share_plans: boolean
          timezone: string
        }
        Insert: {
          consecutive_declines?: number
          created_at?: string
          declined_events?: string[]
          display_name?: string
          escalate_no_reply?: boolean
          fewer_suggestions?: boolean
          help_contact_consent?: boolean
          id: string
          interests?: string[]
          last_confirmed?: string | null
          onboarded?: boolean
          phone?: string | null
          read_aloud?: boolean
          ride_limit?: number
          role?: string | null
          share_errands?: boolean
          share_outings?: boolean
          share_plans?: boolean
          timezone?: string
        }
        Update: {
          consecutive_declines?: number
          created_at?: string
          declined_events?: string[]
          display_name?: string
          escalate_no_reply?: boolean
          fewer_suggestions?: boolean
          help_contact_consent?: boolean
          id?: string
          interests?: string[]
          last_confirmed?: string | null
          onboarded?: boolean
          phone?: string | null
          read_aloud?: boolean
          ride_limit?: number
          role?: string | null
          share_errands?: boolean
          share_outings?: boolean
          share_plans?: boolean
          timezone?: string
        }
        Relationships: []
      }
      reminder_overrides: {
        Row: {
          at_time: string
          created_at: string
          id: string
          on_date: string
          reminder_id: string
          user_id: string
        }
        Insert: {
          at_time: string
          created_at?: string
          id?: string
          on_date: string
          reminder_id: string
          user_id: string
        }
        Update: {
          at_time?: string
          created_at?: string
          id?: string
          on_date?: string
          reminder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_overrides_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          at_time: string
          created_at: string
          id: string
          label: string
          moved_from: string | null
          user_id: string
        }
        Insert: {
          at_time: string
          created_at?: string
          id?: string
          label: string
          moved_from?: string | null
          user_id: string
        }
        Update: {
          at_time?: string
          created_at?: string
          id?: string
          label?: string
          moved_from?: string | null
          user_id?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          created_at: string
          household_id: string
          id: string
          kind: string
          responded_at: string | null
          responder_id: string | null
          status: string
          target_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          kind: string
          responded_at?: string | null
          responder_id?: string | null
          status?: string
          target_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          responded_at?: string | null
          responder_id?: string | null
          status?: string
          target_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      updates: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          plan_id: string | null
          text: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          household_id: string
          id?: string
          plan_id?: string | null
          text: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          plan_id?: string | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "updates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "updates_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_quota: {
        Row: {
          bucket: string
          used: number
          window_start: string
        }
        Insert: {
          bucket: string
          used?: number
          window_start: string
        }
        Update: {
          bucket?: string
          used?: number
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _code: string }; Returns: string }
      ack_alert: { Args: { _id: string }; Returns: undefined }
      cancel_decision: { Args: { _id: string }; Returns: string }
      check_escalations: { Args: { _hh: string }; Returns: undefined }
      commit_decision: {
        Args: { _id: string; _send_now: boolean }
        Returns: string
      }
      commit_decision_core: {
        Args: { _id: string; _send_now: boolean }
        Returns: string
      }
      create_decision: {
        Args: {
          _key: string
          _kind: string
          _option: string
          _payload: Json
          _shown_cost: number
          _target: string
        }
        Returns: Json
      }
      create_invitation: { Args: never; Returns: string }
      elder_household: { Args: never; Returns: Json }
      family_overview: { Args: never; Returns: Json }
      is_active_member: { Args: { _hh: string }; Returns: boolean }
      leave_household: { Args: { _hh: string }; Returns: undefined }
      my_household: { Args: never; Returns: string }
      purge_my_data: { Args: never; Returns: undefined }
      respond_request: {
        Args: { _accept: boolean; _id: string }
        Returns: string
      }
      revoke_invitations: { Args: never; Returns: undefined }
      run_scheduled: { Args: never; Returns: Json }
      set_family_pace: {
        Args: { _hh: string; _pace: string }
        Returns: undefined
      }
      set_member_status: {
        Args: { _member: string; _status: string }
        Returns: undefined
      }
      take_voice_quota: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
