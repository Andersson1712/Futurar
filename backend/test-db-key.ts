import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkApiKey() {
  const { data, error } = await supabase.from('ai_config').select('gemini_api_key, active_image_provider, preferred_image_model').limit(1);
  if (error) console.error(error);
  else {
      const key = data[0]?.gemini_api_key;
      console.log('Provider:', data[0]?.active_image_provider);
      console.log('Model:', data[0]?.preferred_image_model);
      console.log('Key length:', key?.length, 'Starts with:', key?.substring(0, 5));
      if (!key) return;

      console.log('\nTesteando limite directo de imagen 4...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${key}`;
      const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              contents: [{ parts: [{ text: "A cute cartoon robot" }] }],
              generationConfig: { responseModalities: ["IMAGE"] }
          })
      });
      const d = await res.json();
      console.log(JSON.stringify(d).substring(0, 300));
  }
}
checkApiKey();
