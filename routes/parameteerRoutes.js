const express = require("express");
const router = express.Router();
const ParameterController = require("../controllers/parametrcontroller");
const authenticateToken = require("../middleware/authenticateToken");

// GET pour récupérer les localisations de l'utilisateur
router.get("/", authenticateToken, ParameterController. getSettings);
router.put("/", authenticateToken, ParameterController. updateSettings);

module.exports = router;