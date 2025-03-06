const express = require("express");
const { updateUserProfile, getUserProfile, deleteUserProfile } = require("../controllers/userController");
const authenticateToken = require("../middleware/authenticateToken");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Mettre à jour le profil utilisateur
router.put("/profile", authenticateToken, upload.array("images"), updateUserProfile);

// Récupérer le profil utilisateur
router.get("/profile", authenticateToken, getUserProfile);

// Supprimer le profil utilisateur
router.delete("/profile", authenticateToken, deleteUserProfile);

module.exports = router;