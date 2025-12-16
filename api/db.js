require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️  Missing Supabase credentials!');
    console.error('Please set the following environment variables:');
    console.error('  - SUPABASE_URL=https://your-project.supabase.co');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('');
    console.error('Get these from: https://supabase.com/dashboard → Your Project → Settings → API');
    console.error('');
    // Create a mock client to prevent immediate crash
    supabase = null;
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('✅ Supabase client initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
        supabase = null;
    }
}

module.exports = supabase;
