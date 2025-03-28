const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require("../config/supabase");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Chat with Gemini
const chatWithGemini = async (req, res) => {
    const userId = req.user.id; // From JWT middleware
    const { message } = req.body; // User's message to Gemini

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        // Fetch user profile first to get admin_id
        const { data: profile, error: profileError } = await supabase
            .from("user_profiles")
            .select("name, interest, more_info, updated_at, admin_id, profile_picture")
            .eq("id", userId)
            .single();

        if (profileError) {
            return res.status(500).json({ error: "Failed to fetch user profile", details: profileError });
        }

        const adminId = profile?.admin_id || null;

        // Define tables and their queries
        const userData = {};

        // 1. User Profiles
        userData.user_profiles = profile || null;

        // 2. Messages (user as sender or receiver)
        const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("sender_id, receiver_id, message, created_at, is_admin")
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(5); // Limit to recent messages for simplicity

        if (messagesError) {
            console.error("Error fetching messages:", messagesError);
        } else {
            userData.messages = messages || [];
        }

        // 3. Notifications
        const { data: notifications, error: notificationsError } = await supabase
            .from("notifications")
            .select("id, message, is_read, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(5); // Limit to recent notifications

        if (notificationsError) {
            console.error("Error fetching notifications:", notificationsError);
        } else {
            userData.notifications = notifications || [];
        }

        // 4. Locations
        const { data: locations, error: locationsError } = await supabase
            .from("localisations")
            .select("product_key, lat, lng, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            

        if (locationsError) {
            console.error("Error fetching locations:", locationsError);
        } else {
            userData.locations = locations && locations.length > 0 ? locations[0] : null;
        }

        // Construct prompt with user data
        const userInfoPrompt = `
            You are assisting a user with the following information:
            Profile:
                Name: ${userData.user_profiles?.name || "Unknown"}
                Interest: ${userData.user_profiles?.interest || "Not specified"}
                More Info: ${userData.user_profiles?.more_info || "None provided"}
                Updated At: ${userData.user_profiles?.updated_at || "N/A"}
                Admin ID: ${adminId || "None"}
                Profile Picture URL: ${userData.user_profiles?.profile_picture || "No picture"} (accessible in Supabase storage under profile-pictures)
            Recent Messages (as sender or receiver):
                ${userData.messages.length > 0 
                    ? userData.messages.map(m => 
                        `From: ${m.sender_id === userId ? "You" : m.sender_id}, To: ${m.receiver_id === userId ? "You" : m.receiver_id}, Message: "${m.message}", Time: ${m.created_at}, Admin: ${m.is_admin}`).join('\n')
                    : "No recent messages"}
            Recent Notifications:
                ${userData.notifications.length > 0 
                    ? userData.notifications.map(n => 
                        `Message: "${n.message}", Read: ${n.is_read}, Time: ${n.created_at}`).join('\n')
                    : "No recent notifications"}
            Latest Location:
                Product Key: ${userData.locations?.product_key || "Unknown"}
                Latitude: ${userData.locations?.lat || "Unknown"}
                Longitude: ${userData.locations?.lng || "Unknown"}
                Time: ${userData.locations?.created_at || "N/A"}
            the latitude et la longitude are the place of my car now 
            Respond to their message in a personalized way using this data. If relevant, you can reference the admin_id (${adminId || "none"}) from the profile.
            User message: "${message}"
        `;

        // Send prompt to Gemini
        const result = await model.generateContent(userInfoPrompt);
        const responseText = result.response.text();

        res.status(200).json({ reply: responseText });
    } catch (error) {
        console.error("Gemini API error:", JSON.stringify(error, null, 2));
        res.status(500).json({ error: "Failed to process request", details: error.message });
    }
};

module.exports = {
    chatWithGemini,
};