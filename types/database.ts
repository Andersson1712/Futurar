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
            ai_config: {
                Row: {
                    id: string
                    active_provider: string
                    active_image_provider: string | null
                    gemini_api_key: string | null
                    openai_api_key: string | null
                    claude_api_key: string | null
                    groq_api_key: string | null
                    cloudflare_account_id: string | null
                    cloudflare_api_token: string | null
                    together_api_key: string | null
                    preferred_model: string | null
                    story_size: 'small' | 'medium' | 'large'
                    custom_story_structure: string | null
                    created_at: string | null
                    updated_at: string | null
                    freepik_api_key: string | null
                }
                Insert: {
                    id?: string
                    active_provider?: string
                    active_image_provider?: string | null
                    gemini_api_key?: string | null
                    openai_api_key?: string | null
                    claude_api_key?: string | null
                    groq_api_key?: string | null
                    cloudflare_account_id?: string | null
                    cloudflare_api_token?: string | null
                    together_api_key?: string | null
                    freepik_api_key?: string | null
                    preferred_model?: string | null
                    story_size?: 'small' | 'medium' | 'large'
                    custom_story_structure?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    active_provider?: string
                    active_image_provider?: string | null
                    gemini_api_key?: string | null
                    openai_api_key?: string | null
                    claude_api_key?: string | null
                    groq_api_key?: string | null
                    cloudflare_account_id?: string | null
                    cloudflare_api_token?: string | null
                    together_api_key?: string | null
                    freepik_api_key?: string | null
                    preferred_model?: string | null
                    story_size?: 'small' | 'medium' | 'large'
                    custom_story_structure?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            stories: {
                Row: {
                    content: string | null
                    created_at: string | null
                    dedication_position: string | null
                    dedication_reason: string | null
                    dedication_to: string | null
                    id: string
                    image_url: string | null
                    is_favorite: boolean | null
                    mission: string
                    protagonist: string
                    scenery: string
                    student_id: string
                    style: string
                    title: string
                    type: string | null
                    pages: Json | null
                }
                Insert: {
                    content?: string | null
                    created_at?: string | null
                    dedication_position?: string | null
                    dedication_reason?: string | null
                    dedication_to?: string | null
                    id?: string
                    image_url?: string | null
                    is_favorite?: boolean | null
                    mission: string
                    protagonist: string
                    scenery: string
                    student_id: string
                    style: string
                    title: string
                    type?: string | null
                    pages?: Json | null
                }
                Update: {
                    content?: string | null
                    created_at?: string | null
                    dedication_position?: string | null
                    dedication_reason?: string | null
                    dedication_to?: string | null
                    id?: string
                    image_url?: string | null
                    is_favorite?: boolean | null
                    mission?: string
                    protagonist?: string
                    scenery?: string
                    student_id?: string
                    style?: string
                    title?: string
                    type?: string | null
                    pages?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "stories_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            student_protagonists: {
                Row: {
                    id: string
                    student_id: string
                    label: string
                    icon: string
                    is_enabled: boolean | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    student_id: string
                    label: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    student_id?: string
                    label?: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_protagonists_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            student_scenarios: {
                Row: {
                    id: string
                    student_id: string
                    label: string
                    icon: string
                    is_enabled: boolean | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    student_id: string
                    label: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    student_id?: string
                    label?: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_scenarios_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            student_missions: {
                Row: {
                    id: string
                    student_id: string
                    label: string
                    icon: string
                    is_enabled: boolean | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    student_id: string
                    label: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    student_id?: string
                    label?: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_missions_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            student_styles: {
                Row: {
                    id: string
                    student_id: string
                    label: string
                    icon: string
                    is_enabled: boolean | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    student_id: string
                    label: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    student_id?: string
                    label?: string
                    icon?: string
                    is_enabled?: boolean | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_styles_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            student_settings: {
                Row: {
                    content_filter_level: string | null
                    font_size: string | null
                    id: string
                    max_stories_per_day: number | null
                    preferred_protagonists: string[] | null
                    preferred_sceneries: string[] | null
                    preferred_styles: string[] | null
                    scan_columns: number | null
                    scan_interval: number | null
                    sound_enabled: boolean | null
                    student_id: string
                    theme: string | null
                    updated_at: string | null
                    voice_feedback: boolean | null
                    story_length: 'short' | 'medium' | 'long' | null
                    target_audience: 'child' | 'adolescent' | 'adult' | 'all' | null
                }
                Insert: {
                    content_filter_level?: string | null
                    font_size?: string | null
                    id?: string
                    max_stories_per_day?: number | null
                    preferred_protagonists?: string[] | null
                    preferred_sceneries?: string[] | null
                    preferred_styles?: string[] | null
                    scan_columns?: number | null
                    scan_interval?: number | null
                    sound_enabled?: boolean | null
                    student_id: string
                    theme?: string | null
                    updated_at?: string | null
                    voice_feedback?: boolean | null
                    story_length?: 'short' | 'medium' | 'long' | null
                    target_audience?: 'child' | 'adolescent' | 'adult' | 'all' | null
                }
                Update: {
                    content_filter_level?: string | null
                    font_size?: string | null
                    id?: string
                    max_stories_per_day?: number | null
                    preferred_protagonists?: string[] | null
                    preferred_sceneries?: string[] | null
                    preferred_styles?: string[] | null
                    scan_columns?: number | null
                    scan_interval?: number | null
                    sound_enabled?: boolean | null
                    student_id?: string
                    theme?: string | null
                    updated_at?: string | null
                    voice_feedback?: boolean | null
                    story_length?: 'short' | 'medium' | 'long' | null
                    target_audience?: 'child' | 'adolescent' | 'adult' | 'all' | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_settings_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: true
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            students: {
                Row: {
                    age: number | null
                    avatar_icon: string | null
                    created_at: string | null
                    id: string
                    is_active: boolean | null
                    name: string
                    notes: string | null
                    updated_at: string | null
                }
                Insert: {
                    age?: number | null
                    avatar_icon?: string | null
                    created_at?: string | null
                    id?: string
                    is_active?: boolean | null
                    name: string
                    notes?: string | null
                    updated_at?: string | null
                }
                Update: {
                    age?: number | null
                    avatar_icon?: string | null
                    created_at?: string | null
                    id?: string
                    is_active?: boolean | null
                    name?: string
                    notes?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            usage_sessions: {
                Row: {
                    ended_at: string | null
                    id: string
                    started_at: string | null
                    stories_created: number | null
                    student_id: string
                    total_interactions: number | null
                }
                Insert: {
                    ended_at?: string | null
                    id?: string
                    started_at?: string | null
                    stories_created?: number | null
                    student_id: string
                    total_interactions?: number | null
                }
                Update: {
                    ended_at?: string | null
                    id?: string
                    started_at?: string | null
                    stories_created?: number | null
                    student_id?: string
                    total_interactions?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "usage_sessions_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
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
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenient aliases
export type AIConfig = Tables<'ai_config'>
export type Student = Tables<'students'>
export type StudentSettings = Tables<'student_settings'>
export type Story = Tables<'stories'>
export type UsageSession = Tables<'usage_sessions'>

// Student element types
export type StudentProtagonist = Tables<'student_protagonists'>
export type StudentScenario = Tables<'student_scenarios'>
export type StudentMission = Tables<'student_missions'>
export type StudentStyle = Tables<'student_styles'>

// Generic element type for UI components
export interface StudentElement {
    id: string;
    student_id: string;
    label: string;
    icon: string;
    is_enabled: boolean | null;
    created_at: string | null;
}
