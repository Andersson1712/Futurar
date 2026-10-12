import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Credenciales centralizadas del proyecto (configuradas por el administrador)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://twlnvsznmljezvzbpqrj.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bG52c3pubWxqZXp2emJwcXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjMzODMsImV4cCI6MjA4NTYzOTM4M30.9sndlCA1dkEKqSq3lQpc8b9pTP4z40U3ZguvOFUqjpM';

// Cliente singleton de Supabase
// Auth only: data access goes through the backend (SPEC-034).
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
