import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uzoigrgwacmzufxbxocx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6b2lncmd3YWNtenVmeGJ4b2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODMzMTUsImV4cCI6MjA4OTk1OTMxNX0.eI13rWLrABXCbizv_ZUsrhas4-mJbXEe10olCQYBxas'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)