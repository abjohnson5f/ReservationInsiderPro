import { GoogleGenAI, Type } from "@google/genai";
import { Restaurant, MarketInsight, ChartDataPoint, Source } from "../types";

const API_KEY = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to extract JSON from text response which might contain markdown
const parseJsonFromText = <T>(text: string): T | null => {
  try {
    // Remove markdown code blocks if present
    let cleanText = text.replace(/```json\n?|\n?```/g, '');
    // Attempt to find the first array or object
    const firstBracket = cleanText.indexOf('{');
    const firstSquare = cleanText.indexOf('[');
    
    let startIndex = -1;
    let endIndex = -1;

    if (firstSquare !== -1 && (firstBracket === -1 || firstSquare < firstBracket)) {
        startIndex = firstSquare;
        endIndex = cleanText.lastIndexOf(']') + 1;
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        endIndex = cleanText.lastIndexOf('}') + 1;
    }

    if (startIndex !== -1 && endIndex !== -1) {
        cleanText = cleanText.substring(startIndex, endIndex);
        return JSON.parse(cleanText) as T;
    }
    
    return JSON.parse(cleanText) as T;
  } catch (e) {
    console.error("JSON Parsing failed", e);
    return null;
  }
};

const extractSources = (response: any): Source[] => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
        .filter((c: any) => c.web?.uri && c.web?.title)
        .map((c: any) => ({
            title: c.web.title,
            uri: c.web.uri
        }));
};

export const fetchTopRestaurants = async (city: string): Promise<Restaurant[]> => {
  try {
    // Simulating an Apify-style targeted crawl using Google Search Operators
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Act as a high-frequency trading algorithm. Scan for the most liquid restaurant reservations in ${city}.
      
      EXECUTE SEARCH QUERIES:
      1. "site:appointmenttrader.com ${city} buy reservation price"
      2. "site:reddit.com/r/finedining ${city} difficult reservation"
      3. "most expensive restaurant reservations ${city} ${new Date().getFullYear()}"

      Extract specific pricing data. If a range is found ($50-$200), use the average for 'estimatedResaleValue'.
      
      Generate a JSON array of 6 objects:
      - name (string)
      - cuisine (string)
      - estimatedResaleValue (number)
      - priceLow (number)
      - priceHigh (number)
      - dataConfidence ("High", "Medium", "Low")
      - popularityScore (number 0-100)
      - difficultyLevel ("Low", "Medium", "High", "Impossible")
      - bookingWindowTip (string, e.g., "Resy @ 9AM")
      - description (string, max 120 chars)
      - trend ("UP", "DOWN", "STABLE")
      
      Return ONLY the JSON array.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    if (response.text) {
      const data = parseJsonFromText<Restaurant[]>(response.text);
      const sources = extractSources(response);
      
      if (data) {
        return data.map(r => ({ ...r, sources }));
      }
    }
    return [];
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    return [];
  }
};

export const fetchMarketInsight = async (restaurantName: string, city: string): Promise<MarketInsight | null> => {
  try {
    // Simulating a Firecrawl deep-read of strategy forums
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the trading strategy for "${restaurantName}" in ${city}.
      
      TARGETED SOURCES:
      - site:reddit.com (Search for "how to book ${restaurantName}", "tips", "release time")
      - site:appointmenttrader.com (Search for "wanted" listings)
      - site:eater.com (Search for "how to get into ${restaurantName}")

      Identify the exact moment inventory is released and the platform used.
      
      Return JSON:
      - strategy (string, tactical advice)
      - peakTimes (array of strings)
      - platform (string)
      - riskFactor (string)
      
      Return ONLY the JSON object.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    if (response.text) {
      const data = parseJsonFromText<MarketInsight>(response.text);
      const sources = extractSources(response);
      
      if (data) {
        return { ...data, sources };
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching insights:", error);
    return null;
  }
};

export const generateTrendData = async (restaurantName: string): Promise<ChartDataPoint[]> => {
    try {
         const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a JSON array of 7 objects representing the last 7 days of resale value for ${restaurantName}.
            Keys: day (string "Mon"), value (number), volume (number).
            Make the data volatile.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            day: { type: Type.STRING },
                            value: { type: Type.NUMBER },
                            volume: { type: Type.NUMBER }
                        }
                    }
                }
            }
        });
         if (response.text) {
            return JSON.parse(response.text) as ChartDataPoint[];
        }
        return [];
    } catch (error) {
        console.error("Error chart data", error);
        return [];
    }
}