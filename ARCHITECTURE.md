# ReservationInsiderPro: "Money Printer" Architecture & Implementation Plan

## 1. Executive Summary
**Goal:** Transform the user into the #1 seller on AppointmentTrader by creating a technical and agentic competitive advantage.
**Concept:** A "Bloomberg Terminal" for high-end restaurant reservations that identifies arbitrage opportunities (spread between cost basis and resale value) and automates acquisition using high-speed/agentic tools.
**Current Status:** Transitioning from a client-side React dashboard to a full-stack "Operating System" with a Node.js backend, Neon database, and 24/7 automation worker.

## 2. The Architecture
The system is divided into three distinct layers to ensure security, persistence, and automation.

### Layer 1: The Terminal (Frontend)
*   **Tech**: React, Vite, Tailwind (Existing).
*   **Role**: Display layer only. No business logic or API keys stored here.
*   **Status**: Moved to `/client` directory. Needs `npm install` to verify integrity.

### Layer 2: The Engine (Backend API)
*   **Tech**: Node.js, Express, TypeScript.
*   **Role**:
    *   Securely holds API Keys (Gemini, Tavily, Firecrawl, etc.).
    *   Manages the connection to Neon (Postgres).
    *   Serves as the "Brain" that orchestrates intelligence gathering.
*   **Status**: Initialized in `/server` but contains nested junk folders from failed moves. Needs cleanup.

### Layer 3: The Sniper (Worker Service)
*   **Tech**: Python or Node.js scripts (Headless Browser/Puppeteer).
*   **Role**:
    *   Runs 24/7 on the server.
    *   Wakes up at specific "Drop Times" (e.g., 9:00 AM).
    *   Uses Residential Proxies to bypass anti-bot checks.
    *   Uses ElevenLabs agents to make phone calls for verification/transfer.

## 3. Implementation Phases

### Phase 1: The Foundation (Immediate Focus)
*   **Objective**: Establish the secure server and persistent storage.
*   **Actions**:
    1.  **Monorepo Restructure**: Formalized separation of `client` and `server`.
    2.  **Database Setup**: Connect Neon Postgres using the connection string in `.env`.
    3.  **Schema Migration**: Create `portfolio_items` (inventory) and `market_data` (pricing history) tables.
    4.  **Data Sync**: Migrate existing LocalStorage portfolio to the database so no data is lost.

### Phase 2: The Intelligence (API Integration)
*   **Objective**: Upgrade the "Market Scan" capabilities with real-time, verified data.
*   **Integrations**:
    *   **Gemini (Existing)**: Logic moved to backend. Used for synthesizing insights.
    *   **Tavily**: Replaces simulated Google Search for cleaner, faster market pricing data.
    *   **Firecrawl**: Deep-scrapes restaurant websites/Reddit to extract specific "Sniper Protocols" (booking URLs, exact drop times).
    *   **Apify**: Instagram follower tracking to measure "Hype/Momentum."

### Phase 3: The Execution (The Sniper)
*   **Objective**: Automate acquisition and fulfillment.
*   **Components**:
    *   **Automation**: Puppeteer script utilizing `PROXY_URL` (Bright Data Residential) to rotate IPs.
    *   **Notification**: Twilio SMS alerts upon successful acquisition.
    *   **Voice Agent**: ElevenLabs "Personal Assistant" agent to verbally confirm reservations or execute name transfers with restaurant hosts.

## 4. Technical Decisions & Stack
*   **Database**: **Neon** (Serverless Postgres). Selected for scalability and branching capabilities.
*   **Proxies**: **Bright Data** (Residential, Pay-As-You-Go). Selected to mimic human traffic and avoid IP bans.
*   **Voice AI**: **ElevenLabs** (Agent Platform). Selected for ability to handle conversational tasks.
*   **Authentication**: API Keys stored in server-side `.env`. ElevenLabs uses Master API Key + Agent ID.

## 5. Current Challenges & Recovery Plan
**Challenge**: Previous attempts to restructure the filesystem were interrupted, leaving the `server/` directory with nested/duplicate folders (`ReservationInsiderPro/server/ReservationInsiderPro...`).
**Recovery Plan**:
1.  **Audit**: We have confirmed `client/` is mostly safe and `server/` exists but is messy.
2.  **Cleanup**: Delete the nested junk folders in `server/`.
3.  **Verification**: Run `npm install` in both directories to ensure dependencies are linked correctly.
4.  **Resume**: Proceed with Phase 1 database connection only after the filesystem is clean.

