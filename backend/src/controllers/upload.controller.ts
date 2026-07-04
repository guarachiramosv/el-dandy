import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { ProductService } from '../services/product.service';

const hasCloudinaryConfig = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const configureCloudinary = () => {
  if (!hasCloudinaryConfig()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
};

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Formato invalido. Usa JPG, PNG o WebP.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadProductImageMiddleware = productImageUpload.single('image');
export const uploadProductImagesMiddleware = productImageUpload.array('images', 20);

const productService = new ProductService();

const uploadToCloudinary = async (file: Express.Multer.File) => {
  if (!configureCloudinary()) {
    throw new Error('Cloudinary no esta configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  }

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'Tienda',
        resource_type: 'image',
        overwrite: true,
        transformation: [{ fetch_format: 'auto', quality: 'auto' }],
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else resolve(uploadResult);
      }
    );
    stream.end(file.buffer);
  });

  const imageUrl = cloudinary.url(result.public_id, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
  });
  return { imageUrl, publicId: result.public_id as string };
};

export const uploadProductImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Imagen requerida' });

  const result = await uploadToCloudinary(req.file);
  await productService.update(String(req.params.id), { imagen: result.imageUrl });
  const product = await productService.addImages(String(req.params.id), [{ url: result.imageUrl, publicId: result.publicId }]);
  res.json({ success: true, data: { imageUrl: result.imageUrl, product, publicId: result.publicId } });
});

export const uploadProductImages = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (files.length === 0) return res.status(400).json({ success: false, error: 'Imagen requerida' });

  const uploaded = await Promise.all(files.map(uploadToCloudinary));
  const product = await productService.addImages(
    String(req.params.id),
    uploaded.map((image) => ({ url: image.imageUrl, publicId: image.publicId }))
  );

  res.json({
    success: true,
    data: {
      imageUrls: uploaded.map((image) => image.imageUrl),
      images: uploaded,
      product,
    },
  });
});
