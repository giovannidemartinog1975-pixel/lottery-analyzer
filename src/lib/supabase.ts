import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ubbivjwsgqnwuxswxejm.supabase.co'
const supabaseAnonKey = 'incolla_qui_la_tua_chiave_anon'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
