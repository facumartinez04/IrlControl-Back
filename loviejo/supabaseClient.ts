import { createClient } from '@supabase/supabase-js';

// ==================================================================================
// ⚠️ CONFIGURACIÓN DE BASE DE DATOS EN LA NUBE (SUPABASE) ⚠️
// ==================================================================================

const SUPABASE_URL = 'https://twufnrigqyhhtcnozawi.supabase.co';
// Fixed API Key: Added missing characters 'paa' in the signature
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3dWZucmlncXloaHRjbm96YXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MTc3MzMsImV4cCI6MjA4MDM5MzczM30.HdbE34TiQDEJBOiDo8XoapaaRzPL38R012XZ_zTUHp8';

// Si las credenciales existen, se crea el cliente. Si no, se usará LocalStorage.
export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;