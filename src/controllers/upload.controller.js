const asyncHandler = require('../middleware/asyncHandler');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');

const FOLDER_MAP = {
  profile: 'profiles',
  veterinarianDocs: 'veterinarian-docs',
  clinic: 'clinics',
  product: 'products',
  blog: 'blogs',
  petStore: 'pet-stores',
  general: 'general',
  pet: 'pets',
  medicalRecords: 'medical-records',
  chat: 'chat'
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

/**
 * Upload single file controller
 */
exports.uploadSingleFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      errors: [{ message: 'Please select a file to upload' }]
    });
  }

  // Get the relative path from uploads folder
  const filePath = path.relative(path.join(process.cwd(), 'uploads'), req.file.path);
  const url = `/uploads/${filePath.replace(/\\/g, '/')}`;

  res.json({
    success: true,
    message: 'File uploaded successfully',
    data: { url }
  });
});

/**
 * Upload multiple files controller
 * For veterinarian documents, also updates the user's documentUploads field
 */
exports.uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded',
      errors: [{ message: 'Please select at least one file to upload' }]
    });
  }

  // Get relative paths for all files
  const urls = req.files.map(file => {
    const filePath = path.relative(path.join(process.cwd(), 'uploads'), file.path);
    return `/uploads/${filePath.replace(/\\/g, '/')}`;
  });

  // If this is a veterinarian documents upload, update the user's documentUploads field
  const isVeterinarianDocsUpload = req.originalUrl?.includes('/veterinarian-docs') || 
                                   req.path?.includes('veterinarian-docs') ||
                                   req.baseUrl?.includes('veterinarian-docs') ||
                                   req.url?.includes('veterinarian-docs');

  const isPetStoreDocsUpload = req.originalUrl?.includes('/pet-store-docs') ||
                               req.path?.includes('pet-store-docs') ||
                               req.baseUrl?.includes('pet-store-docs') ||
                               req.url?.includes('pet-store-docs');

  if (isVeterinarianDocsUpload && req.userId) {
    try {
      const user = await User.findById(req.userId);
      if (user && user.role === 'VETERINARIAN') {
        const suppliedTypes = Array.isArray(req.body?.documentType)
          ? req.body.documentType
          : req.body?.documentType
            ? [req.body.documentType]
            : [];
        const documentUploads = urls.map((url, index) => ({
          fileUrl: url,
          type: suppliedTypes[index] || 'VERIFICATION_DOCUMENT',
          originalName: req.files[index]?.originalname || null,
          uploadedAt: new Date()
        }));

        // Update user's documentUploads field
        // If documentUploads already exists, append to it; otherwise, set it
        if (user.documentUploads && Array.isArray(user.documentUploads)) {
          user.documentUploads = [...user.documentUploads, ...documentUploads];
        } else {
          user.documentUploads = documentUploads;
        }

        await user.save();
      }
    } catch (error) {
      // Log error but don't fail the upload
      console.error('Error updating user documentUploads:', error);
      // Continue with the response even if update fails
    }
  }

  if (isPetStoreDocsUpload && req.userId) {
    try {
      const user = await User.findById(req.userId);
      const role = String(user?.role || '').toUpperCase();
      if (user && (role === 'PET_STORE' || role === 'PARAPHARMACY')) {
        const docType = String(req.body?.docType || '').trim() || null;
        const documentUploads = urls.map((url, index) => ({
          fileUrl: url,
          type: docType,
          originalName: req.files[index]?.originalname || null,
          uploadedAt: new Date(),
        }));

        if (user.documentUploads && Array.isArray(user.documentUploads)) {
          user.documentUploads = [...user.documentUploads, ...documentUploads];
        } else {
          user.documentUploads = documentUploads;
        }

        await user.save();
      }
    } catch (error) {
      console.error('Error updating user documentUploads:', error);
    }
  }

  res.json({
    success: true,
    message: 'Files uploaded successfully',
    data: { urls }
  });
});

/**
 * List uploaded files controller (Admin only)
 * @route GET /api/upload/files
 * Query:
 *  - folder: one of [profile, veterinarianDocs, clinic, product, blog, petStore, general, pet, medicalRecords, chat]
 *  - type: 'image' to filter image files
 *  - search: substring match on filename
 *  - page, limit
 */
exports.listUploadedFiles = asyncHandler(async (req, res) => {
  const folderKey = String(req.query?.folder || 'general');
  const mappedFolder = FOLDER_MAP[folderKey] || FOLDER_MAP.general;

  const type = String(req.query?.type || '').toLowerCase();
  const search = String(req.query?.search || '').trim().toLowerCase();

  const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit, 10) || 50));

  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const dirPath = path.join(uploadsRoot, mappedFolder);

  if (!fs.existsSync(dirPath)) {
    return res.json({
      success: true,
      message: 'OK',
      data: {
        files: [],
        pagination: { page, limit, total: 0, pages: 0 }
      }
    });
  }

  const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
  let files = [];

  for (const d of dirents) {
    if (!d.isFile()) continue;
    const name = d.name;
    if (search && !name.toLowerCase().includes(search)) continue;

    const ext = path.extname(name).toLowerCase();
    if (type === 'image' && !IMAGE_EXTS.has(ext)) continue;

    const abs = path.join(dirPath, name);
    let stat = null;
    try {
      stat = await fs.promises.stat(abs);
    } catch (e) {
      stat = null;
    }

    files.push({
      name,
      url: `/uploads/${mappedFolder}/${name}`,
      size: stat?.size ?? null,
      updatedAt: stat?.mtime ? stat.mtime.toISOString() : null,
    });
  }

  files.sort((a, b) => {
    const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bt - at;
  });

  const total = files.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = files.slice(start, start + limit);

  res.json({
    success: true,
    message: 'OK',
    data: {
      files: paged,
      pagination: { page, limit, total, pages }
    }
  });
});
