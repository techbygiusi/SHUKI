import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
