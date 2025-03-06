const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationcontroller");
const authenticateToken = require("../middleware/authenticateToken");

// Get user's notifications
router.get("/", authenticateToken, notificationController.getNotifications);

// Mark a notification as read
router.put("/:id/read", authenticateToken, notificationController.markNotificationAsRead);
router.delete("/:id", authenticateToken, notificationController.deleteNotification); 

module.exports = router;