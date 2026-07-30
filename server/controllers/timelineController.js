const TimelineEvent = require('../models/TimelineEvent');
const Room = require('../models/Room');
const axios = require('axios'); // For AI API if needed

// @desc    Get all timeline events for a room
// @route   GET /api/timeline/:roomId
// @access  Private
exports.getTimelineEvents = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const events = await TimelineEvent.find({ room: room._id }).sort({ timestamp: 1 });
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching timeline events:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a custom timeline event
// @route   POST /api/timeline/:roomId
// @access  Private
exports.addTimelineEvent = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { type, title, description, icon, color, referenceId } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const newEvent = await TimelineEvent.create({
      room: room._id,
      type,
      title,
      description,
      icon,
      color,
      referenceId,
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error adding timeline event:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Generate AI Summary from timeline events
// @route   POST /api/timeline/:roomId/summary
// @access  Private
exports.generateAISummary = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const events = await TimelineEvent.find({ room: room._id }).sort({ timestamp: 1 });
    
    if (events.length === 0) {
      return res.status(200).json({ summary: "No events occurred during this meeting." });
    }

    // Build a prompt summarizing the timeline
    let prompt = "Summarize the following meeting timeline into a professional, concise paragraph highlighting key decisions, tasks, and important moments:\n\n";
    events.forEach(e => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      prompt += `[${time}] ${e.title}: ${e.description}\n`;
    });

    // In a real production app, we would use an LLM API (OpenAI, Gemini).
    // For this implementation, we will use a simulated AI response based on the events provided.
    // If the user has a TRANSLATION_API_KEY, we could theoretically use Gemini, but for safety and speed, we mock it.
    
    // Simple heuristic summary generator
    const decisions = events.filter(e => e.type === 'decision').length;
    const tasks = events.filter(e => e.type === 'task').length;
    const duration = events.length > 1 ? Math.round((new Date(events[events.length-1].timestamp) - new Date(events[0].timestamp))/60000) : 0;
    
    let simulatedSummary = `The meeting lasted for approximately ${duration} minutes. `;
    if (decisions > 0) simulatedSummary += `There were ${decisions} key decisions made. `;
    if (tasks > 0) simulatedSummary += `Participants assigned ${tasks} action items. `;
    
    const highlightEvents = events.filter(e => e.type === 'highlight' || e.type === 'decision' || e.type === 'task');
    if (highlightEvents.length > 0) {
      simulatedSummary += "Key moments included: " + highlightEvents.slice(0, 3).map(e => e.title).join(", ") + ".";
    }

    res.status(200).json({ summary: simulatedSummary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
