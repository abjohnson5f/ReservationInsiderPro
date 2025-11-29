import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import marketRoutes from './routes/market';
import marketV2Routes from './routes/marketV2';
import portfolioRoutes from './routes/portfolio';
import restaurantRoutes from './routes/restaurants';
import sniperRoutes from './routes/sniper';
import identityRoutes from './routes/identities';
import transferRoutes from './routes/transfers';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/market', marketRoutes);        // Legacy: Gemini-based (for backwards compatibility)
app.use('/api/v2/market', marketV2Routes);   // V2: Full data pipeline with DB persistence
app.use('/api/portfolio', portfolioRoutes);  // Portfolio management
app.use('/api/restaurants', restaurantRoutes); // Database-backed restaurant data
app.use('/api/sniper', sniperRoutes);        // Phase 3: Sniper automation system
app.use('/api/identities', identityRoutes);  // Multi-identity management
app.use('/api/transfers', transferRoutes);   // Transfer & AT listing workflow

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'The Engine is Online', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
