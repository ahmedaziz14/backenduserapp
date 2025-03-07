const supabase = require('../config/supabase');

const sendMessage = async (req, res) => {
  const { message } = req.body;
  const sender_id = req.user.id; // ID de l’utilisateur depuis le token JWT

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    // Récupérer l’admin associé à cet utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('admin_id')
      .eq('id', sender_id)
      .single();

    if (profileError || !profile.admin_id) {
      return res.status(400).json({ error: 'No admin associated with this user', details: profileError });
    }

    const receiver_id = profile.admin_id;

    // Insérer le message dans Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ sender_id, receiver_id, message, is_admin: false }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to send message', details: error });
    }

    const messageData = {
      id: data.id,
      sender_id,
      receiver_id,
      message,
      is_admin: false,
      created_at: data.created_at,
    };

    // Envoyer le message via WebSocket à l’admin et à l’utilisateur
    const io = req.app.get('io');
    io.to(receiver_id).emit('receiveMessage', messageData); // À l’admin
    io.to(sender_id).emit('receiveMessage', messageData);   // À l’utilisateur lui-même

    res.status(200).json({ message: 'Message sent successfully', data: messageData });
  } catch (error) {
    console.error('Server error during sendMessage:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

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

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user_id},receiver_id.eq.${admin_id}),and(sender_id.eq.${admin_id},receiver_id.eq.${user_id})`)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch chat history', details: error });
    }

    res.status(200).json({ messages });
  } catch (error) {
    console.error('Server error during getChatHistory:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { sendMessage, getChatHistory };