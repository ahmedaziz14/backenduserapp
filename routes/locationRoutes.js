const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const authenticateToken = require("../middleware/authenticateToken");

// GET pour récupérer les localisations de l'utilisateur
router.get("/", authenticateToken, locationController.getUserLocations);

module.exports = router;