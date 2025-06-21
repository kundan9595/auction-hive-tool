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
      auction_results: {
        Row: {
          auction_id: string
          created_at: string | null
          id: string
          item_id: string
          original_bid_per_unit: number | null
          price_per_unit_paid: number | null
          quantity_sold: number | null
          quantity_won: number | null
          refund_amount: number | null
          winner_name: string | null
          winning_amount: number | null
          winning_bid_id: string | null
        }
        Insert: {
          auction_id: string
          created_at?: string | null
          id?: string
          item_id: string
          original_bid_per_unit?: number | null
          price_per_unit_paid?: number | null
          quantity_sold?: number | null
          quantity_won?: number | null
          refund_amount?: number | null
          winner_name?: string | null
          winning_amount?: number | null
          winning_bid_id?: string | null
        }
        Update: {
          auction_id?: string
          created_at?: string | null
          id?: string
          item_id?: string
          original_bid_per_unit?: number | null
          price_per_unit_paid?: number | null
          quantity_sold?: number | null
          quantity_won?: number | null
          refund_amount?: number | null
          winner_name?: string | null
          winning_amount?: number | null
          winning_bid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_results_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_results_winning_bid_id_fkey"
            columns: ["winning_bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          admin_id: string
          auction_type: Database["public"]["Enums"]["auction_type"]
          closed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          max_budget_per_bidder: number
          name: string
          slug: string
          status: Database["public"]["Enums"]["auction_status"]
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          auction_type?: Database["public"]["Enums"]["auction_type"]
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_budget_per_bidder: number
          name: string
          slug: string
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          auction_type?: Database["public"]["Enums"]["auction_type"]
          closed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_budget_per_bidder?: number
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bidder_registrations: {
        Row: {
          auction_id: string
          bidder_email: string
          bidder_name: string
          completed_at: string | null
          id: string
          registered_at: string
          status: string
        }
        Insert: {
          auction_id: string
          bidder_email: string
          bidder_name: string
          completed_at?: string | null
          id?: string
          registered_at?: string
          status?: string
        }
        Update: {
          auction_id?: string
          bidder_email?: string
          bidder_name?: string
          completed_at?: string | null
          id?: string
          registered_at?: string
          status?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          auction_id: string
          bid_amount: number
          bidder_email: string | null
          bidder_name: string
          created_at: string | null
          id: string
          item_id: string
          price_per_unit: number | null
          quantity_requested: number
        }
        Insert: {
          auction_id: string
          bid_amount: number
          bidder_email?: string | null
          bidder_name: string
          created_at?: string | null
          id?: string
          item_id: string
          price_per_unit?: number | null
          quantity_requested?: number
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          bidder_email?: string | null
          bidder_name?: string
          created_at?: string | null
          id?: string
          item_id?: string
          price_per_unit?: number | null
          quantity_requested?: number
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          auction_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          auction_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          auction_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          collection_id: string
          created_at: string | null
          description: string | null
          id: string
          inventory: number
          name: string
          sort_order: number | null
          starting_bid: number
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          inventory?: number
          name: string
          sort_order?: number | null
          starting_bid: number
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          inventory?: number
          name?: string
          sort_order?: number | null
          starting_bid?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_average_auction_results: {
        Args: { auction_id_param: string }
        Returns: undefined
      }
      generate_auction_slug: {
        Args: { auction_name: string }
        Returns: string
      }
    }
    Enums: {
      auction_status: "draft" | "active" | "closed"
      auction_type: "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      auction_status: ["draft", "active", "closed"],
      auction_type: ["closed"],
    },
  },
} as const
