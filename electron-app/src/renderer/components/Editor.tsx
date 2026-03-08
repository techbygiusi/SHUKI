import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useStore } from '../store/useStore';
import { Note, Folder } from '../types';

const lowlight = createLowlight(common);

interface Props {
  note: Note;
  onChange: (id: string, updates: Partial<Note>) => void;
  folders: Folder[];
}

export default function Editor({ note, onChange, folders }: Props) {
  const { editorMode, setEditorMode, settings, serverStatus, syncState } = useStore();

  const folder = useMemo(() => {
    if (!note.folderId) return null;
    return folders.find((f) => f.id === note.folderId) || null;
  }, [note.folderId, folders]);

  const wordCount = useMemo(() => {
    const words = note.content.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [note.content]);

  const charCount = note.content.length;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: note.content ? markdownToHtml(note.content) : '',
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
    },
    onUpdate: ({ editor: ed }) => {
      if (editorMode === 'rich') {
        const md = htmlToMarkdown(ed.getHTML());
        onChange(note.id, { content: md });
      }
    },
  }, [note.id]);

  // Update editor content when switching notes
  useEffect(() => {
    if (editor && editorMode === 'rich') {
      const currentHtml = editor.getHTML();
      const noteHtml = markdownToHtml(note.content);
      if (currentHtml !== noteHtml) {
        editor.commands.setContent(noteHtml, { emitUpdate: false });
      }
    }
  }, [note.id, editorMode]);

  async function handleImageFiles(files: File[]) {
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop() || 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      if (window.electronAPI) {
        const savedPath = await window.electronAPI.images.save(arrayBuffer, filename);
        const imgMd = `![${file.name}](shuki://${encodeURIComponent(savedPath)})\n`;
        onChange(note.id, { content: note.content + imgMd });
        if (editor && editorMode === 'rich') {
          editor.chain().focus().setImage({ src: `shuki://${encodeURIComponent(savedPath)}`, alt: file.name }).run();
        }
      } else {
        const base64 = await fileToBase64(file);
        const imgMd = `![${file.name}](${base64})\n`;
        onChange(note.id, { content: note.content + imgMd });
      }
    }
  }

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
      editor.commands.setContent(markdownToHtml(note.content), { emitUpdate: false });
    }
  }, [editorMode, setEditorMode, editor, note.content]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const syncDot = note.synced
    ? '#22c55e'
    : serverStatus.connected
    ? '#f59e0b'
    : '#ef4444';

  const syncLabel = note.synced
    ? 'Saved & synced'
    : syncState === 'syncing'
    ? 'Syncing...'
    : syncState === 'pending'
    ? 'Pending sync'
    : 'Offline — saved locally';

  return (
    <div className="flex flex-col h-full fade-in">
      {/* Breadcrumb */}
      {folder && (
        <div className="px-6 pt-2 text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          <span>{folder.name}</span>
          <span>/</span>
        </div>
      )}

      {/* Title */}
      <div className="px-6 pt-3 pb-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <input
          type="text"
          value={note.title}
          onChange={handleTitleChange}
          className="w-full text-2xl font-display font-bold bg-transparent outline-none border-b border-transparent focus:border-current"
          style={{ color: 'var(--text-primary)', borderColor: 'transparent', lineHeight: '1.4' }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--border)')}
          onBlur={(e) => (e.target.style.borderColor = 'transparent')}
          placeholder="Note title..."
        />
      </div>

      {/* Toolbar */}
      {editorMode === 'rich' && editor && (
        <div
          className="flex items-center gap-0.5 px-4 py-1 border-b overflow-x-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}
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
          <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">&#8226;</ToolBtn>
          <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1.</ToolBtn>
          <ToolBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list">&#9745;</ToolBtn>
          <Sep />
          <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">&#8220;</ToolBtn>
          <ToolBtn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">&lt;/&gt;</ToolBtn>
          <ToolBtn active={false} onClick={insertLink} title="Insert link">&#128279;</ToolBtn>
          <ToolBtn active={false} onClick={insertImage} title="Insert image">&#128247;</ToolBtn>
          <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">&#8213;</ToolBtn>
          <div className="flex-1" />
          <button
            onClick={toggleMode}
            className="px-2 py-1 rounded text-xs font-mono transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            title="Switch to Markdown"
          >
            MD
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4" style={{ fontSize: settings.fontSize, lineHeight: '1.8' }}>
          {editorMode === 'rich' ? (
            <EditorContent editor={editor} />
          ) : (
            <MarkdownView
              note={note}
              onContentChange={handleMarkdownChange}
              onToggleMode={toggleMode}
              fontSize={settings.fontSize}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-6 py-2 text-xs border-t"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: syncDot }} />
          <span>{syncLabel}</span>
        </div>
      </div>
    </div>
  );
}

function MarkdownView({ note, onContentChange, onToggleMode, fontSize }: {
  note: Note;
  onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onToggleMode: () => void;
  fontSize: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = note.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [note.content]);

  return (
    <div className="relative">
      <div className="flex items-center justify-end mb-2 gap-2">
        <button
          onClick={handleCopyMarkdown}
          className="px-3 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
          style={{
            backgroundColor: copied ? '#22c55e' : 'var(--bg-card)',
            color: copied ? '#fff' : 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
          title="Copy raw Markdown to clipboard"
        >
          {copied ? 'Copied!' : 'Copy Markdown'}
        </button>
        <button
          onClick={onToggleMode}
          className="px-2 py-1 rounded text-xs font-mono transition-all hover:opacity-80"
          style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
          title="Switch to Rich Text"
        >
          WYSIWYG
        </button>
      </div>
      <textarea
        value={note.content}
        onChange={onContentChange}
        className="w-full min-h-[60vh] bg-transparent outline-none resize-none font-mono"
        style={{ color: 'var(--text-primary)', fontSize, lineHeight: '1.8' }}
        placeholder="Write in Markdown..."
      />
    </div>
  );
}

function ToolBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border)' }} />;
}

function markdownToHtml(md: string): string {
  let html = md;
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold/Italic/Underline/Strike
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Task lists
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');
  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<ul><li><p>$1</p></li></ul>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<ol><li><p>$1</p></li></ol>');
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr />');
  // Paragraphs (lines that are not already wrapped)
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
  // Remove wrapping tags
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
  // Task items
  md = md.replace(/<li[^>]*data-checked="true"[^>]*><p>(.*?)<\/p><\/li>/gi, '- [x] $1');
  md = md.replace(/<li[^>]*data-checked="false"[^>]*><p>(.*?)<\/p><\/li>/gi, '- [ ] $1');
  // List items
  md = md.replace(/<li[^>]*><p>(.*?)<\/p><\/li>/gi, '- $1');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n');
  // Clean up remaining tags
  md = md.replace(/<\/?[^>]+(>|$)/g, '');
  // Clean up entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&nbsp;/g, ' ');
  // Clean up extra newlines
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
