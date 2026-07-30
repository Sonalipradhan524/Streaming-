const translate = require('translate');

// Use the API key from .env if provided, otherwise it falls back to the free web endpoints
if (process.env.TRANSLATION_API_KEY) {
  translate.engine = 'google';
  translate.key = process.env.TRANSLATION_API_KEY;
}

const translateText = async (text, targetLang) => {
  if (!text || targetLang === 'en' || !targetLang) return text;
  
  try {
    const result = await translate(text, targetLang);
    return result;
  } catch (err) {
    console.error(`Translation to ${targetLang} failed:`, err);
    return text; // Fallback to original text on failure
  }
};

module.exports = { translateText };
