import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { listLocalImages, getImagesPath } from '../utils/storage';
import { Note, Folder } from '../types';

interface Props {
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
}

interface GalleryImage {
  filename: string;
  fullPath: string;
  noteId: string | null;
  noteTitle: string;
  folderName: string | null;
}

export default function Gallery({ onClose, onOpenNote }: Props) {
  const { notes, folders } = useStore();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [imagesBasePath, setImagesBasePath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadImages();
  }, [notes]);

  async function loadImages() {
    try {
      setLoading(true);
      setError(null);
      const basePath = await getImagesPath();
      setImagesBasePath(basePath);
      const filenames = await listLocalImages();

    const galleryImages: GalleryImage[] = [];
    for (const filename of filenames) {
      const fullPath = `${basePath}/${filename}`;
      // Find which note references this image
      let noteId: string | null = null;
      let noteTitle = '';
      let folderName: string | null = null;

      for (const note of notes) {
        if (note.content.includes(filename) || note.content.includes(encodeURIComponent(fullPath))) {
          noteId = note.id;
          noteTitle = note.title;
          if (note.folderId) {
            const folder = folders.find((f) => f.id === note.folderId);
            folderName = folder?.name || null;
          }
          break;
        }
      }

      galleryImages.push({ filename, fullPath, noteId, noteTitle, folderName });
    }

    // Also extract inline/base64 images from note content
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    for (const note of notes) {
      let match;
      while ((match = imgRegex.exec(note.content)) !== null) {
        const src = match[2];
        // Skip images we already found from local files
        if (galleryImages.some((g) => src.includes(g.filename))) continue;
        // Only include data: URIs or http URLs (not shuki:// which are already covered)
        if (src.startsWith('data:') || src.startsWith('http')) {
          let folderName: string | null = null;
          if (note.folderId) {
            const folder = folders.find((f) => f.id === note.folderId);
            folderName = folder?.name || null;
          }
          galleryImages.push({
            filename: match[1] || 'image',
            fullPath: src,
            noteId: note.id,
            noteTitle: note.title,
            folderName,
          });
        }
      }
    }

    setImages(galleryImages);
    } catch (err) {
      setError('Could not load images. Make sure the app has access to the images directory.');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Image Gallery
          </h1>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            &#8592; Back
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="font-display text-lg" style={{ color: 'var(--text-secondary)' }}>
              Loading images...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-display text-lg" style={{ color: '#ef4444' }}>
              {error}
            </p>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display italic text-lg" style={{ color: 'var(--text-secondary)' }}>
              No images yet
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Paste or drag images into your notes and they will appear here.
            </p>
            <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
              Tip: You can paste images with Ctrl/Cmd+V or drag them into the editor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.filename}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: 'var(--shadow)',
                }}
                onClick={() => {
                  if (img.noteId) {
                    onOpenNote(img.noteId);
                    onClose();
                  }
                }}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={img.fullPath.startsWith('data:') || img.fullPath.startsWith('http') ? img.fullPath : `shuki://${encodeURIComponent(img.fullPath)}`}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {img.noteTitle || 'Unlinked image'}
                  </p>
                  {img.folderName && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {img.folderName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
