const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // IMPORTANTE: Para leer el .env

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Verificación de seguridad para debug
if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL o SUPABASE_KEY no están definidos en el .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };