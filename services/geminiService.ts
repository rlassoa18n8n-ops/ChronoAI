
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalyzedEvent, Project } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const calendarAnalysisSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The title or name of the event.',
      },
      durationHours: {
        type: Type.NUMBER,
        description: 'The duration of the event in hours (e.g., 1.5 for 1 hour 30 minutes).',
      },
      color: {
        type: Type.STRING,
        description: 'The dominant color of the event block as a hex code (e.g., "#FF5733"). If not detectable, use "#808080".',
      },
    },
    required: ['title', 'durationHours', 'color'],
  },
};

export const analyzeCalendarImage = async (base64Image: string): Promise<AnalyzedEvent[]> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: `Analyze this calendar image. Identify all events. For each event, extract the title, duration in hours, and the primary hex color of the event block. Provide the output in the requested JSON format. If a color is ambiguous, make a best guess.`,
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: calendarAnalysisSchema,
      },
    });
    
    const jsonText = response.text.trim();
    const data = JSON.parse(jsonText);
    return data as AnalyzedEvent[];
  } catch (error) {
    console.error('Error analyzing calendar image:', error);
    throw new Error('Failed to analyze the calendar image. Please try again.');
  }
};

export const getChatResponse = async (history: { role: string, parts: { text: string }[] }[], newMessage: string, projectData: Project[]): Promise<string> => {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are ChronoAI, a friendly and insightful time management assistant. The user's current time analysis summary is: ${JSON.stringify(projectData)}. Use this data to answer their questions about their time usage, projects, and productivity. Be helpful and encouraging.`,
    },
  });

  const response = await chat.sendMessage({ message: newMessage });
  return response.text;
};
