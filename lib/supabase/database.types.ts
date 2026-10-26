export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      reports: {
        Row: { id: string; title: string; activity_date: string; location: string; summary: string; body: string; cover_path: string | null; status: 'draft' | 'published'; published_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; activity_date: string; location?: string; summary?: string; body?: string; cover_path?: string | null; status?: 'draft' | 'published'; published_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; title?: string; activity_date?: string; location?: string; summary?: string; body?: string; cover_path?: string | null; status?: 'draft' | 'published'; published_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      report_media: {
        Row: { id: string; report_id: string; storage_path: string; media_type: 'photo' | 'video'; file_name: string; mime_type: string; file_size: number; caption: string | null; is_public: boolean; is_testimonial: boolean; sort_order: number; created_at: string };
        Insert: { id?: string; report_id: string; storage_path: string; media_type: 'photo' | 'video'; file_name: string; mime_type: string; file_size: number; caption?: string | null; is_public?: boolean; is_testimonial?: boolean; sort_order?: number; created_at?: string };
        Update: { id?: string; report_id?: string; storage_path?: string; media_type?: 'photo' | 'video'; file_name?: string; mime_type?: string; file_size?: number; caption?: string | null; is_public?: boolean; is_testimonial?: boolean; sort_order?: number; created_at?: string };
        Relationships: [{ foreignKeyName: 'report_media_report_id_fkey'; columns: ['report_id']; isOneToOne: false; referencedRelation: 'reports'; referencedColumns: ['id'] }];
      };
      report_links: {
        Row: { id: string; report_id: string; media_type: 'photos_album' | 'drive_video' | 'drive_document'; title: string; url: string; is_public: boolean; sort_order: number; created_at: string };
        Insert: { id?: string; report_id: string; media_type: 'photos_album' | 'drive_video' | 'drive_document'; title: string; url: string; is_public?: boolean; sort_order?: number; created_at?: string };
        Update: { id?: string; report_id?: string; media_type?: 'photos_album' | 'drive_video' | 'drive_document'; title?: string; url?: string; is_public?: boolean; sort_order?: number; created_at?: string };
        Relationships: [{ foreignKeyName: 'report_links_report_id_fkey'; columns: ['report_id']; isOneToOne: false; referencedRelation: 'reports'; referencedColumns: ['id'] }];
      };
    };
    Views: Record<string, never>;
    Functions: { is_admin: { Args: Record<string, never>; Returns: boolean } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
