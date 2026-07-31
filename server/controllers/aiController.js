const { GoogleGenAI } = require('@google/genai');
const AIChat = require('../models/AIChat');
const translate = require('translate'); // Existing dependency in package.json

// Initialize Gemini with the API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to get the correct instructions for Gemini based on context and language
 */
const getSystemInstruction = (language) => {
  return `You are a highly capable AI Meeting Assistant for the LiveLink real-time streaming platform.
Your primary role is to help users by answering questions, summarizing meetings, and providing technical support.
Always respond clearly, concisely, and professionally. Use Markdown for formatting.
If the user provides meeting context (chat messages or timeline events), use that information to ground your answers.
IMPORTANT: You MUST reply in the following language: ${language}.`;
};

// @desc    Ask AI a question
// @route   POST /api/ai/ask
// @access  Private
exports.askQuestion = async (req, res) => {
  try {
    const { question, meetingId, context, language = 'English' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      const mockResponse = `**Configuration Required:** The AI Assistant is installed, but it needs a Google Gemini API Key to work.\n\nPlease open \`server/.env\` and add:\n\`GEMINI_API_KEY="your_api_key_here"\``;
      
      const mockChatEntry = await AIChat.create({
        user: req.user._id,
        meetingId: meetingId || 'global',
        question,
        response: mockResponse,
        language
      });

      return res.status(200).json({
        success: true,
        answer: mockResponse,
        chatId: mockChatEntry._id
      });
    }

    // Build the prompt with context
    let promptText = question;
    if (context) {
      promptText = `Context from current meeting:\n${context}\n\nUser Question: ${question}`;
    }

    // Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: promptText,
      config: {
        systemInstruction: getSystemInstruction(language),
        temperature: 0.7
      }
    });

    const aiResponseText = response.text;

    // Save interaction to database
    const chatEntry = await AIChat.create({
      user: req.user._id, // Assumes protect middleware
      meetingId: meetingId || 'global',
      question,
      response: aiResponseText,
      language
    });

    res.status(200).json({
      success: true,
      answer: aiResponseText,
      chatId: chatEntry._id
    });
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to process AI request. Please try again later.' });
  }
};

// @desc    Get AI Chat History
// @route   GET /api/ai/history/:meetingId?
// @access  Private
exports.getHistory = async (req, res) => {
  try {
    const { meetingId } = req.params;
    let query = { user: req.user._id };
    
    if (meetingId) {
      query.meetingId = meetingId;
    }

    const history = await AIChat.find(query).sort({ timestamp: 1 }).limit(50);
    
    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error('AI History Error:', error);
    res.status(500).json({ error: 'Failed to fetch AI history' });
  }
};
