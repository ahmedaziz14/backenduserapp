const bcrypt = require("bcryptjs");
const supabase = require("../config/supabase");
const jwt = require("jsonwebtoken");

const signUp = async (req, res) => {
  const { email, password, product_key } = req.body;

  try {
    // Vérifier si la clé produit existe et n'est pas encore utilisée
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("product_key, used, admin_id") // Inclure admin_id
      .eq("product_key", product_key)
      .eq("used", false)
      .single();

    if (!product || productError) {
      return res.status(400).json({ error: "Invalid or already used product key." });
    }

    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insérer le nouvel utilisateur dans la table `users`
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert([{ email, password: hashedPassword }])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: "User registration failed." });
    }

    // Mettre à jour la clé produit pour indiquer qu'elle a été utilisée
    const { error: updateError } = await supabase
      .from("products")
      .update({ used: true, user_id: user.id })
      .eq("product_key", product_key);

    if (updateError) {
      return res.status(500).json({ error: "User registered, but failed to update product key." });
    }

    // Ajouter une entrée dans `localisations` avec l'user_id et le product_key utilisé pour le signup
    const { error: localisationError } = await supabase
      .from("localisations")
      .insert([{ user_id: user.id, product_key }]);

    if (localisationError) {
      console.error("Error inserting into localisations:", localisationError);
      return res.status(500).json({ error: "Failed to initialize localisation data." });
    }

    // Créer un profil utilisateur par défaut avec l'admin_id récupéré depuis products
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert([{ 
        id: user.id, 
        name: "", 
        interest: "", 
        more_info: "", 
        image_urls: [], 
        admin_id: product.admin_id // Ajout de l'admin_id
      }]);

    if (profileError) {
      console.error("Error inserting into user_profiles:", profileError);
      return res.status(500).json({ error: "Failed to create user profile." });
    }

    // Insérer une notification de bienvenue dans la table `notifications`
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([{
        user_id: user.id,
        message: "Welcome to our platform! We're glad to have you here.",
        is_read: false,
      }]);

    if (notificationError) {
      console.error("Error inserting welcome notification:", notificationError);
    }

    // Ajouter une entrée dans `user_settings` avec des paramètres par défaut
    const defaultSettings = {
      pushNotifications: true,
      updateFrequency: "10",
      selectedServices: ["weather", "traffic"],
      theme: "light",
      language: "fr",
    };
    const { error: settingsError } = await supabase
      .from("user_settings")
      .insert([{ user_id: user.id, settings: defaultSettings }]);

    if (settingsError) {
      console.error("Error inserting into user_settings:", settingsError);
      return res.status(500).json({ error: "User registered, but failed to initialize settings." });
    }

    res.status(201).json({ message: "User registered successfully!", user });
  } catch (error) {
    console.error("Server error during signup:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// User Login (inchangé)
const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (!user || userError) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "SECRET_KEY",
      { algorithm: "HS256", expiresIn: "1h" }
    );
    console.log("JWT Secret:", process.env.JWT_SECRET);

    res.status(200).json({ message: "Login successful!", token });
  } catch (error) {
    console.error("Server error during signin:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// User Sign Out (inchangé)
const signOut = async (req, res) => {
  try {
    res.status(200).json({ message: "User signed out successfully!" });
  } catch (error) {
    console.error("Server error during signout:", error);
    res.status(500).json({ error: "Sign-out failed." });
  }
};

module.exports = { signUp, signIn, signOut };