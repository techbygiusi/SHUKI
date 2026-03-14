import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export function createImagesRouter(imagesPath: string): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination: imagesPath,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

  // List all images with metadata
  router.get('/images', (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(imagesPath)) {
        res.json([]);
        return;
      }
      const files = fs.readdirSync(imagesPath).filter(f =>
        /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(f)
      );
      const result = files.map(filename => {
        const filePath = path.join(imagesPath, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          mimeType: getMimeType(filename),
          uploadedAt: stats.birthtime.toISOString(),
        };
      });
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to list images' });
    }
  });

  router.post('/images', upload.single('image'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    res.json({
      url: `/api/images/${req.file.filename}`,
      filename: req.file.filename,
    });
  });

  router.get('/images/:filename', (req: Request, res: Response) => {
    const raw = req.params.filename;
    const filename = path.basename(Array.isArray(raw) ? raw[0] : raw);
    const filePath = path.join(imagesPath, filename);
    res.sendFile(filePath);
  });

  return router;
}
