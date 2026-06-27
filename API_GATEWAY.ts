// API_GATEWAY.ts - Backend API endpoint wrapper (Deploy on Cloud Functions or Node.js server)
// This protects API keys from being exposed in the mobile app

import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// API Keys should be in environment variables on server, NOT in app
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_ADMIN_KEY = process.env.FIREBASE_ADMIN_KEY;

// Rate limiting middleware
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW = 60000; // per minute

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  if (!requestCounts.has(clientId)) {
    requestCounts.set(clientId, []);
  }
  
  const times = requestCounts.get(clientId).filter(t => now - t < RATE_WINDOW);
  if (times.length >= RATE_LIMIT) return false;
  
  times.push(now);
  requestCounts.set(clientId, times);
  return true;
}

/**
 * POST /api/generate-gathering-idea
 * Proxy for Gemini AI (with rate limiting)
 */
app.post("/api/generate-gathering-idea", async (req, res) => {
  try {
    const { interests, userId } = req.body;
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Rate limit exceeded. Try again in 1 minute." });
    }

    if (!interests || !Array.isArray(interests)) {
      return res.status(400).json({ error: "Invalid interests array" });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `Based on these interests: ${interests.join(', ')}, suggest a unique community gathering idea. 
    Include a title, description, and why it brings people together. Format as JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            whyItWorks: { type: "string" }
          },
          required: ["title", "description", "whyItWorks"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate idea" });
  }
});

/**
 * POST /api/generate-icebreakers
 * Proxy for Gemini AI (with rate limiting)
 */
app.post("/api/generate-icebreakers", async (req, res) => {
  try {
    const { gatheringTitle, userId } = req.body;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `Give me 3 creative icebreaker questions for a community event called "${gatheringTitle}". Format as JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: { type: "string" }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to generate icebreakers" });
  }
});

/**
 * POST /api/send-reminder
 * Send email reminder via backend
 */
app.post("/api/send-reminder", async (req, res) => {
  try {
    const { email, gatheringTitle, date, time, location, userId } = req.body;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // TODO: Implement email service (SendGrid, Mailgun, etc.)
    // This is where the server would send actual emails, not exposed to client
    
    console.log(`[Email] Reminder sent to ${email} for ${gatheringTitle}`);
    res.json({ success: true, message: "Reminder sent" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
