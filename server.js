require('dotenv').config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const app = require("./app"); // Assurez-vous que app.js existe et inclut chatRoutes
const supabase = require("./config/supabase");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Ajuste selon ton frontend, ex: 'http://localhost:19006' pour Expo
    methods: ['GET', 'POST'],
  },
});

// Middleware d'authentification pour Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// WebSocket
io.on("connection", async (socket) => {
  console.log("✅ Utilisateur connecté :", socket.user.id);
  socket.join(socket.user.id); // L’utilisateur rejoint sa propre salle immédiatement

  // Gestion des notifications existantes
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`Utilisateur ${userId} a rejoint sa room`);
  });

  socket.on("mark-notification-as-read", (notificationId) => {
    console.log("🔖 Notification marquée comme lue:", notificationId);
    io.emit("notification-marked-as-read", notificationId);
  });

  socket.on("new-notification", (notification) => {
    console.log("📢 Nouvelle notification envoyée:", notification);
    io.to(notification.user_id).emit("new-notification", notification);
  });

  socket.on("notification-deleted", (notificationId) => {
    console.log("🗑️ Notification supprimée:", notificationId);
    io.emit("notification-deleted", notificationId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Utilisateur déconnecté :", socket.user.id);
  });
});

// Écoute des nouveaux messages dans la table messages
supabase
  .channel("messages-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      const newMessage = payload.new;
      console.log("🔔 Nouveau message détecté dans Supabase :", newMessage);
      io.to(newMessage.receiver_id).emit("receiveMessage", newMessage); // Envoie à l’utilisateur ou admin
    }
  )
  .subscribe((status) => {
    console.log("📡 Statut de l'abonnement Supabase pour messages :", status);
  });

// Écoute des insertions dans la table notifications
supabase
  .channel("notifications-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications" },
    (payload) => {
      const newNotification = payload.new;
      console.log("🔔 Nouvelle notification détectée dans Supabase :", newNotification);
      io.to(newNotification.user_id).emit("new-notification", newNotification);
    }
  )
  .subscribe((status) => {
    console.log("📡 Statut de l'abonnement Supabase pour notifications :", status);
  });

// Écoute des insertions dans la table localisations
supabase
  .channel("localisations-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "localisations" },
    (payload) => {
      const newLocation = payload.new;
      console.log("📍 Nouvelle localisation détectée dans Supabase :", newLocation);
      io.to(newLocation.user_id).emit("new-location", newLocation);
    }
  )
  .subscribe((status) => {
    console.log("📡 Statut de l'abonnement Supabase pour localisations :", status);
  });

app.set("io", io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://192.168.1.10:${PORT}`);
});