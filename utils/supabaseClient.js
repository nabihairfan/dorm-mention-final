import { createClient } from '@supabase/supabase-js';

// Credentials from your screenshot
const SUPABASE_URL = 'https://secure.almostcrackd.ai';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY3VyZSIsImV4cCI6MjI0NzE4MzYwMH0.f-PaHNNbmZqcW1ram1vb3d5ZmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDc0ODg2MDB9'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);