import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock in-memory outbox
  const outbox: any[] = [];

  // API Route for sending reminders
  app.post("/api/reminders/send", (req, res) => {
    const { email, gatheringTitle, date, time, location, subject, body } = req.body;
    
    if (!email || !gatheringTitle) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const emailContent = {
      id: Math.random().toString(36).substr(2, 9),
      to: email,
      subject: subject || `Reminder: ${gatheringTitle} is coming up!`,
      body: body || `Hi there! This is a reminder for "${gatheringTitle}".\n\nDate: ${date}\nTime: ${time}\nLocation: ${location}\n\nWe look forward to seeing you there!`,
      sentAt: new Date().toISOString()
    };

    outbox.push(emailContent);
    console.log(`[Email Sent] To: ${email} | Subject: ${emailContent.subject}`);
    
    res.json({ success: true, message: "Email reminder queued", email: emailContent });
  });

  app.get("/api/reminders/outbox", (req, res) => {
    res.json(outbox);
  });

  // API Route for Lyria music generation (lyria-3-clip-preview and lyria-3-pro-preview)
  app.post("/api/generate-music", async (req, res) => {
    const { prompt, duration, image } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: "GEMINI_API_KEY environment variable is not configured. Please define it in your AI Studio Secrets panel." 
        });
      }

      console.log(`[Lyria] Initializing GoogleGenAI client with key: ${apiKey.substring(0, 5)}...`);
      const ai = new GoogleGenAI({ apiKey });
      const modelName = duration === "full" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

      let imagePart: any = null;
      if (image) {
        if (image.startsWith("data:image/") && image.includes("base64,")) {
          const commaIdx = image.indexOf("base64,");
          const mimeType = image.substring(5, image.indexOf(";"));
          const base64Data = image.substring(commaIdx + 7);
          imagePart = {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || "image/jpeg"
            }
          };
        } else if (image.startsWith("http://") || image.startsWith("https://")) {
          try {
            console.log(`[Lyria] Fetching image from URL: ${image}...`);
            const imgRes = await fetch(image);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
              imagePart = {
                inlineData: {
                  data: buffer.toString("base64"),
                  mimeType: mimeType
                }
              };
              console.log(`[Lyria] Successfully fetched and encoded URL image. Size: ${buffer.length} bytes`);
            } else {
              console.warn(`[Lyria] Failed fetching photo. Status: ${imgRes.status}`);
            }
          } catch (fetchErr) {
            console.error("[Lyria] Error fetching image URL, proceeding with text prompt only:", fetchErr);
          }
        }
      }

      // If image is supplied, package as parts, else use prompt string
      const contents = imagePart 
        ? { parts: [{ text: prompt }, imagePart] } 
        : prompt;

      console.log(`[Lyria] Generating content stream with model: ${modelName}, prompt: "${prompt}"...`);

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
      });

      let audioBase64 = "";
      let lyrics = "";
      let responseMimeType = "audio/wav";

      for await (const chunk of responseStream) {
        const candidates = (chunk as any).candidates;
        const parts = candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              responseMimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        return res.status(500).json({ error: "No audio data was returned by the music generation stream." });
      }

      console.log(`[Lyria] Successfully completed generating music! Mime: ${responseMimeType}, base64 length: ${audioBase64.length}`);

      res.json({
        success: true,
        model: modelName,
        audioBase64,
        mimeType: responseMimeType,
        lyrics,
        prompt
      });

    } catch (err: any) {
      console.error("[Music Generation Server Error]", err);
      res.status(500).json({ 
        error: err.message || "An unexpected error occurred during music generation." 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
