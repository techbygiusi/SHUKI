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

/** Extract shuki-img:// filenames from TipTap JSON content */
function extractImagesFromJson(node: Record<string, unknown>): string[] {
  const results: string[] = [];
  if (node.type === 'image') {
    const src = (node.attrs as Record<string, unknown>)?.src as string | undefined;
    if (src && src.startsWith('shuki-img://')) {
      results.push(src.replace('shuki-img://', ''));
    }
  }
  const content = node.content as Record<string, unknown>[] | undefined;
  if (content) {
    for (const child of content) {
      results.push(...extractImagesFromJson(child));
    }
  }
  return results;
}

export default function Gallery({ onClose, onOpenNote }: Props) {
  const { notes, folders } = useStore();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);

  useEffect(() => { loadImages(); }, [notes]);

  async function loadImages() {
    try {
      setLoading(true);
      setError(null);
      const basePath = await getImagesPath();

      const galleryImages: GalleryImage[] = [];
      const seenFilenames = new Set<string>();

      // Extract images from TipTap JSON content (shuki-img:// references)
      for (const note of notes) {
        const content = note.content;
        if (!content) continue;

        let imageFilenames: string[] = [];

        // Try parsing as TipTap JSON
        const trimmed = content.trimStart();
        if (trimmed.startsWith('{"type":') || trimmed.startsWith('{"type" :')) {
          try {
            const json = JSON.parse(content) as Record<string, unknown>;
            imageFilenames = extractImagesFromJson(json);
          } catch { /* not valid JSON */ }
        }

        // Also check for shuki-img:// in raw content (covers markdown mode and plain text references)
        const shukiImgRegex = /shuki-img:\/\/([^\s"'<>)]+)/g;
        let match;
        while ((match = shukiImgRegex.exec(content)) !== null) {
          const fn = match[1];
          if (!imageFilenames.includes(fn)) imageFilenames.push(fn);
        }

        // Also check for markdown image syntax
        const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        while ((match = mdImgRegex.exec(content)) !== null) {
          const src = match[2];
          if (src.startsWith('shuki-img://')) {
            const fn = src.replace('shuki-img://', '');
            if (!imageFilenames.includes(fn)) imageFilenames.push(fn);
          }
        }

        let folderName: string | null = null;
        if (note.folderId) {
          const folder = folders.find((f) => f.id === note.folderId);
          folderName = folder?.name || null;
        }

        for (const filename of imageFilenames) {
          if (seenFilenames.has(filename)) continue;
          seenFilenames.add(filename);
          galleryImages.push({
            filename,
            fullPath: `shuki-img://${filename}`,
            noteId: note.id,
            noteTitle: note.title,
            folderName,
          });
        }
      }

      // Also include local images that may be referenced by filename in content
      const localFilenames = await listLocalImages();
      for (const filename of localFilenames) {
        if (seenFilenames.has(filename)) continue;
        const fullPath = `${basePath}/${filename}`;

        let noteId: string | null = null;
        let noteTitle = '';
        let folderName: string | null = null;

        for (const note of notes) {
          if (note.content.includes(filename)) {
            noteId = note.id;
            noteTitle = note.title;
            if (note.folderId) {
              const folder = folders.find((f) => f.id === note.folderId);
              folderName = folder?.name || null;
            }
            break;
          }
        }

        if (noteId) {
          seenFilenames.add(filename);
          galleryImages.push({ filename, fullPath, noteId, noteTitle, folderName });
        }
      }

      setImages(galleryImages);
    } catch {
      setError('Could not load images. Make sure the app has access to the images directory.');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }

  const imgSrc = (img: GalleryImage) =>
    img.fullPath.startsWith('shuki-img://') || img.fullPath.startsWith('data:') || img.fullPath.startsWith('http')
      ? img.fullPath
      : `shuki://${encodeURIComponent(img.fullPath)}`;

  return (
    <>
      <div className="h-screen overflow-y-auto fade-in" style={{ backgroundColor: 'var(--bg)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 32px 80px' }}>

          {/* ── Header ── */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.6rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}>
                Image Gallery
              </h1>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginTop: 2,
              }}>
                All images across your notes
              </p>
            </div>
            <BackButton onClick={onClose} />
          </div>

          {/* ── Count pill ── */}
          {!loading && !error && images.length > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginBottom: 20,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                backgroundColor: 'var(--accent)', flexShrink: 0,
              }} />
              {images.length} image{images.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* ── States ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{
                width: 28, height: 28,
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 14px',
              }} />
              <p style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
              }}>
                Loading images…
              </p>
            </div>
          )}

          {!loading && error && (
            <div style={{
              padding: '18px 22px',
              borderRadius: 12,
              backgroundColor: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.20)',
              color: '#C05050',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
            }}>
              {error}
            </div>
          )}

          {!loading && !error && images.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 24px',
              maxWidth: 360,
              margin: '0 auto',
            }}>
              {/* Decorative icon */}
              <div style={{
                width: 56, height: 56,
                borderRadius: 14,
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                marginBottom: 10,
              }}>
                No images yet
              </p>
              <p style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                marginBottom: 14,
              }}>
                Paste or drag images into your notes and they'll appear here.
              </p>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
              }}>
                Tip: use Ctrl/Cmd+V or drag directly into the editor.
              </p>
            </div>
          )}

          {/* ── Grid ── */}
          {!loading && !error && images.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}>
              {images.map((img) => (
                <GalleryCard
                  key={img.filename}
                  img={img}
                  src={imgSrc(img)}
                  onOpen={() => {
                    if (img.noteId) { onOpenNote(img.noteId); onClose(); }
                  }}
                  onLightbox={() => setLightbox(img)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          img={lightbox}
          src={imgSrc(lightbox)}
          onClose={() => setLightbox(null)}
          onOpenNote={() => {
            if (lightbox.noteId) { onOpenNote(lightbox.noteId); onClose(); }
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────
   GalleryCard
───────────────────────────────────────────────── */
function GalleryCard({
  img, src, onOpen, onLightbox,
}: {
  img: GalleryImage;
  src: string;
  onOpen: () => void;
  onLightbox: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.18s',
        boxShadow: hovered ? 'var(--shadow-md)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div
        style={{ aspectRatio: '1', overflow: 'hidden', position: 'relative' }}
        onClick={onLightbox}
      >
        <img
          src={src}
          alt={img.filename}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transition: 'transform 0.22s',
            transform: hovered ? 'scale(1.03)' : 'scale(1)',
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(44,36,32,0.35) 0%, transparent 50%)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.18s',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: 10,
        }}>
          <span style={{
            fontSize: '0.7rem',
            color: 'rgba(250,247,242,0.85)',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
          }}>
            Click to expand
          </span>
        </div>
      </div>

      {/* Caption */}
      <div
        style={{ padding: '10px 12px 11px' }}
        onClick={onOpen}
      >
        <p style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: img.folderName ? 2 : 0,
        }}>
          {img.noteTitle || 'Untitled note'}
        </p>
        {img.folderName && (
          <p style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              backgroundColor: 'var(--border)', flexShrink: 0,
            }} />
            {img.folderName}
          </p>
        )}
        <p style={{
          fontSize: '0.68rem',
          color: 'var(--accent)',
          marginTop: 5,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
        }}>
          Open note →
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Lightbox
───────────────────────────────────────────────── */
function Lightbox({
  img, src, onClose, onOpenNote,
}: {
  img: GalleryImage;
  src: string;
  onClose: () => void;
  onOpenNote: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(20,15,12,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 860,
          width: '100%',
          backgroundColor: 'var(--bg-sidebar)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        <img
          src={src}
          alt={img.filename}
          style={{
            width: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            display: 'block',
            backgroundColor: 'var(--bg)',
          }}
        />
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border)',
        }}>
          <div>
            <p style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 2,
            }}>
              {img.noteTitle || 'Untitled note'}
            </p>
            {img.folderName && (
              <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {img.folderName}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <LightboxBtn variant="primary" onClick={onOpenNote}>Open note</LightboxBtn>
            <LightboxBtn variant="ghost" onClick={onClose}>Close</LightboxBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Primitives
───────────────────────────────────────────────── */

function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 18px',
        borderRadius: 8,
        fontSize: '0.82rem',
        fontWeight: 500,
        backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s',
      }}
    >
      ← Back
    </button>
  );
}

function LightboxBtn({
  variant, onClick, children,
}: {
  variant: 'primary' | 'ghost';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: '0.8rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        border: variant === 'primary' ? 'none' : '1px solid var(--border)',
        backgroundColor: variant === 'primary'
          ? (hovered ? 'var(--accent-hover)' : 'var(--accent)')
          : (hovered ? 'var(--bg-hover)' : 'transparent'),
        color: variant === 'primary' ? '#fff' : 'var(--text-secondary)',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  );
}
