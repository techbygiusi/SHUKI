import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { common, createLowlight } from 'lowlight';
import { useStore } from '../store/useStore';
import { Note, Folder } from '../types';
import { getApi, uploadImageToServer, fetchImageFromServer, getCachedImageUrl } from '../utils/sync';

const lowlight = createLowlight(common);

/* ─────────────────────────────────────────────────
   Image node view
───────────────────────────────────────────────── */
function ImageNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const src = (node.attrs.src as string) || '';
  const isShukiImg = src.startsWith('shuki-img://');
  const isUploading = src.startsWith('uploading-');

  useEffect(() => {
    if (isUploading) {
      setImgLoading(true);
      return;
    }
    if (!isShukiImg) {
      setResolvedSrc(src);
      return;
    }

    const filename = src.replace('shuki-img://', '');

    // Check in-memory cache first
    const cached = getCachedImageUrl(filename);
    if (cached) {
      setResolvedSrc(cached);
      return;
    }

    // Fetch from server
    const { serverUrl, apiKey } = useStore.getState().settings;
    if (!serverUrl || !apiKey) {
      setImgError(true);
      return;
    }

    setImgLoading(true);
    setImgError(false);
    fetchImageFromServer(serverUrl, apiKey, filename)
      .then((url) => {
        setResolvedSrc(url);
        setImgLoading(false);
      })
      .catch(() => {
        setImgError(true);
        setImgLoading(false);
      });
  }, [src, isShukiImg]);

  const handleRetry = () => {
    if (!isShukiImg) return;
    const filename = src.replace('shuki-img://', '');
    const { serverUrl, apiKey } = useStore.getState().settings;
    if (!serverUrl || !apiKey) return;

    setImgLoading(true);
    setImgError(false);
    fetchImageFromServer(serverUrl, apiKey, filename)
      .then((url) => {
        setResolvedSrc(url);
        setImgLoading(false);
      })
      .catch(() => {
        setImgError(true);
        setImgLoading(false);
      });
  };

  if (imgLoading) {
    return (
      <NodeViewWrapper as="span" style={{ display: 'inline-block' }}>
        <div style={{
          padding: '16px 24px',
          borderRadius: 10,
          backgroundColor: 'var(--bg-hover)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            width: 14, height: 14,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
          Loading image...
        </div>
      </NodeViewWrapper>
    );
  }

  if (imgError) {
    return (
      <NodeViewWrapper as="span" style={{ display: 'inline-block' }}>
        <div style={{
          padding: '16px 24px',
          borderRadius: 10,
          backgroundColor: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>Image upload failed — retry</span>
          <button
            onClick={handleRetry}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="tiptap-image-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <img
          src={resolvedSrc || src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          style={{
            maxWidth: '100%',
            outline: selected ? '2px solid var(--accent)' : 'none',
            outlineOffset: 2,
            borderRadius: 10,
            cursor: 'pointer',
          }}
        />
        {(hovered || selected) && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(); }}
            style={{
              position: 'absolute',
              top: 6, right: 6,
              width: 22, height: 22,
              borderRadius: '50%',
              background: 'rgba(44,36,32,0.72)',
              color: '#FAF7F2',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              lineHeight: 1,
            }}
            title="Delete image"
          >
            &times;
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

const SelectableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

/* ─────────────────────────────────────────────────
   Types & constants
───────────────────────────────────────────────── */
interface Props {
  note: Note;
  onChange: (id: string, updates: Partial<Note>) => void;
  folders: Folder[];
}

const COLOR_PALETTE = [
  { name: 'Black',     hex: '#000000' },
  { name: 'Dark Grey', hex: '#4A4A4A' },
  { name: 'Grey',      hex: '#9B9B9B' },
  { name: 'White',     hex: '#FFFFFF' },
  { name: 'Red',       hex: '#E53E3E' },
  { name: 'Orange',    hex: '#ED8936' },
  { name: 'Amber',     hex: '#C17F3A' },
  { name: 'Yellow',    hex: '#ECC94B' },
  { name: 'Green',     hex: '#38A169' },
  { name: 'Teal',      hex: '#319795' },
  { name: 'Blue',      hex: '#3182CE' },
  { name: 'Purple',    hex: '#7C5CBF' },
  { name: 'Pink',      hex: '#D53F8C' },
  { name: 'Brown',     hex: '#8B6914' },
];

const SLASH_COMMANDS = [
  { id: 'h1',       label: 'Heading 1',     icon: 'H1'   },
  { id: 'h2',       label: 'Heading 2',     icon: 'H2'   },
  { id: 'h3',       label: 'Heading 3',     icon: 'H3'   },
  { id: 'bullet',   label: 'Bullet list',   icon: '•'    },
  { id: 'numbered', label: 'Numbered list', icon: '1.'   },
  { id: 'todo',     label: 'To-do list',    icon: '☑'   },
  { id: 'code',     label: 'Code block',    icon: '</>'  },
  { id: 'quote',    label: 'Quote',         icon: '"'    },
  { id: 'divider',  label: 'Divider',       icon: '—'    },
  { id: 'image',    label: 'Image',         icon: '⌅'   },
];

/* ─────────────────────────────────────────────────
   Content helpers
───────────────────────────────────────────────── */
function isJsonContent(content: string): boolean {
  if (!content) return false;
  const t = content.trimStart();
  return t.startsWith('{"type":') || t.startsWith('{"type" :');
}

function parseNoteContent(content: string): object | string {
  if (!content) return '';
  if (isJsonContent(content)) {
    try { return JSON.parse(content); } catch { return ''; }
  }
  return markdownToHtml(content);
}

function getPlainText(content: string): string {
  if (isJsonContent(content)) {
    try { return extractTextFromJson(JSON.parse(content)); } catch { return ''; }
  }
  return content.replace(/[#*_~`>\[\]()!|-]/g, '').trim();
}

function extractTextFromJson(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || '';
  const children = node.content as Record<string, unknown>[] | undefined;
  if (!children) return '';
  return children.map(extractTextFromJson).join(' ');
}

/* ─────────────────────────────────────────────────
   Editor
───────────────────────────────────────────────── */
export default function Editor({ note, onChange, folders }: Props) {
  const { editorMode, setEditorMode, settings } = useStore();
  const [showColorPicker, setShowColorPicker]   = useState(false);
  const [showSlashMenu, setShowSlashMenu]       = useState(false);
  const [slashFilter, setSlashFilter]           = useState('');
  const [slashIndex, setSlashIndex]             = useState(0);
  const [slashPos, setSlashPos]                 = useState<{ top: number; left: number } | null>(null);
  const [hoveringFooter, setHoveringFooter]     = useState(false);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkInputValue, setLinkInputValue]     = useState('');
  const [linkIsEdit, setLinkIsEdit]             = useState(false);

  const [isDragOver, setIsDragOver]             = useState(false);

  const colorPickerRef  = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const linkPopoverRef  = useRef<HTMLDivElement>(null);
  const linkBtnRef      = useRef<HTMLButtonElement>(null);

  const folder = useMemo(() =>
    note.folderId ? folders.find((f) => f.id === note.folderId) || null : null,
    [note.folderId, folders]
  );

  const plainText  = useMemo(() => getPlainText(note.content), [note.content]);
  const wordCount  = useMemo(() => plainText.trim().split(/\s+/).filter(Boolean).length, [plainText]);
  const charCount  = plainText.length;
  const readingMin = Math.max(1, Math.ceil(wordCount / 200));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      SelectableImage.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: "Start writing, or type '/' for commands…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: parseNoteContent(note.content),
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        handleImageFiles(imageFiles);
        return true;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItem = Array.from(items).find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;
        event.preventDefault();
        const file = imageItem.getAsFile();
        if (file) handleImageFiles([file]);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (showSlashMenu) {
          if (event.key === 'ArrowDown') { event.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1)); return true; }
          if (event.key === 'ArrowUp')   { event.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return true; }
          if (event.key === 'Enter')     { event.preventDefault(); const cmd = filteredSlashCommands[slashIndex]; if (cmd) executeSlashCommand(cmd.id); return true; }
          if (event.key === 'Escape')    { setShowSlashMenu(false); return true; }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (editorMode === 'rich') {
        onChange(note.id, { content: JSON.stringify(ed.getJSON()) });
      }
      const { $from } = ed.state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      if (textBefore.startsWith('/')) {
        setSlashFilter(textBefore.slice(1).toLowerCase());
        setSlashIndex(0);
        setShowSlashMenu(true);
        const coords = ed.view.coordsAtPos($from.pos);
        const rect   = ed.view.dom.getBoundingClientRect();
        setSlashPos({ top: coords.bottom - rect.top + 4, left: coords.left - rect.left });
      } else {
        setShowSlashMenu(false);
      }
    },
  }, [note.id]);

  const filteredSlashCommands = useMemo(() =>
    !slashFilter ? SLASH_COMMANDS : SLASH_COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(slashFilter) || c.id.includes(slashFilter)
    ), [slashFilter]
  );

  const executeSlashCommand = useCallback((id: string) => {
    if (!editor) return;
    setShowSlashMenu(false);
    const { $from } = editor.state.selection;
    const start = $from.pos - $from.parentOffset;
    editor.chain().focus().deleteRange({ from: start, to: $from.pos }).run();
    switch (id) {
      case 'h1':       editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2':       editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'h3':       editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case 'bullet':   editor.chain().focus().toggleBulletList().run(); break;
      case 'numbered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'todo':     editor.chain().focus().toggleTaskList().run(); break;
      case 'code':     editor.chain().focus().toggleCodeBlock().run(); break;
      case 'quote':    editor.chain().focus().toggleBlockquote().run(); break;
      case 'divider':  editor.chain().focus().setHorizontalRule().run(); break;
      case 'image':    fileInputRef.current?.click(); break;
    }
  }, [editor]);

  useEffect(() => {
    if (editor && editorMode === 'rich') {
      editor.commands.setContent(parseNoteContent(note.content), { emitUpdate: false });
    }
  }, [note.id, editorMode]);

  async function handleImageFiles(files: File[]) {
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop() || 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      // Insert a placeholder while uploading
      const placeholderId = `uploading-${filename}`;
      if (editor && editorMode === 'rich') {
        editor.chain().focus().setImage({ src: placeholderId, alt: 'Uploading...' }).run();
      }

      // Save locally for offline access
      if (window.electronAPI) {
        await window.electronAPI.images.save(arrayBuffer, filename);
      }

      // Try to upload to server
      const api = getApi();
      const state = useStore.getState();
      let finalFilename = filename;
      if (api && !state.settings.offlineOnly && state.syncState !== 'auth_error') {
        try {
          const result = await uploadImageToServer(api, arrayBuffer, filename);
          finalFilename = result.filename;
        } catch {
          // Fall through to local-only path
        }
      }

      // Replace placeholder with actual image
      const imgSrc = `shuki-img://${finalFilename}`;
      if (editor && editorMode === 'rich') {
        // Find and replace the placeholder node
        const { doc } = editor.state;
        let placeholderPos = -1;
        doc.descendants((node, pos) => {
          if (node.type.name === 'image' && node.attrs.src === placeholderId) {
            placeholderPos = pos;
            return false;
          }
          return true;
        });
        if (placeholderPos >= 0) {
          const node = editor.state.schema.nodes.image.create({ src: imgSrc, alt: file.name });
          editor.view.dispatch(
            editor.state.tr.replaceWith(placeholderPos, placeholderPos + 1, node)
          );
        } else {
          // Placeholder not found (edge case), just insert
          editor.chain().focus().setImage({ src: imgSrc, alt: file.name }).run();
        }
      }
    }
  }

  const handleFilePickerImage  = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileInputChange  = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleImageFiles(Array.from(files));
    e.target.value = '';
  }, [editor, editorMode, note.id]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(note.id, { title: e.target.value }),
    [note.id, onChange]
  );

  const handleMarkdownChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(note.id, { content: e.target.value }),
    [note.id, onChange]
  );

  const toggleMode = useCallback(() => {
    const newMode = editorMode === 'rich' ? 'markdown' : 'rich';
    setEditorMode(newMode);
    if (newMode === 'rich' && editor) {
      editor.commands.setContent(parseNoteContent(note.content), { emitUpdate: false });
    }
  }, [editorMode, setEditorMode, editor, note.content]);

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  useEffect(() => {
    if (!isLinkPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node) &&
        linkBtnRef.current   && !linkBtnRef.current.contains(e.target as Node)
      ) setIsLinkPopoverOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isLinkPopoverOpen]);

  const handleLinkButtonClick = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      setLinkInputValue(editor.getAttributes('link').href || '');
      setLinkIsEdit(true);
      setIsLinkPopoverOpen(true);
    } else if (!editor.state.selection.empty) {
      setLinkInputValue('');
      setLinkIsEdit(false);
      setIsLinkPopoverOpen(true);
    }
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor || !linkInputValue.trim()) return;
    let url = linkInputValue.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
    setIsLinkPopoverOpen(false);
    setLinkInputValue('');
  }, [editor, linkInputValue]);

  const handleUnlink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setIsLinkPopoverOpen(false);
    setLinkInputValue('');
  }, [editor]);

  const currentTextColor  = editor?.getAttributes('textStyle')?.color || null;
  const linkBtnDisabled   = editor ? (!editor.isActive('link') && editor.state.selection.empty) : true;
  const breadcrumb        = folder ? `${folder.name} / ${note.title || 'Untitled'}` : note.title || 'Untitled';

  const markdownContent = useMemo(() => {
    if (!isJsonContent(note.content)) return note.content;
    if (editor) return htmlToMarkdown(editor.getHTML());
    return note.content;
  }, [note.content, editor, editorMode]);

  return (
    <div className="flex flex-col h-full fade-in" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />

      {/* ── Breadcrumb title bar ── */}
      <div
        className="flex items-center justify-center"
        style={{
          height: 40,
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          letterSpacing: '0.02em',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          WebkitAppRegion: 'drag',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
        } as React.CSSProperties}
      >
        {breadcrumb}
      </div>

      {/* ── Content column ── */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 28px' }}>

          {/* Folder label above title */}
          {folder && (
            <div style={{
              fontSize: '0.65rem',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              paddingTop: 56,
              marginBottom: 12,
            }}>
              {folder.name}
            </div>
          )}

          {/* Title input */}
          <input
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            className="w-full bg-transparent outline-none border-none"
            style={{
              color: 'var(--text-primary)',
              fontSize: '2.1rem',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              marginBottom: 8,
              paddingTop: folder ? 0 : 56,
            }}
            placeholder="Untitled"
          />

          {/* ── Toolbar (rich mode) ── */}
          {editorMode === 'rich' && editor && (
            <div
              className="flex items-center gap-0.5 relative"
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
                padding: '5px 0',
                zIndex: 10,
              }}
            >
              {/* Text style */}
              <ToolBtn active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"><b>B</b></ToolBtn>
              <ToolBtn active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"><em>I</em></ToolBtn>
              <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></ToolBtn>
              <ToolBtn active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strike"><s>S</s></ToolBtn>
              <Sep />
              {/* Headings */}
              <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">H1</ToolBtn>
              <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</ToolBtn>
              <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</ToolBtn>
              <Sep />
              {/* Lists */}
              <ToolBtn active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list">&#8226;</ToolBtn>
              <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1.</ToolBtn>
              <ToolBtn active={editor.isActive('taskList')}    onClick={() => editor.chain().focus().toggleTaskList().run()}    title="Task list">&#9745;</ToolBtn>
              <Sep />
              {/* Blocks */}
              <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">&#8220;</ToolBtn>
              <ToolBtn active={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}  title="Code block">&lt;/&gt;</ToolBtn>
              <ToolBtn active={editor.isActive('highlight')}  onClick={() => editor.chain().focus().toggleHighlight().run()}  title="Highlight">&#9998;</ToolBtn>
              <Sep />
              {/* Link */}
              <div className="relative">
                <button
                  ref={linkBtnRef}
                  className={`toolbar-btn${editor.isActive('link') ? ' active' : ''}${linkBtnDisabled ? ' opacity-40' : ''}`}
                  onClick={handleLinkButtonClick}
                  title={editor.isActive('link') ? 'Edit link' : 'Insert link'}
                  disabled={linkBtnDisabled}
                  style={linkBtnDisabled ? { cursor: 'not-allowed' } : undefined}
                >
                  &#128279;
                </button>
                {isLinkPopoverOpen && (
                  <div
                    ref={linkPopoverRef}
                    className="link-popover"
                    style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5 }}
                  >
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={linkInputValue}
                      onChange={(e) => setLinkInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  { e.preventDefault(); handleLinkSubmit(); }
                        if (e.key === 'Escape') setIsLinkPopoverOpen(false);
                      }}
                      autoFocus
                    />
                    <button onClick={handleLinkSubmit} style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                      {linkIsEdit ? 'Update' : 'Apply'}
                    </button>
                    {linkIsEdit && (
                      <button onClick={handleUnlink} style={{ backgroundColor: '#E05252', color: '#fff' }}>
                        Unlink
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Image + divider */}
              <ToolBtn active={false} onClick={handleFilePickerImage} title="Insert image">&#8679;</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">&#8213;</ToolBtn>
              <Sep />
              {/* Color picker */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Text color"
                  className={`toolbar-btn${showColorPicker ? ' active' : ''}`}
                  style={{ flexDirection: 'column', gap: 1 }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>A</span>
                  <span style={{
                    width: 14, height: 2.5, borderRadius: 2, marginTop: 1,
                    backgroundColor: currentTextColor || 'var(--text-primary)',
                  }} />
                </button>
                {showColorPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 6,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 50,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, width: 182, marginBottom: 8 }}>
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          title={c.name}
                          style={{
                            width: 22, height: 22,
                            borderRadius: 5,
                            backgroundColor: c.hex,
                            border: c.hex === '#FFFFFF' ? '1px solid var(--border)' : '1px solid transparent',
                            outline: currentTextColor === c.hex ? '2px solid var(--accent)' : 'none',
                            outlineOffset: 1,
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                          onClick={() => { editor.chain().focus().setColor(c.hex).run(); setShowColorPicker(false); }}
                        />
                      ))}
                    </div>
                    <button
                      style={{
                        width: '100%',
                        fontSize: '0.72rem',
                        padding: '5px 0',
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-hover)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                      onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                    >
                      Remove colour
                    </button>
                  </div>
                )}
              </div>

              {/* Spacer + MD toggle */}
              <div style={{ flex: 1 }} />
              <button
                onClick={toggleMode}
                title="Switch to Markdown"
                style={{
                  padding: '3px 8px',
                  borderRadius: 5,
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                MD
              </button>
            </div>
          )}

          {/* ── Editor body ── */}
          {editorMode === 'rich' ? (
            <div
              className="relative"
              onDragOver={(e) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                  e.preventDefault();
                  setIsDragOver(true);
                }
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={() => setIsDragOver(false)}
              style={{
                outline: isDragOver ? '2px dashed var(--accent)' : 'none',
                outlineOffset: -2,
                borderRadius: 8,
                transition: 'outline 0.15s',
                backgroundColor: isDragOver ? 'rgba(193,127,58,0.04)' : 'transparent',
              }}
            >
              <EditorContent editor={editor} />
              {/* Slash menu */}
              {showSlashMenu && slashPos && filteredSlashCommands.length > 0 && (
                <div className="slash-menu" style={{ top: slashPos.top, left: slashPos.left }}>
                  {filteredSlashCommands.map((cmd, i) => (
                    <div
                      key={cmd.id}
                      className={`slash-menu-item ${i === slashIndex ? 'active' : ''}`}
                      onClick={() => executeSlashCommand(cmd.id)}
                      onMouseEnter={() => setSlashIndex(i)}
                    >
                      <span className="slash-icon">{cmd.icon}</span>
                      <span className="slash-label">{cmd.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MarkdownView
              content={markdownContent}
              onContentChange={handleMarkdownChange}
              onToggleMode={toggleMode}
              fontSize={settings.fontSize}
            />
          )}
        </div>
      </div>

      {/* ── Footer — word count (fades in on hover) ── */}
      <div
        style={{
          padding: '6px 20px',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: hoveringFooter ? 1 : 0,
          transition: 'opacity 0.2s',
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
        }}
        onMouseEnter={() => setHoveringFooter(true)}
        onMouseLeave={() => setHoveringFooter(false)}
      >
        <span>{wordCount} words</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>{charCount} characters</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>~{readingMin} min read</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MarkdownView
───────────────────────────────────────────────── */
function MarkdownView({ content, onContentChange, onToggleMode, fontSize }: {
  content: string;
  onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onToggleMode: () => void;
  fontSize: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="relative">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 10, paddingTop: 4 }}>
        <MdBtn
          onClick={handleCopyMarkdown}
          style={{
            backgroundColor: copied ? 'rgba(110,231,160,0.15)' : 'transparent',
            color: copied ? '#3D8B62' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {copied ? 'Copied ✓' : 'Copy markdown'}
        </MdBtn>
        <MdBtn
          onClick={onToggleMode}
          style={{ backgroundColor: 'var(--accent)', color: '#fff', border: 'none' }}
        >
          WYSIWYG
        </MdBtn>
      </div>
      <textarea
        value={content}
        onChange={onContentChange}
        className="w-full min-h-[60vh] bg-transparent outline-none resize-none"
        style={{
          color: 'var(--text-primary)',
          fontSize,
          lineHeight: '1.85',
          fontFamily: 'var(--font-mono)',
        }}
        placeholder="Write in Markdown…"
        readOnly
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Primitives
───────────────────────────────────────────────── */
function ToolBtn({ active, onClick, title, children, disabled }: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`toolbar-btn${active ? ' active' : ''}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <div style={{
      width: 1, height: 18, margin: '0 3px',
      backgroundColor: 'var(--border)',
      flexShrink: 0,
    }} />
  );
}

function MdBtn({ onClick, style, children }: {
  onClick: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        fontSize: '0.75rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        opacity: hovered ? 0.82 : 1,
        transition: 'opacity 0.12s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   Conversion utilities (unchanged logic)
───────────────────────────────────────────────── */
function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');
  html = html.replace(/^[*-] (.+)$/gm, '<ul><li><p>$1</p></li></ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<ol><li><p>$1</p></li></ol>');
  html = html.replace(/^---$/gm, '<hr />');
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') { result.push(''); }
    else if (/^<[a-z]/.test(line.trim())) { result.push(line); }
    else { result.push(`<p>${line}</p>`); }
  }
  return result.join('\n');
}

function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi,   '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi,   '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi,   '### $1\n');
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi,           '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi,         '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi,           '*$1*');
  md = md.replace(/<u>(.*?)<\/u>/gi,           '$1');
  md = md.replace(/<s>(.*?)<\/s>/gi,           '~~$1~~');
  md = md.replace(/<del>(.*?)<\/del>/gi,       '~~$1~~');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  md = md.replace(/<blockquote[^>]*><p>(.*?)<\/p><\/blockquote>/gi, '> $1\n');
  md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1```\n');
  md = md.replace(/<code>(.*?)<\/code>/gi,     '`$1`');
  md = md.replace(/<hr\s*\/?>/gi,              '---\n');
  md = md.replace(/<li[^>]*data-checked="true"[^>]*><p>(.*?)<\/p><\/li>/gi,  '- [x] $1');
  md = md.replace(/<li[^>]*data-checked="false"[^>]*><p>(.*?)<\/p><\/li>/gi, '- [ ] $1');
  md = md.replace(/<li[^>]*><p>(.*?)<\/p><\/li>/gi, '- $1');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi,   '- $1');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi,     '$1\n');
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1');
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
  md = md.replace(/<\/?[^>]+(>|$)/g,          '');
  md = md.replace(/&amp;/g,  '&');
  md = md.replace(/&lt;/g,   '<');
  md = md.replace(/&gt;/g,   '>');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
