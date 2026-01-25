const dotenv = require('dotenv');
dotenv.config();

console.log('🧪 Testing configuration...');
console.log('📍 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : 'Not set');
console.log('📍 SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('📍 SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');

// Test Gemini 2.5 Flash
if (process.env.GEMINI_API_KEY) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  console.log('🤖 Testing Gemini 2.5 Flash...');
  model.generateContent('Is Braille important for accessibility? Answer in one sentence.')
    .then(result => {
      console.log('✅ Gemini 2.5 Flash working!');
      console.log('📝 Response:', result.response.text());
    })
    .catch(err => console.error('❌ Gemini error:', err.message));
} else {
  console.log('❌ GEMINI_API_KEY not found in environment');
}