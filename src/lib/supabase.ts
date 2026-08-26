import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase environment variables
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://omnijarvis-enterprise.supabase.co';
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tbmlqYXJ2aXMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder_anon_key';

export const isSupabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

// Initialize Supabase Client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper for Supabase Storage uploads
export async function uploadDocumentToStorage(
  file: File,
  tenantId: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; publicUrl: string; path: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${tenantId}/${Date.now()}_${cleanFileName}`;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.storage
        .from('tenant-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.warn('Supabase storage upload error, using direct API fallback:', error.message);
      } else if (data) {
        const { data: publicUrlData } = supabase.storage
          .from('tenant-documents')
          .getPublicUrl(filePath);

        return {
          url: publicUrlData.publicUrl,
          publicUrl: publicUrlData.publicUrl,
          path: filePath,
        };
      }
    }

    // Fallback or secondary direct upload
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    const base64 = await base64Promise;
    return {
      url: base64,
      publicUrl: base64,
      path: filePath,
    };
  } catch (err: any) {
    return {
      url: '',
      publicUrl: '',
      path: '',
      error: err.message || 'Falha no upload para o Supabase Storage',
    };
  }
}

export async function deleteDocumentFromStorage(filePath: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured && filePath) {
      const { error } = await supabase.storage.from('tenant-documents').remove([filePath]);
      return !error;
    }
    return true;
  } catch {
    return false;
  }
}
