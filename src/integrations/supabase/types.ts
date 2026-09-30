export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      // ── incident_reports ───────────────────────────────────────────────────
      incident_reports: {
        Row: {
          id: string;
          report_code: string;
          // Required fields — NOT NULL in DB
          incident_at: string;
          location_text: string;
          description: string;
          consent_given: boolean;
          status: Database["public"]["Enums"]["report_status"];
          submission_mode: Database["public"]["Enums"]["submission_mode"];
          urgent_flag: boolean;
          is_moderated: boolean;
          created_at: string;
          updated_at: string;
          // Optional fields
          city: string | null;
          incident_type: Database["public"]["Enums"]["incident_type"] | null;
          injury_details: string | null;
          badge_or_unit: string | null;
          witness_name: string | null;
          witness_contact: string | null;
          reporter_name: string | null;
          reporter_contact: string | null;
          // Device GPS at report-submission time (not from media EXIF)
          gps_latitude: number | null;
          gps_longitude: number | null;
          gps_accuracy: number | null;
        };
        Insert: {
          id?: string;
          report_code?: string;
          incident_at: string;
          location_text: string;
          description: string;
          consent_given?: boolean;
          status?: Database["public"]["Enums"]["report_status"];
          submission_mode?: Database["public"]["Enums"]["submission_mode"];
          urgent_flag?: boolean;
          is_moderated?: boolean;
          created_at?: string;
          updated_at?: string;
          city?: string | null;
          incident_type?: Database["public"]["Enums"]["incident_type"] | null;
          injury_details?: string | null;
          badge_or_unit?: string | null;
          witness_name?: string | null;
          witness_contact?: string | null;
          reporter_name?: string | null;
          reporter_contact?: string | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          gps_accuracy?: number | null;
        };
        Update: {
          id?: string;
          report_code?: string;
          incident_at?: string;
          location_text?: string;
          description?: string;
          consent_given?: boolean;
          status?: Database["public"]["Enums"]["report_status"];
          submission_mode?: Database["public"]["Enums"]["submission_mode"];
          urgent_flag?: boolean;
          is_moderated?: boolean;
          created_at?: string;
          updated_at?: string;
          city?: string | null;
          incident_type?: Database["public"]["Enums"]["incident_type"] | null;
          injury_details?: string | null;
          badge_or_unit?: string | null;
          witness_name?: string | null;
          witness_contact?: string | null;
          reporter_name?: string | null;
          reporter_contact?: string | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          gps_accuracy?: number | null;
        };
        Relationships: [];
      };

      // ── report_evidence ────────────────────────────────────────────────────
      report_evidence: {
        Row: {
          id: string;
          report_id: string;
          storage_path: string;
          sha256: string;
          created_at: string;
          file_name: string | null;
          content_type: string | null;
          size_bytes: number | null;
          // EXIF / media-derived GPS and timestamp
          gps_latitude: number | null;
          gps_longitude: number | null;
          gps_accuracy_meters: number | null;
          media_timestamp: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          storage_path: string;
          sha256: string;
          created_at?: string;
          file_name?: string | null;
          content_type?: string | null;
          size_bytes?: number | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          gps_accuracy_meters?: number | null;
          media_timestamp?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          storage_path?: string;
          sha256?: string;
          created_at?: string;
          file_name?: string | null;
          content_type?: string | null;
          size_bytes?: number | null;
          gps_latitude?: number | null;
          gps_longitude?: number | null;
          gps_accuracy_meters?: number | null;
          media_timestamp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_evidence_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "incident_reports";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── report_status_history ──────────────────────────────────────────────
      report_status_history: {
        Row: {
          id: string;
          report_id: string;
          from_status: Database["public"]["Enums"]["report_status"] | null;
          to_status: Database["public"]["Enums"]["report_status"];
          changed_by: string | null;
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          from_status?: Database["public"]["Enums"]["report_status"] | null;
          to_status: Database["public"]["Enums"]["report_status"];
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          from_status?: Database["public"]["Enums"]["report_status"] | null;
          to_status?: Database["public"]["Enums"]["report_status"];
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_status_history_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "incident_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── resource_links ─────────────────────────────────────────────────────
      resource_links: {
        Row: {
          id: string;
          title: string;
          url: string;
          description: string | null;
          category: Database["public"]["Enums"]["resource_category"];
          is_published: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          url: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["resource_category"];
          is_published?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          url?: string;
          description?: string | null;
          category?: Database["public"]["Enums"]["resource_category"];
          is_published?: boolean;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ── user_roles ─────────────────────────────────────────────────────────
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      has_role: {
        Args: {
          _user_id: string;
          _role: Database["public"]["Enums"]["app_role"];
        };
        Returns: boolean;
      };
      public_incident_stats: {
        Args: {
          from_date?: string;
          to_date?: string;
          city_filter?: string;
        };
        Returns: {
          total_reports: number;
          by_city: Json;
          by_month: Json;
        }[];
      };
      log_report_status_change: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };

    Enums: {
      app_role: "admin" | "legal_partner";

      // Full set including moderation workflow values
      report_status:
        | "new"
        | "under_review"
        | "referred"
        | "closed"
        | "pending_moderation"
        | "moderation_approved"
        | "moderation_rejected";

      // Promoted from text column — DB enforces valid values
      incident_type:
        | "excessive_force"
        | "unlawful_detention"
        | "property_damage"
        | "harassment"
        | "wrongful_arrest"
        | "illegal_search"
        | "lack_of_due_process"
        | "other";

      // Promoted from text column
      submission_mode: "anonymous" | "identified";

      resource_category:
        | "legal_aid"
        | "know_your_rights"
        | "mental_health"
        | "journalist"
        | "complaint_authority"
        | "other";
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ── Convenience re-exports ────────────────────────────────────────────────────
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

// ── Runtime constants (enum values as arrays for UI dropdowns etc.) ───────────
export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "legal_partner"] as const,
      report_status: [
        "new",
        "under_review",
        "referred",
        "closed",
        "pending_moderation",
        "moderation_approved",
        "moderation_rejected",
      ] as const,
      incident_type: [
        "excessive_force",
        "unlawful_detention",
        "property_damage",
        "harassment",
        "wrongful_arrest",
        "illegal_search",
        "lack_of_due_process",
        "other",
      ] as const,
      submission_mode: ["anonymous", "identified"] as const,
      resource_category: [
        "legal_aid",
        "know_your_rights",
        "mental_health",
        "journalist",
        "complaint_authority",
        "other",
      ] as const,
    },
  },
} as const;
