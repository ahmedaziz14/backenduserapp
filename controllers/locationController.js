const supabase = require("../config/supabase");

// ✅ Récupérer les localisations de l'utilisateur authentifié
const getUserLocations = async (req, res) => {
  const userId = req.user.id; // ID de l'utilisateur extrait du token JWT

  try {
    const { data: locations, error } = await supabase
      .from("localisations")
      .select("id, user_id, product_key, lat, lng, created_at")
      .eq("user_id", userId); // Filtrer par user_id

    if (error) {
      console.error("Erreur de base de données :", error);
      return res.status(500).json({ error: "Erreur de base de données", details: error.message });
    }

    if (!locations || locations.length === 0) {
      return res.status(404).json({ message: "Aucune localisation trouvée pour cet utilisateur." });
    }

    res.status(200).json({ locations });
  } catch (error) {
    console.error("Erreur serveur :", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
};

module.exports = { getUserLocations };