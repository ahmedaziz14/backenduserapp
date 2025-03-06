const supabase = require('../config/supabase');

// Envoyer un message à l'admin
const sendMessage = async (req, res) => {
  const { message } = req.body;
  const sender_id = req.user.id; // Récupéré du JWT (user_id)

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('admin_id')
      .eq('id', sender_id)
      .single();

    if (profileError || !profile.admin_id) {
      return res.status(400).json({ error: 'No admin associated with this user', details: profileError });
    }

    const receiver_id = profile.admin_id;

    const { data, error } = await supabase
      .from('messages')
      .insert([{ 
        sender_id, 
        receiver_id, 
        message, 
        is_admin: false 
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to send message', details: error });
    }

    const io = req.app.get('io');
    const messageData = {
      sender_id,
      receiver_id,
      message,
      is_admin: false,
      created_at: data.created_at,
    };

    // Émettre au receiver_id (admin)
    io.to(receiver_id).emit('receiveMessage', messageData);
    // Émettre au sender_id (utilisateur) pour mise à jour instantanée
    io.to(sender_id).emit('receiveMessage', messageData);

    res.status(200).json({ message: 'Message sent successfully', data });
  } catch (error) {
    console.error('Server error during sendMessage:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

// Récupérer l'historique des messages avec l'admin
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
      .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`)
      .or(`sender_id.eq.${admin_id},receiver_id.eq.${admin_id}`)
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