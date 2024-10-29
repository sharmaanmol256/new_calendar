const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const eventController = require('../controllers/eventController');

// Debug middleware
router.use((req, res, next) => {
  console.log('Event Route Request:', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body
  });
  next();
});

router.use(authMiddleware);

router.get('/', eventController.getEvents);
router.post('/', eventController.createEvent);

module.exports = router;