const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signUp);
router.post('/login', authController. signIn);
router.post('/logout', authController. signOut);

module.exports = router;