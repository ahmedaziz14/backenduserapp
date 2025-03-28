const express = require('express');
const router = express.Router();
const { chatWithGemini } = require('../controllers/geminiController');
const authMiddleware = require('../middleware/authenticateToken');

router.post('/geminchat', authMiddleware, chatWithGemini);

module.exports = router;