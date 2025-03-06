require('dotenv').config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const app = require("./app");
const supabase = require("./config/supabase");
const chatRoutes = require("./routes/chatRoutes");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Ajuste selon ton frontend
    methods: ['GET', 'POST'],
  },
});

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

io.on("connection", async (socket) => {
  console.log("✅ Utilisateur connecté :", socket.user.id);

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('admin_id')
    .eq('id', socket.user.id)
    .single();

  if (error || !profile.admin_id) {
    console.error('No admin_id found for user:', socket.user.id, error);
    socket.disconnect();
    return;
  }

  const admin_id = profile.admin_id;
  socket.join(socket.user.id);

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

  socket.on("sendMessage", ({ message }) => {
    console.log(`Message from user ${socket.user.id} to admin ${admin_id}: ${message}`);
    io.to(admin_id).emit('receiveMessage', {
      sender_id: socket.user.id,
      receiver_id: admin_id,
      message,
      is_admin: false,
      created_at: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Utilisateur déconnecté :", socket.user.id);
  });
});

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
app.use('/chat', chatRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://192.168.1.10:${PORT}`);
});