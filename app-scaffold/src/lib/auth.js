import { supabase } from './supabaseClient.js';

// Thin wrappers around Supabase Auth. `metadata` becomes the new user's
// raw_user_metadata, which the database's signup trigger reads to create
// the matching profiles/consumer_profiles/contractor_profiles rows.
export const signUp = (email, password, metadata) =>
  supabase.auth.signUp({ email, password, options: { data: metadata } });

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();
