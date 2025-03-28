const crypto = require('crypto');
const supabase = require('../config/supabase');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Clé de 256 bits (32 bytes hex)
const IV_LENGTH = 16; // Longueur du vecteur d'initialisation

// Fonction de chiffrement AES-256-CBC
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + encrypted; // IV concaténé avec le message chiffré
}

// Fonction de déchiffrement AES-256-CBC
function decrypt(encryptedText) {
  try {
    if (!encryptedText || encryptedText.length < IV_LENGTH * 2) {
      throw new Error('Encrypted text is too short or missing IV');
    }

    const ivHex = encryptedText.substring(0, IV_LENGTH * 2);
    const encrypted = encryptedText.substring(IV_LENGTH * 2);
    const iv = Buffer.from(ivHex, 'hex');

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return '[ERROR]'; // Retourne une erreur pour éviter de planter l'appli
  }
}

// Envoyer un message
const sendMessage = async (req, res) => {
  const { message } = req.body;
  const sender_id = req.user.id;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Récupérer l'admin associé à cet utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('admin_id')
      .eq('id', sender_id)
      .single();

    if (profileError || !profile.admin_id) {
      return res.status(400).json({ error: 'No admin associated with this user', details: profileError });
    }

    const receiver_id = profile.admin_id;
    const encryptedMessage = encrypt(message); // Chiffrement du message

    // Insérer le message chiffré dans Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id, receiver_id, message: encryptedMessage, is_admin: false }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to send message', details: error });
    }

    const messageData = {
      id: data.id,
      sender_id,
      receiver_id,
      message, // On envoie le message en clair au frontend
      is_admin: false,
      created_at: data.created_at,
    };

    // Envoi via WebSocket
    const io = req.app.get('io');
    io.to(receiver_id).emit('receiveMessage', messageData);
    io.to(sender_id).emit('receiveMessage', messageData);

    res.status(200).json({ message: 'Message sent successfully', data: messageData });
  } catch (error) {
    console.error('Server error during sendMessage:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Récupérer l'historique du chat
const getChatHistory = async (req, res) => {
  const user_id = req.user.id;

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('admin_id')
      .eq('id', user_id)
      .single();

    if (profileError || !profile.admin_id) {
      return res.status(400).json({ error: 'No admin associated with this user', details: profileError });
    }

    const admin_id = profile.admin_id;

    // Récupérer les messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user_id},receiver_id.eq.${admin_id}),and(sender_id.eq.${admin_id},receiver_id.eq.${user_id})`)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch chat history', details: error });
    }

    // Déchiffrer les messages avant de les renvoyer
    const decryptedMessages = messages.map(msg => ({
      ...msg,
      message: decrypt(msg.message),
    }));

    res.status(200).json({ messages: decryptedMessages });
  } catch (error) {
    console.error('Server error during getChatHistory:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { sendMessage, getChatHistory };
