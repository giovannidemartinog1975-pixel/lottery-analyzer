import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ubbivjwsgqnwuxswxejm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYml2andzZ3Fud3V4c3d4ZWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDkxMDMsImV4cCI6MjA5NTI4NTEwM30.t4ppGrp6TH4Nq0kWlWzRCkHiKkWftPF3Iv_4S3mB5LA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
