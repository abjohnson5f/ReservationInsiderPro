
export interface Source {
  title: string;
  uri: string;
}

export interface Restaurant {
  name: string;
  cuisine: string;
  estimatedResaleValue: number;
  priceLow?: number;
  priceHigh?: number;
  dataConfidence?: 'High' | 'Medium' | 'Low';
  popularityScore: number; // 0-100
  difficultyLevel: 'Low' | 'Medium' | 'High' | 'Impossible';
  bookingWindowTip: string;
  description: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  sources?: Source[];
}

export interface MarketInsight {
  strategy: string;
  peakTimes: string[];
  platform: string;
  riskFactor: string;
  releaseTime?: string; // e.g. "09:00", "10:00"
  bookingUrl?: string;
  sources?: Source[];
}

export enum City {
  NYC = 'New York City',
  MIA = 'Miami',
  LA = 'Los Angeles',
  LDN = 'London',
  PAR = 'Paris',
  TOK = 'Tokyo',
  CHI = 'Chicago'
}

export interface ChartDataPoint {
  day: string;
  value: number;
  volume: number;
}

export type AssetStatus = 'WATCHING' | 'ACQUIRED' | 'LISTED' | 'PENDING' | 'SOLD' | 'TRANSFERRED';

export interface PortfolioItem {
  id: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  costBasis: number;
  listPrice: number;
  soldPrice?: number;
  platform: string;
  status: AssetStatus;
  guestName?: string; // For transfer protocol
}