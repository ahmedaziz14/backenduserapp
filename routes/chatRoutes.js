const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticateToken = require('../middleware/authenticateToken'); // Assure-toi que ce middleware existe

router.post('/send', authenticateToken, chatController.sendMessage);
router.get('/history', authenticateToken, chatController.getChatHistory);

module.exports = router;