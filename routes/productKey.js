const express = require('express');
const { addProductKey } = require('../controllers/productKey');

const router = express.Router();

// Route pour ajouter une clé produit
router.post('/add', addProductKey);

module.exports = router;
