const supabase = require("../config/supabase");

const getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId) // Filtre par user_id uniquement
      .order("created_at", { ascending: true }); // Pas de filtre is_read

    if (error) throw new Error(`Erreur de base de données : ${error.message}`);

    console.log("🔄 Notifications renvoyées :", notifications);
    res.status(200).json({ notifications });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  try {
    const { data: notification, error: findError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .eq("user_id", userId)
      .single();

    if (findError || !notification) {
      return res.status(404).json({ error: "Notification non trouvée" });
    }

    const { data: updatedNotification, error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .select()
      .single();

    if (updateError) throw new Error(`Erreur mise à jour : ${updateError.message}`);

    req.app.get("io").to(userId).emit("notification-marked-as-read", notificationId);

    res.status(200).json({
      message: "Notification marquée comme lue",
      notification: updatedNotification,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
};

const deleteNotification = async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  try {
    const { data: notification, error: findError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .eq("user_id", userId)
      .single();

    if (findError || !notification) {
      return res.status(404).json({ error: "Notification non trouvée" });
    }

    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (deleteError) throw new Error(`Erreur suppression : ${deleteError.message}`);

    req.app.get("io").to(userId).emit("notification-deleted", notificationId);

    res.status(200).json({ message: "Notification supprimée avec succès" });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
};

module.exports = { getNotifications, markNotificationAsRead, deleteNotification };