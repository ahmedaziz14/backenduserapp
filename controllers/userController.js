const crypto = require('crypto');
const supabase = require("../config/supabase");

// Encryption function
async function encryptImage(imageBuffer, publicKeyBase64) {
    // Convert base64 public key to PEM format
    const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');
    
    // Generate AES key and IV
    const aesKey = crypto.randomBytes(32); // 32 bytes for AES-256
    const iv = crypto.randomBytes(16);     // 16 bytes for AES-CBC
    
    // Encrypt image with AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encryptedContent = Buffer.concat([cipher.update(imageBuffer), cipher.final()]);
    const encryptedImage = Buffer.concat([iv, encryptedContent]); // Prepend IV
    
    // Encrypt AES key with RSA public key
    const encryptedAESKey = crypto.publicEncrypt(
        {
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        aesKey
    );
    
    return {
        encryptedImage: encryptedImage,           // IV + encrypted image data
        encryptedKey: encryptedAESKey.toString('base64') // Encrypted AES key in base64
    };
}

// Update or create user profile
const updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, interest, more_info } = req.body;
    const images = req.files;

    try {
        let newEncryptedImageUrls = [];
        let newEncryptedKeys = [];
        let profilePictureUrl = null;

        // Retrieve RSA public key from products table
        const { data: productData, error: productError } = await supabase
            .from("products")
            .select("public_key")
            .eq("user_id", userId)
            .single();

        if (productError || !productData?.public_key) {
            return res.status(400).json({ error: "Failed to retrieve public key", details: productError });
        }

        const publicKey = productData.public_key;

        if (images && images.length > 0) {
            // Upload first image unencrypted as profile picture
            const firstImage = images[0];
            const { data: profileUploadData, error: profileUploadError } = await supabase
                .storage
                .from("profile-pictures")
                .upload(`user-${userId}/${Date.now()}-${firstImage.originalname}`, 
                    firstImage.buffer, 
                    { contentType: firstImage.mimetype }
                );

            if (profileUploadError) {
                return res.status(400).json({ error: "Failed to upload profile picture", details: profileUploadError });
            }

            const { data: profilePublicUrl } = supabase
                .storage
                .from("profile-pictures")
                .getPublicUrl(profileUploadData.path);
            profilePictureUrl = profilePublicUrl.publicUrl;

            // Encrypt and upload all images (including the first)
            for (const image of images) {
                const encryption = await encryptImage(image.buffer, publicKey);
                
                // Upload encrypted image (IV + data) to storage
                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from("user-profile-images")
                    .upload(`user-${userId}/${Date.now()}-${image.originalname}.bin`, 
                        encryption.encryptedImage, 
                        { contentType: 'application/octet-stream' }
                    );

                if (uploadError) {
                    return res.status(400).json({ error: "Failed to upload encrypted image", details: uploadError });
                }

                const { data: publicUrl } = supabase
                    .storage
                    .from("user-profile-images")
                    .getPublicUrl(uploadData.path);

                newEncryptedImageUrls.push(publicUrl.publicUrl);
                newEncryptedKeys.push(encryption.encryptedKey);
            }
        }

        // Check for existing profile
        const { data: existingProfile, error: profileError } = await supabase
            .from("user_profiles")
            .select("id, name, interest, more_info, profile_picture, image_urls, images_encrypted_keys")
            .eq("id", userId)
            .single();

        if (profileError && profileError.code !== "PGRST116") {
            return res.status(500).json({ error: "Database error", details: profileError });
        }

        const profileUpdateData = {};
        if (name !== undefined) profileUpdateData.name = name;
        if (interest !== undefined) profileUpdateData.interest = interest;
        if (more_info !== undefined) profileUpdateData.more_info = more_info;
        if (profilePictureUrl) profileUpdateData.profile_picture = profilePictureUrl;

        if (existingProfile) {
            // Update existing profile
            const existingImageUrls = existingProfile.image_urls || [];
            let existingEncryptedKeys = [];
            if (existingProfile.images_encrypted_keys) {
                try {
                    existingEncryptedKeys = JSON.parse(existingProfile.images_encrypted_keys);
                } catch (e) {
                    console.error("Failed to parse existing encrypted keys:", e);
                }
            }

            const updatedImageUrls = newEncryptedImageUrls.length > 0 
                ? [...existingImageUrls, ...newEncryptedImageUrls]
                : existingImageUrls;
            const updatedEncryptedKeys = newEncryptedKeys.length > 0 
                ? [...existingEncryptedKeys, ...newEncryptedKeys]
                : existingEncryptedKeys;

            profileUpdateData.image_urls = updatedImageUrls;
            profileUpdateData.images_encrypted_keys = JSON.stringify(updatedEncryptedKeys);

            const { error: updateError } = await supabase
                .from("user_profiles")
                .update(profileUpdateData)
                .eq("id", userId);

            if (updateError) {
                console.error("Update error:", updateError);
                return res.status(400).json({ error: "Failed to update profile", details: updateError });
            }

            return res.status(200).json({ message: "Profile updated successfully!" });
        } else {
            // Create new profile
            profileUpdateData.image_urls = newEncryptedImageUrls;
            profileUpdateData.images_encrypted_keys = JSON.stringify(newEncryptedKeys);

            const { error: insertError } = await supabase
                .from("user_profiles")
                .insert([{ id: userId, ...profileUpdateData }]);

            if (insertError) {
                console.error("Insert error:", insertError);
                return res.status(400).json({ error: "Failed to create profile", details: insertError });
            }

            return res.status(201).json({ message: "Profile created successfully!" });
        }
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: "Server error", details: error.message });
    }
};

// Delete user profile
const deleteUserProfile = async (req, res) => {
    const userId = req.user.id;

    try {
        const { data: profile, error: getProfileError } = await supabase
            .from("user_profiles")
            .select("image_urls, profile_picture")
            .eq("id", userId)
            .single();

        if (getProfileError) {
            return res.status(400).json({ error: "Failed to get profile", details: getProfileError });
        }

        if (profile?.profile_picture) {
            const profilePicturePath = profile.profile_picture.split("/profile-pictures/")[1];
            if (profilePicturePath) {
                const { error: deleteProfilePictureError } = await supabase
                    .storage
                    .from("profile-pictures")
                    .remove([profilePicturePath]);
                if (deleteProfilePictureError) {
                    return res.status(400).json({ error: "Failed to delete profile picture", details: deleteProfilePictureError });
                }
            }
        }

        if (profile?.image_urls?.length > 0) {
            const imagePaths = profile.image_urls
                .map(url => url.split("/user-profile-images/")[1])
                .filter(path => path);
            if (imagePaths.length > 0) {
                const { error: deleteFilesError } = await supabase
                    .storage
                    .from("user-profile-images")
                    .remove(imagePaths);
                if (deleteFilesError) {
                    return res.status(400).json({ error: "Failed to delete images", details: deleteFilesError });
                }
            }
        }

        const { error: deleteProfileError } = await supabase
            .from("user_profiles")
            .delete()
            .eq("id", userId);

        if (deleteProfileError) {
            return res.status(400).json({ error: "Failed to delete profile", details: deleteProfileError });
        }

        res.status(200).json({ message: "Profile and images deleted successfully!" });
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

// Get user profile
const getUserProfile = async (req, res) => {
    const userId = req.user.id;

    try {
        const { data: profile, error } = await supabase
            .from("user_profiles")
            .select("id, name, interest, more_info, profile_picture")
            .eq("id", userId)
            .single();

        if (!profile || error) {
            return res.status(404).json({ error: "Profile not found", details: error });
        }

        res.status(200).json(profile);
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

module.exports = {
    updateUserProfile,
    getUserProfile,
    deleteUserProfile,
};