import { Router } from 'express';
import { fetchTopRestaurants, fetchMarketInsight, generateTrendData } from '../services/geminiService';

const router = Router();

router.get('/restaurants', async (req, res) => {
  const { city } = req.query;
  if (!city || typeof city !== 'string') {
    return res.status(400).json({ error: 'City is required' });
  }
  const data = await fetchTopRestaurants(city);
  res.json(data);
});

router.get('/insight', async (req, res) => {
  const { restaurant, city } = req.query;
  if (!restaurant || !city || typeof restaurant !== 'string' || typeof city !== 'string') {
    return res.status(400).json({ error: 'Restaurant and city are required' });
  }
  const data = await fetchMarketInsight(restaurant, city);
  res.json(data);
});

router.get('/trend', async (req, res) => {
  const { restaurant } = req.query;
  if (!restaurant || typeof restaurant !== 'string') {
    return res.status(400).json({ error: 'Restaurant name is required' });
  }
  const data = await generateTrendData(restaurant);
  res.json(data);
});

export default router;

