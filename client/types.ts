
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
  // V2 additions
  hypeScore?: number;
  instagramFollowers?: number;
  city?: string;
}

export interface MarketInsight {
  strategy: string;
  peakTimes: string[];
  platform: string;
  riskFactor: string;
  releaseTime?: string; // e.g. "09:00", "10:00" (DEPRECATED - use nextDropDateTime)
  bookingUrl?: string;
  sources?: Source[];
  // Enhanced drop time fields for accurate countdown
  nextDropDate?: string; // ISO date: "2024-12-01"
  nextDropTime?: string; // Time: "10:00"
  dropTimezone?: string; // IANA timezone: "America/Los_Angeles"
  dropPattern?: string; // Human-readable: "Monthly on the 1st at 10:00 AM PST"
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
  dropTime?: string; // HH:MM format for the sniper clock (DEPRECATED)
  // Enhanced drop time fields
  nextDropDate?: string; // ISO date: "2024-12-01"
  nextDropTime?: string; // Time: "10:00"
  dropTimezone?: string; // IANA timezone: "America/Los_Angeles"
  // Resy integration fields
  venueId?: number; // Resy venue ID for direct API booking
  bookingUrl?: string; // Direct booking URL
}

// Resy API types
export interface ResySlot {
  config_id: string;
  time: string;
  table_type: string;
  min_guests: number;
  max_guests: number;
  deposit?: number;
  cancellation_fee?: number;
}

export interface ResyVenue {
  id: number;
  name: string;
  city: string;
  neighborhood: string;
  cuisine: string;
  priceRange: number;
}

export interface AcquisitionResult {
  success: boolean;
  resy_token?: string;
  reservation_id?: string;
  confirmation?: string;
  error?: string;
}

// Multi-Identity System Types
export interface BookingIdentity {
  id: number;
  name: string;
  email: string;
  phone?: string;
  
  // Credential status (actual values masked)
  resy_auth_token?: string;
  opentable_csrf_token?: string;
  sevenrooms_email?: string;
  tock_auth_token?: string;
  
  // Usage tracking
  bookings_this_month: number;
  resy_bookings_month: number;
  opentable_bookings_month: number;
  sevenrooms_bookings_month: number;
  tock_bookings_month: number;
  monthly_limit: number;
  is_active: boolean;
}

export interface IdentityStats {
  identity: string;
  total: number;
  resy: number;
  opentable: number;
  sevenrooms: number;
  tock: number;
  limit: number;
  remaining: number;
}

// ============================================
// CONCIERGE CLIENT TYPES
// ============================================
// Clients are people we book reservations FOR.
// This enables the concierge business model where:
// - Reservation is under CLIENT'S name, not ours
// - No flagging risk (we're just the booking agent)
// - No transfer needed (already in client's name)

export type VipLevel = 'standard' | 'vip' | 'platinum';

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
  vip_level: VipLevel;
  
  // Platform sync status
  synced_to_opentable: boolean;
  synced_to_resy: boolean;
  opentable_diner_id?: string;
  
  // Analytics
  total_bookings: number;
  successful_bookings: number;
  total_revenue: number;
  last_booking_date?: string;
  
  // Preferences
  preferred_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size: number;
  preferred_time_slot?: string;
  
  created_at: string;
  updated_at: string;
}

export interface ClientBookingRequest {
  id: number;
  client_id: number;
  restaurant_name: string;
  platform?: string;
  venue_id?: string;
  desired_date: string;
  desired_time?: string;
  time_flexibility: number;
  party_size: number;
  special_requests?: string;
  occasion?: string;
  max_service_fee?: number;
  status: 'pending' | 'searching' | 'acquired' | 'failed' | 'cancelled';
  attempts: number;
  last_attempt_at?: string;
  acquired_at?: string;
  transfer_id?: number;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface ClientStats {
  totalClients: number;
  vipClients: number;
  platinumClients: number;
  totalBookings: number;
  totalRevenue: number;
  avgBookingsPerClient: number;
  clientsByVipLevel: { level: string; count: number }[];
  topClients: Client[];
  recentClients: Client[];
}

// Transfer Workflow Types
export type TransferStatus = 'ACQUIRED' | 'LISTED' | 'SOLD' | 'TRANSFER_PENDING' | 'TRANSFERRED' | 'COMPLETED';
export type TransferMethod = 'NAME_CHANGE' | 'CANCEL_REBOOK' | 'PLATFORM_TRANSFER' | 'SHOW_UP_TOGETHER';
export type BookingType = 'standard' | 'concierge' | 'speculative';

export interface Transfer {
  id: number;
  portfolio_item_id?: string;
  
  // Reservation details
  restaurant_name: string;
  platform: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  confirmation_number?: string;
  
  // AT listing
  at_listing_id?: string;
  at_listing_url?: string;
  listing_price?: number;
  
  // Buyer info
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  sale_price?: number;
  sold_at?: string;
  
  // Status
  status: TransferStatus;
  
  // Booking type & identity
  booking_type?: BookingType;
  booked_under_name?: string; // Name the reservation is under
  
  // Transfer details (only for standard bookings)
  transfer_method?: TransferMethod;
  transfer_deadline?: string;
  transfer_completed_at?: string;
  transfer_notes?: string;
  
  // Identity tracking
  booking_identity_id?: number;
  
  // Concierge tracking
  client_id?: number;
  service_fee?: number;
  
  created_at: string;
  updated_at: string;
}

export interface ATListing {
  title: string;
  description: string;
  price_suggestion: number;
}

export interface TransferStats {
  total_sales: number;
  total_revenue: number;
  avg_sale_price: number;
  by_platform: Record<string, { count: number; revenue: number }>;
  by_status: Record<string, number>;
}
