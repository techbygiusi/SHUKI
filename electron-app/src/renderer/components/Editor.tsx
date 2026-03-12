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

const lowlight = createLowlight(common);

function ImageNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <NodeViewWrapper as="span" className="tiptap-image-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || undefined}
          style={{
            maxWidth: '100%',
            outline: selected ? '3px solid #C17F3A' : 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        />
        {(hovered || selected) && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(); }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
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

interface Props {
  note: Note;
  onChange: (id: string, updates: Partial<Note>) => void;
  folders: Folder[];
}

const COLOR_PALETTE = [
  { name: 'Black', hex: '#000000' },
  { name: 'Dark Grey', hex: '#4A4A4A' },
  { name: 'Grey', hex: '#9B9B9B' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#E53E3E' },
  { name: 'Orange', hex: '#ED8936' },
  { name: 'Amber', hex: '#C17F3A' },
  { name: 'Yellow', hex: '#ECC94B' },
  { name: 'Green', hex: '#38A169' },
  { name: 'Teal', hex: '#319795' },
  { name: 'Blue', hex: '#3182CE' },
  { name: 'Purple', hex: '#7C5CBF' },
  { name: 'Pink', hex: '#D53F8C' },
  { name: 'Brown', hex: '#8B6914' },
];

const SLASH_COMMANDS = [
  { id: 'h1', label: 'Heading 1', icon: 'H1' },
  { id: 'h2', label: 'Heading 2', icon: 'H2' },
  { id: 'h3', label: 'Heading 3', icon: 'H3' },
  { id: 'bullet', label: 'Bullet List', icon: '•' },
  { id: 'numbered', label: 'Numbered List', icon: '1.' },
  { id: 'todo', label: 'To-do List', icon: '☑' },
  { id: 'code', label: 'Code Block', icon: '</>' },
  { id: 'quote', label: 'Quote', icon: '"' },
  { id: 'divider', label: 'Divider', icon: '—' },
  { id: 'image', label: 'Image', icon: '🖼' },
];

/** Check if content string looks like TipTap JSON */
function isJsonContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trimStart();
  return trimmed.startsWith('{"type":') || trimmed.startsWith('{"type" :');
}

/** Parse stored content: returns TipTap JSON object or HTML string for legacy markdown */
function parseNoteContent(content: string): object | string {
  if (!content) return '';
  if (isJsonContent(content)) {
    try {
      return JSON.parse(content);
    } catch {
      return '';
    }
  }
  // Legacy markdown content — convert to HTML for editor
  return markdownToHtml(content);
}

/** Extract plain text from content for word counting */
function getPlainText(content: string): string {
  if (isJsonContent(content)) {
    try {
      const json = JSON.parse(content);
      return extractTextFromJson(json);
    } catch {
      return '';
    }
  }
  return content.replace(/[#*_~`>\[\]()!|-]/g, '').trim();
}

function extractTextFromJson(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || '';
  const children = node.content as Record<string, unknown>[] | undefined;
  if (!children) return '';
  return children.map(extractTextFromJson).join(' ');
}

export default function Editor({ note, onChange, folders }: Props) {
  const { editorMode, setEditorMode, settings } = useStore();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveringFooter, setHoveringFooter] = useState(false);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [linkIsEdit, setLinkIsEdit] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

  const folder = useMemo(() => {
    if (!note.folderId) return null;
    return folders.find((f) => f.id === note.folderId) || null;
  }, [note.folderId, folders]);

  const plainText = useMemo(() => getPlainText(note.content), [note.content]);
  const wordCount = useMemo(() => {
    const words = plainText.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [plainText]);
  const charCount = plainText.length;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
        },
      }),
      SelectableImage.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Type \'/\' for commands...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: parseNoteContent(note.content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
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
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSlashIndex((i) => Math.min(i + 1, filteredSlashCommands.length - 1));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSlashIndex((i) => Math.max(i - 1, 0));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const cmd = filteredSlashCommands[slashIndex];
            if (cmd) executeSlashCommand(cmd.id);
            return true;
          }
          if (event.key === 'Escape') {
            setShowSlashMenu(false);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (editorMode === 'rich') {
        // Store as TipTap JSON to preserve all marks
        const json = JSON.stringify(ed.getJSON());
        onChange(note.id, { content: json });
      }

      // Slash command detection
      const { state } = ed;
      const { $from } = state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (textBefore.startsWith('/')) {
        const filter = textBefore.slice(1).toLowerCase();
        setSlashFilter(filter);
        setSlashIndex(0);
        setShowSlashMenu(true);

        // Get cursor position for menu placement
        const coords = ed.view.coordsAtPos($from.pos);
        const editorRect = ed.view.dom.getBoundingClientRect();
        setSlashPos({
          top: coords.bottom - editorRect.top + 4,
          left: coords.left - editorRect.left,
        });
      } else {
        setShowSlashMenu(false);
      }
    },
  }, [note.id]);

  const filteredSlashCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(slashFilter) || c.id.includes(slashFilter)
    );
  }, [slashFilter]);

  const executeSlashCommand = useCallback((id: string) => {
    if (!editor) return;
    setShowSlashMenu(false);

    // Delete the slash command text
    const { state } = editor;
    const { $from } = state.selection;
    const start = $from.pos - $from.parentOffset;
    editor.chain().focus()
      .deleteRange({ from: start, to: $from.pos })
      .run();

    switch (id) {
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'numbered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'todo': editor.chain().focus().toggleTaskList().run(); break;
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
      case 'divider': editor.chain().focus().setHorizontalRule().run(); break;
      case 'image': fileInputRef.current?.click(); break;
    }
  }, [editor]);

  // Update editor content when switching notes
  useEffect(() => {
    if (editor && editorMode === 'rich') {
      const parsed = parseNoteContent(note.content);
      editor.commands.setContent(parsed, { emitUpdate: false });
    }
  }, [note.id, editorMode]);

  async function handleImageFiles(files: File[]) {
    for (const file of files) {
      if (window.electronAPI) {
        const arrayBuffer = await file.arrayBuffer();
        const ext = file.name.split('.').pop() || 'png';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const savedPath = await window.electronAPI.images.save(arrayBuffer, filename);
        const imgSrc = `shuki://${encodeURIComponent(savedPath)}`;
        if (editor && editorMode === 'rich') {
          editor.chain().focus().setImage({ src: imgSrc, alt: file.name }).run();
        }
      } else {
        // Browser fallback: use base64
        const base64 = await fileToBase64(file);
        if (editor && editorMode === 'rich') {
          editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
        }
      }
    }
  }

  const handleFilePickerImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageFiles(Array.from(files));
    }
    e.target.value = '';
  }, [editor, editorMode, note.id]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(note.id, { title: e.target.value });
    },
    [note.id, onChange]
  );

  const handleMarkdownChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(note.id, { content: e.target.value });
    },
    [note.id, onChange]
  );

  const toggleMode = useCallback(() => {
    const newMode = editorMode === 'rich' ? 'markdown' : 'rich';
    setEditorMode(newMode);
    if (newMode === 'rich' && editor) {
      const parsed = parseNoteContent(note.content);
      editor.commands.setContent(parsed, { emitUpdate: false });
    }
  }, [editorMode, setEditorMode, editor, note.content]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  // Close link popover on outside click
  useEffect(() => {
    if (!isLinkPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node) &&
        linkBtnRef.current && !linkBtnRef.current.contains(e.target as Node)
      ) {
        setIsLinkPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isLinkPopoverOpen]);

  const handleLinkButtonClick = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      // Show popover with current href pre-filled
      const href = editor.getAttributes('link').href || '';
      setLinkInputValue(href);
      setLinkIsEdit(true);
      setIsLinkPopoverOpen(true);
    } else if (editor.state.selection.empty) {
      // No text selected, do nothing
      return;
    } else {
      // Show popover with empty input for new URL
      setLinkInputValue('');
      setLinkIsEdit(false);
      setIsLinkPopoverOpen(true);
    }
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor || !linkInputValue.trim()) return;
    let url = linkInputValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
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

  const currentTextColor = editor?.getAttributes('textStyle')?.color || null;

  /** Generate markdown from current content for display in markdown mode */
  const markdownContent = useMemo(() => {
    if (!isJsonContent(note.content)) return note.content;
    // Generate markdown from the editor HTML if available
    if (editor) {
      return htmlToMarkdown(editor.getHTML());
    }
    return note.content;
  }, [note.content, editor, editorMode]);

  // Breadcrumb text
  const breadcrumb = folder ? `${folder.name} / ${note.title || 'Untitled'}` : note.title || 'Untitled';

  // Link button disabled state
  const linkBtnDisabled = editor ? (!editor.isActive('link') && editor.state.selection.empty) : true;

  return (
    <div className="flex flex-col h-full fade-in" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Hidden file input for image picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Breadcrumb title bar */}
      <div
        className="flex items-center justify-center"
        style={{
          height: 40,
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <span>{breadcrumb}</span>
      </div>

      {/* Centered content column */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 24px' }}>
          {/* Breadcrumb above title */}
          {folder && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: 16,
              paddingTop: 60,
            }}>
              {folder.name}
            </div>
          )}

          {/* Large page title */}
          <input
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            className="w-full bg-transparent outline-none border-none"
            style={{
              color: 'var(--text-primary)',
              fontSize: '2.25rem',
              fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.2,
              marginBottom: '8px',
              paddingTop: folder ? 0 : 60,
            }}
            placeholder="Untitled"
          />

          {/* Toolbar */}
          {editorMode === 'rich' && editor && (
            <div
              className="flex items-center gap-0.5 relative"
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
                padding: '6px 0',
                zIndex: 10,
              }}
            >
              <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">B</ToolBtn>
              <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></ToolBtn>
              <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><u>U</u></ToolBtn>
              <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><s>S</s></ToolBtn>
              <Sep />
              <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">H1</ToolBtn>
              <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</ToolBtn>
              <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</ToolBtn>
              <Sep />
              <ToolBtn
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet list"
              >&#8226;</ToolBtn>
              <ToolBtn
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Numbered list"
              >1.</ToolBtn>
              <ToolBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list">&#9745;</ToolBtn>
              <Sep />
              <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">&#8220;</ToolBtn>
              <ToolBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">&lt;/&gt;</ToolBtn>
              <ToolBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">{'\uD83D\uDD8D'}</ToolBtn>
              <Sep />
              <div className="relative">
                <button
                  ref={linkBtnRef}
                  className={`toolbar-btn${editor.isActive('link') ? ' active' : ''}${linkBtnDisabled ? ' opacity-40' : ''}`}
                  onClick={handleLinkButtonClick}
                  title={editor.isActive('link') ? 'Edit link' : 'Insert link'}
                  disabled={linkBtnDisabled}
                  style={linkBtnDisabled ? { cursor: 'not-allowed' } : undefined}
                >
                  {'\uD83D\uDD17'}
                </button>
                {isLinkPopoverOpen && (
                  <div ref={linkPopoverRef} className="link-popover" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={linkInputValue}
                      onChange={(e) => setLinkInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLinkSubmit();
                        }
                        if (e.key === 'Escape') {
                          setIsLinkPopoverOpen(false);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleLinkSubmit}
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                      }}
                    >
                      {linkIsEdit ? 'Update' : 'Apply'}
                    </button>
                    {linkIsEdit && (
                      <button
                        onClick={handleUnlink}
                        style={{
                          backgroundColor: '#EF4444',
                          color: '#fff',
                        }}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                )}
              </div>
              <ToolBtn active={false} onClick={handleFilePickerImage} title="Insert image">{'\uD83D\uDCF7'}</ToolBtn>
              <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">{'\u2015'}</ToolBtn>
              <Sep />
              <div className="relative" ref={colorPickerRef}>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Text color"
                  className={`toolbar-btn${showColorPicker ? ' active' : ''}`}
                  style={{ flexDirection: 'column' }}
                >
                  <span style={{ fontWeight: 700 }}>A</span>
                  <span style={{
                    width: 16,
                    height: 3,
                    borderRadius: 2,
                    marginTop: 1,
                    backgroundColor: currentTextColor || 'var(--text-primary)',
                  }} />
                </button>
                {showColorPicker && (
                  <div
                    className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 p-2 rounded-lg z-50"
                    style={{
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div className="grid grid-cols-7 gap-1 mb-1.5" style={{ width: '182px' }}>
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          title={c.name}
                          className="w-6 h-6 rounded-md transition-all hover:scale-110"
                          style={{
                            backgroundColor: c.hex,
                            border: c.hex === '#FFFFFF' ? '1px solid var(--border)' : '1px solid transparent',
                            outline: currentTextColor === c.hex ? '2px solid var(--accent)' : 'none',
                            outlineOffset: '1px',
                          }}
                          onClick={() => {
                            editor.chain().focus().setColor(c.hex).run();
                            setShowColorPicker(false);
                          }}
                        />
                      ))}
                    </div>
                    <button
                      className="w-full text-xs py-1 rounded-md transition-all hover:opacity-80"
                      style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-sidebar)' }}
                      onClick={() => {
                        editor.chain().focus().unsetColor().run();
                        setShowColorPicker(false);
                      }}
                    >
                      Remove color
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1" />
              <button
                onClick={toggleMode}
                className="px-2 py-1 rounded text-xs font-mono transition-all hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                title="Switch to Markdown"
              >
                MD
              </button>
            </div>
          )}

          {/* Editor body */}
          {editorMode === 'rich' ? (
            <div className="relative">
              <EditorContent editor={editor} />
              {/* Slash command menu */}
              {showSlashMenu && slashPos && filteredSlashCommands.length > 0 && (
                <div
                  className="slash-menu"
                  style={{ top: slashPos.top, left: slashPos.left }}
                >
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

      {/* Footer — word count shown only on hover */}
      <div
        className="px-6 py-1.5 text-xs transition-opacity"
        style={{
          color: 'var(--text-muted)',
          opacity: hoveringFooter ? 1 : 0,
        }}
        onMouseEnter={() => setHoveringFooter(true)}
        onMouseLeave={() => setHoveringFooter(false)}
      >
        {wordCount} words &middot; {charCount} characters
      </div>
    </div>
  );
}

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  return (
    <div className="relative">
      <div className="flex items-center justify-end mb-2 gap-2">
        <button
          onClick={handleCopyMarkdown}
          className="px-3 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
          style={{
            backgroundColor: copied ? '#22c55e' : 'transparent',
            color: copied ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          title="Copy raw Markdown to clipboard"
        >
          {copied ? 'Copied!' : 'Copy Markdown'}
        </button>
        <button
          onClick={onToggleMode}
          className="px-2 py-1 rounded text-xs font-mono transition-all hover:opacity-80"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          title="Switch to Rich Text"
        >
          WYSIWYG
        </button>
      </div>
      <textarea
        value={content}
        onChange={onContentChange}
        className="w-full min-h-[60vh] bg-transparent outline-none resize-none font-mono"
        style={{ color: 'var(--text-primary)', fontSize, lineHeight: '1.8' }}
        placeholder="Write in Markdown..."
        readOnly
      />
    </div>
  );
}

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
  return <div style={{ width: 1, height: 20, margin: '0 4px', backgroundColor: 'var(--border)' }} />;
}

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
    if (line.trim() === '') {
      result.push('');
    } else if (/^<[a-z]/.test(line.trim())) {
      result.push(line);
    } else {
      result.push(`<p>${line}</p>`);
    }
  }
  return result.join('\n');
}

function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u>(.*?)<\/u>/gi, '$1');
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  md = md.replace(/<blockquote[^>]*><p>(.*?)<\/p><\/blockquote>/gi, '> $1\n');
  md = md.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1```\n');
  md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<hr\s*\/?>/gi, '---\n');
  md = md.replace(/<li[^>]*data-checked="true"[^>]*><p>(.*?)<\/p><\/li>/gi, '- [x] $1');
  md = md.replace(/<li[^>]*data-checked="false"[^>]*><p>(.*?)<\/p><\/li>/gi, '- [ ] $1');
  md = md.replace(/<li[^>]*><p>(.*?)<\/p><\/li>/gi, '- $1');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1');
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
  md = md.replace(/<\/?[^>]+(>|$)/g, '');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
