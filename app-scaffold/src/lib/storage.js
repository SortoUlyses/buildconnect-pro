// Shared helpers for the public "contractor-photos" Storage bucket, used for
// both the profile headshot (ProfileTab) and the before/after portfolio
// gallery (PhotosTab). RLS on storage.objects only allows a contractor to
// write under a path starting with their own auth.uid(), so every upload
// must be namespaced under `${contractorId}/...`.
import { supabase } from './supabaseClient.js';

const BUCKET = 'contractor-photos';

// Uploads a file and returns { path, url }, or { error } on failure. `path`
// must be kept around by the caller — it's what deleteContractorPhoto needs
// later, since the public URL alone doesn't identify the object for removal.
export async function uploadContractorPhoto(file, contractorId, subfolder = '') {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = subfolder ? `${contractorId}/${subfolder}/${filename}` : `${contractorId}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) return { error };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function deleteContractorPhoto(path) {
  if (!path) return { error: null };
  return supabase.storage.from(BUCKET).remove([path]);
}
