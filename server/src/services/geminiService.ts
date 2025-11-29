import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { enhancedMarketIntelligence, tavilyMarketScan, apifyInstagramScrape } from './enhancedIntelligence';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const API_KEY = process.env.GEMINI_API_KEY || '';
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

const extractSources = (response: any): any[] => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
        .filter((c: any) => c.web?.uri && c.web?.title)
        .map((c: any) => ({
            title: c.web.title,
            uri: c.web.uri
        }));
};

export const fetchTopRestaurants = async (city: string) => {
  try {
    // PHASE 2: Enhanced with Tavily
    let tavilyContext = '';
    try {
      const tavilyData = await tavilyMarketScan(city);
      if (tavilyData.results.length > 0) {
        tavilyContext = `\n\nVERIFIED MARKET DATA FROM TAVILY:\n${tavilyData.results.slice(0, 5).map((r: any) => `- ${r.title}: ${r.url}`).join('\n')}\nSummary: ${tavilyData.answer}`;
      }
    } catch (e) {
      console.log('Tavily unavailable, using Gemini only');
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Act as a high-frequency trading algorithm. Scan for the most liquid restaurant reservations in ${city}.
      
      EXECUTE SEARCH QUERIES:
      1. "site:appointmenttrader.com ${city} buy reservation price"
      2. "site:reddit.com/r/finedining ${city} difficult reservation"
      3. "most expensive restaurant reservations ${city} ${new Date().getFullYear()}"
      ${tavilyContext}

      CRITICAL PRICING RULES:
      - estimatedResaleValue MUST be a positive number > 0
      - For "Impossible" difficulty (Rao's, etc): typically $500-$1000+
      - For "High" difficulty (Carbone, Don Angie, etc): typically $200-$600
      - For "Medium" difficulty: typically $100-$300
      - priceLow should be ~70% of estimatedResaleValue
      - priceHigh should be ~140% of estimatedResaleValue
      - NEVER return 0 for any price field
      
      Generate a JSON array of 6 objects:
      - name (string)
      - cuisine (string)
      - estimatedResaleValue (number, MUST BE > 0)
      - priceLow (number, MUST BE > 0)
      - priceHigh (number, MUST BE > 0)
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
      const data = parseJsonFromText<any[]>(response.text);
      const sources = extractSources(response);
      
      if (data) {
        // Validate and sanitize pricing data - fix $0 issues
        return data.map(r => {
          let estimatedResaleValue = Number(r.estimatedResaleValue) || 0;
          let priceLow = Number(r.priceLow) || 0;
          let priceHigh = Number(r.priceHigh) || 0;
          
          // If price is 0 or invalid, estimate based on difficulty level
          if (estimatedResaleValue <= 0) {
            const difficultyPrices: Record<string, number> = {
              'Impossible': 750,
              'High': 400,
              'Medium': 200,
              'Low': 75
            };
            estimatedResaleValue = difficultyPrices[r.difficultyLevel] || 250;
            priceLow = Math.round(estimatedResaleValue * 0.7);
            priceHigh = Math.round(estimatedResaleValue * 1.4);
          }
          
          // Ensure price range makes sense
          if (priceLow <= 0) priceLow = Math.round(estimatedResaleValue * 0.7);
          if (priceHigh <= 0) priceHigh = Math.round(estimatedResaleValue * 1.4);
          if (priceLow > estimatedResaleValue) priceLow = Math.round(estimatedResaleValue * 0.7);
          if (priceHigh < estimatedResaleValue) priceHigh = Math.round(estimatedResaleValue * 1.4);
          
          return { 
            ...r, 
            estimatedResaleValue,
            priceLow,
            priceHigh,
            sources,
            // Flag if we had to estimate
            dataConfidence: estimatedResaleValue === (Number(r.estimatedResaleValue) || 0) 
              ? (r.dataConfidence || 'Medium') 
              : 'Low'
          };
        });
      }
    }
    return [];
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    return [];
  }
};

export const fetchMarketInsight = async (restaurantName: string, city: string) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    // PHASE 2: Enhanced with Tavily + Firecrawl
    let enhancedContext = '';
    try {
      const intelligence = await enhancedMarketIntelligence(restaurantName, city);
      if (intelligence) {
        enhancedContext = `\n\nVERIFIED INTELLIGENCE:
${intelligence.tavilyAnswer}

DEEP CONTEXT (from scraped pages):
${intelligence.deepContext}

Data Confidence: ${intelligence.confidence}`;
      }
    } catch (e) {
      console.log('Enhanced intelligence unavailable, using Gemini only');
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Analyze the trading strategy for "${restaurantName}" in ${city}.
      
      TARGETED SOURCES:
      - site:resy.com "${restaurantName}"
      - site:exploretock.com "${restaurantName}"
      - site:reddit.com (Search for "release time", "how to book")

      TODAY'S DATE: ${currentDate}
      ${enhancedContext}

      CRITICAL: Calculate the EXACT NEXT drop date/time based on the restaurant's release pattern.
      
      Examples:
      - If they release "on the 1st of each month at 10 AM PST" and today is Nov 23, the next drop is Dec 1, 2024.
      - If they release "30 days in advance daily at 9 AM EST", the next drop is tomorrow at 9 AM.
      - If they release "every Tuesday at midnight", calculate the next Tuesday.

      Return JSON:
      - strategy (string, tactical advice)
      - peakTimes (array of strings)
      - platform (string, e.g. "Resy", "Tock")
      - riskFactor (string)
      - bookingUrl (string, the direct url to the restaurant's booking page)
      - nextDropDate (string, ISO format "YYYY-MM-DD" - the ACTUAL calendar date of the next drop)
      - nextDropTime (string, HH:MM 24h format e.g. "10:00")
      - dropTimezone (string, IANA timezone e.g. "America/Los_Angeles", "America/New_York")
      - dropPattern (string, human-readable e.g. "Monthly on the 1st at 10:00 AM PST")
      - releaseTime (string, HH:MM for backwards compatibility, can be same as nextDropTime)
      
      Return ONLY the JSON object.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    if (response.text) {
      const data = parseJsonFromText<any>(response.text);
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

export const generateTrendData = async (restaurantName: string) => {
    try {
         const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: `Generate a JSON array of 7 objects representing the last 7 days of resale value for ${restaurantName}.
            Keys: day (string "Mon"), value (number), volume (number).
            Make the data volatile.`,
            config: {
                responseMimeType: "application/json"
            }
        });
         if (response.text) {
            return parseJsonFromText<any[]>(response.text) || [];
        }
        return [];
    } catch (error) {
        console.error("Error chart data", error);
        return [];
    }
}

