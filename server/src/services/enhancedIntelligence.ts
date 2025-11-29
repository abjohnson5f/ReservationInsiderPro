import { tavily } from '@tavily/core';
import Firecrawl from '@mendable/firecrawl-js';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Initialize clients lazily to avoid errors when API keys are missing
const getTavilyClient = () => {
  if (!process.env.TAVILY_API_KEY) return null;
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
};

const getFirecrawlClient = () => {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  return new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
};

const getApifyClient = () => {
  if (!process.env.APIFY_API_TOKEN) return null;
  return new ApifyClient({ token: process.env.APIFY_API_TOKEN });
};

/**
 * Enhanced Market Scan using Tavily for cleaner, faster results
 * Replaces basic Google Search with structured data extraction
 */
export const tavilyMarketScan = async (city: string, restaurantName?: string) => {
  const tvly = getTavilyClient();
  if (!tvly) {
    console.log('[Tavily] API key not configured, skipping market scan');
    return { results: [], answer: '' };
  }

  try {
    const query = restaurantName 
      ? `${restaurantName} ${city} restaurant reservation resale price AppointmentTrader`
      : `high-end restaurant reservations ${city} resale market AppointmentTrader`;

    const response = await tvly.search(query, {
      max_results: 10,
      include_domains: ['appointmenttrader.com', 'reddit.com'],
      search_depth: 'advanced' // More thorough scraping
    });

    return {
      results: response.results || [],
      answer: response.answer || '' // Tavily's AI-generated summary
    };
  } catch (error) {
    console.error('Tavily Market Scan Error:', error);
    return { results: [], answer: '' };
  }
};

/**
 * Deep Strategy Extraction using Firecrawl
 * Converts entire Reddit threads or restaurant pages to clean markdown
 */
export const firecrawlDeepRead = async (url: string) => {
  const firecrawl = getFirecrawlClient();
  if (!firecrawl) {
    console.log('[Firecrawl] API key not configured, skipping deep read');
    return { markdown: '', success: false };
  }

  try {
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true // Strip navigation/ads
    }) as any;

    return {
      markdown: scrapeResult?.markdown || '',
      success: !!scrapeResult?.markdown
    };
  } catch (error) {
    console.error('Firecrawl Deep Read Error:', error);
    return { markdown: '', success: false };
  }
};

/**
 * Instagram Hype Tracking using Apify
 * Measures follower growth to detect trending restaurants
 */
export const apifyInstagramScrape = async (instagramHandle: string) => {
  const apifyClient = getApifyClient();
  if (!apifyClient) {
    console.log('[Apify] API token not configured, skipping Instagram scrape');
    return null;
  }

  try {
    // Using the Instagram Profile Scraper Actor
    const run = await apifyClient.actor('apify/instagram-profile-scraper').call({
      usernames: [instagramHandle],
      resultsLimit: 1
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (items.length > 0) {
      const profile = items[0];
      return {
        followers: profile.followersCount || 0,
        posts: profile.postsCount || 0,
        engagement: profile.engagementRate || 0,
        verified: profile.verified || false
      };
    }

    return null;
  } catch (error) {
    console.error('Apify Instagram Scrape Error:', error);
    return null;
  }
};

/**
 * Combined Intelligence: Gemini + Tavily + Firecrawl
 * This is the "Alpha" strategy
 */
export const enhancedMarketIntelligence = async (restaurantName: string, city: string) => {
  try {
    // Step 1: Use Tavily to find the most relevant URLs
    const tavilyResults = await tavilyMarketScan(city, restaurantName);
    
    // Step 2: If we found a good Reddit thread or strategy guide, use Firecrawl to extract it
    let deepContext = '';
    const redditUrl = tavilyResults.results.find(r => r.url.includes('reddit.com'));
    
    if (redditUrl) {
      const crawled = await firecrawlDeepRead(redditUrl.url);
      if (crawled.success) {
        deepContext = crawled.markdown.substring(0, 2000); // Limit to avoid token overflow
      }
    }

    return {
      tavilyAnswer: tavilyResults.answer,
      sources: tavilyResults.results.map(r => ({ title: r.title, uri: r.url })),
      deepContext,
      confidence: tavilyResults.results.length > 5 ? 'High' : 'Medium'
    };
  } catch (error) {
    console.error('Enhanced Intelligence Error:', error);
    return null;
  }
};

