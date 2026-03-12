import React, { useEffect, useState } from 'react';
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

    // Filter out unlinked images (no note reference)
    const linkedImages = galleryImages.filter((img) => img.noteId !== null);
    setImages(linkedImages);
    } catch (err) {
      setError('Could not load images. Make sure the app has access to the images directory.');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Image Gallery
          </h1>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Back
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
              Loading images...
            </p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '1rem', color: '#EF4444' }}>
              {error}
            </p>
          </div>
        ) : images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '1rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
              No images yet
            </p>
            <p style={{ fontSize: '0.875rem', marginTop: 8, color: 'var(--text-secondary)' }}>
              Paste or drag images into your notes and they will appear here.
            </p>
            <p style={{ fontSize: '0.75rem', marginTop: 16, color: 'var(--text-muted)' }}>
              Tip: You can paste images with Ctrl/Cmd+V or drag them into the editor.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {images.map((img) => (
              <div
                key={img.filename}
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'box-shadow 200ms, transform 200ms',
                }}
                onClick={() => {
                  if (img.noteId) {
                    onOpenNote(img.noteId);
                    onClose();
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                  <img
                    src={img.fullPath.startsWith('data:') || img.fullPath.startsWith('http') ? img.fullPath : `shuki://${encodeURIComponent(img.fullPath)}`}
                    alt={img.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div style={{ padding: 12 }}>
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {img.noteTitle || 'Unlinked image'}
                  </p>
                  {img.folderName && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
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
