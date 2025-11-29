import { Router } from 'express';
import pool from '../db';

const router = Router();

// GET all portfolio items
router.get('/', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM portfolio_items ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// CREATE a new portfolio item
router.post('/', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { 
      id, restaurantName, date, time, guests, costBasis, listPrice, 
      soldPrice, platform, status, guestName, dropTime, nextDropDate, 
      nextDropTime, dropTimezone 
    } = req.body;

    const result = await pool.query(
      `INSERT INTO portfolio_items (
        id, restaurant_name, date, time, guests, cost_basis, list_price, 
        sold_price, platform, status, guest_name, drop_time, next_drop_date, 
        next_drop_time, drop_timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [id, restaurantName, date, time, guests, costBasis, listPrice, soldPrice, 
       platform, status, guestName, dropTime, nextDropDate, nextDropTime, dropTimezone]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating portfolio item:', error);
    res.status(500).json({ error: 'Failed to create portfolio item' });
  }
});

// UPDATE a portfolio item
router.put('/:id', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { id } = req.params;
    const { 
      restaurantName, date, time, guests, costBasis, listPrice, soldPrice, 
      platform, status, guestName, dropTime, nextDropDate, nextDropTime, dropTimezone 
    } = req.body;

    const result = await pool.query(
      `UPDATE portfolio_items SET 
        restaurant_name = $1, date = $2, time = $3, guests = $4, cost_basis = $5, 
        list_price = $6, sold_price = $7, platform = $8, status = $9, guest_name = $10,
        drop_time = $11, next_drop_date = $12, next_drop_time = $13, drop_timezone = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *`,
      [restaurantName, date, time, guests, costBasis, listPrice, soldPrice, platform, 
       status, guestName, dropTime, nextDropDate, nextDropTime, dropTimezone, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
});

// DELETE a portfolio item
router.delete('/:id', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM portfolio_items WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
});

export default router;









