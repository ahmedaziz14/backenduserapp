const supabase = require("../config/supabase");

const getSettings = async (req, res) => {
  const userId = req.user.id; // Extrait du token via middleware authenticateToken

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      console.error("Error fetching user_settings:", error);
      return res.status(500).json({ error: "Failed to fetch settings." });
    }

    console.log("✅ Paramètres récupérés pour l'utilisateur", userId);
    res.status(200).json({ settings: data.settings });
  } catch (error) {
    console.error("Server error during settings fetch:", error);
    res.status(500).json({ error: "Server error." });
  }
};

const updateSettings = async (req, res) => {
  const { settings } = req.body;
  const userId = req.user.id; // Extrait du token via middleware authenticateToken

  try {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, settings, updated_at: new Date().toISOString() });

    if (error) {
      console.error("Error updating user_settings:", error);
      return res.status(500).json({ error: "Failed to update settings." });
    }

    console.log("✅ Paramètres mis à jour pour l'utilisateur", userId);
    res.status(200).json({ message: "Settings updated successfully!" });
  } catch (error) {
    console.error("Server error during settings update:", error);
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = { getSettings, updateSettings };