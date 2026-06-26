import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateGatheringIdea(interests: string[]) {
  const prompt = `Based on these interests: ${interests.join(', ')}, suggest a unique community gathering idea. 
  Include a title, a one-sentence description, and why it brings people together. 
  Format as JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          whyItWorks: { type: Type.STRING }
        },
        required: ["title", "description", "whyItWorks"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateIcebreakers(gatheringTitle: string) {
  const prompt = `Give me 3 creative icebreaker questions for a community event called "${gatheringTitle}". 
  Format as a JSON array of strings.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text);
}
