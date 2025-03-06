const multer = require('multer');
const path = require('path');

// Définir le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads')); // Dossier de destination
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Utiliser un nom unique
  }
});

const upload = multer({ storage: storage });

module.exports = upload;
