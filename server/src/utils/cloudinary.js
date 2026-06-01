const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const entityName = req.body.entityName || 'unknown_device';
    const cleanName = entityName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      folder: 'ftth_monitoring',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      public_id: `${cleanName}_${Date.now()}`
    };
  },
});

const upload = multer({ storage: storage });

const deleteImage = async (url) => {
  if (!url) return;
  try {
    const regex = /(?:upload\/)(?:v\d+\/)?(ftth_monitoring\/[^.]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
      await cloudinary.uploader.destroy(match[1]);
    }
  } catch (error) {
    console.error("Cloudinary delete failed:", error);
  }
};

module.exports = { cloudinary, upload, deleteImage };
