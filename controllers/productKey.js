const supabase = require('../config/supabase');

// Ajouter une nouvelle clé produit
const addProductKey = async (req, res) => {
    const { cle } = req.body;

    if (!cle) {
        return res.status(400).json({ error: "La clé produit est requise." });
    }

    const { data, error } = await supabase
        .from('product_keys')
        .insert([{ cle }]); // Utilisation de "cle" au lieu de "key"

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message: 'Clé produit ajoutée avec succès', data });
};

module.exports = { addProductKey };
