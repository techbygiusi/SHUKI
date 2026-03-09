import React, { useState, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Note, Folder } from '../types';

interface Props {
  onNewNote: () => void;
  onNewFolder: () => string;
  onDeleteNote: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onDuplicateNote: (id: string) => void;
}

export default function Sidebar({
  onNewNote, onNewFolder, onDeleteNote, onDeleteFolder, onRenameFolder, onMoveNote, onDuplicateNote,
}: Props) {
  const {
    notes, folders, activeNoteId, setActiveNoteId, activeFolderId, setActiveFolderId,
    searchQuery, setSearchQuery, setShowSettings, setShowGallery,
    serverStatus, syncState, pendingChanges, contextMenu, setContextMenu,
  } = useStore();

  const filteredNotes = useMemo(() => {
    let filtered = notes;
    if (activeFolderId) {
      filtered = filtered.filter((n) => n.folderId === activeFolderId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [notes, activeFolderId, searchQuery]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', targetId: id });
  }, [setContextMenu]);

  const handleNoteContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'note', targetId: id });
  }, [setContextMenu]);

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingFolderId(id);
    setRenameValue(currentName);
    setContextMenu(null);
  }, [setContextMenu]);

  const commitRename = useCallback(() => {
    if (renamingFolderId && renameValue.trim()) {
      onRenameFolder(renamingFolderId, renameValue.trim());
    }
    setRenamingFolderId(null);
  }, [renamingFolderId, renameValue, onRenameFolder]);

  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('text/plain');
    if (noteId) {
      onMoveNote(noteId, folderId);
    }
    setDragOverFolderId(null);
  }, [onMoveNote]);

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  // Notes not in any folder
  const unfolderedNotes = filteredNotes.filter((n) => !n.folderId);
  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);

  const syncDotColor =
    syncState === 'synced' ? '#22c55e'
    : syncState === 'syncing' ? '#f59e0b'
    : syncState === 'pending' ? '#f97316'
    : syncState === 'auth_error' ? '#ef4444'
    : '#ef4444';

  const syncLabel =
    syncState === 'synced' ? (serverStatus.lastSync ? `Last synced ${formatTimeAgo(serverStatus.lastSync)}` : 'Synced')
    : syncState === 'syncing' ? 'Syncing...'
    : syncState === 'pending' ? `Pending (${pendingChanges} changes)`
    : syncState === 'auth_error' ? 'Invalid API Key \u2014 tap to fix'
    : 'Offline';

  return (
    <aside
      className="flex flex-col h-full border-r select-none"
      style={{
        width: 260,
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, #D4943F 0%, #C17F3A 50%, #A86B2E 100%)',
            color: '#fff',
            boxShadow: '0 2px 6px rgba(193,127,58,0.35)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '16px',
            letterSpacing: '-0.5px',
          }}>
          S
        </div>
        <span className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
          SHUKI
        </span>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      {/* Action buttons */}
      <div className="px-3 mb-2 flex gap-2">
        <button
          onClick={onNewNote}
          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
        >
          + Note
        </button>
        <button
          onClick={() => {
            const newId = onNewFolder();
            if (newId) {
              setTimeout(() => startRename(newId, 'New Folder'), 50);
            }
          }}
          className="py-2 px-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          title="New Folder"
        >
          +{'\u{1F4C1}'}
        </button>
        <button
          onClick={() => setShowGallery(true)}
          className="py-2 px-3 rounded-xl text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          title="Image Gallery"
        >
          {'\u{1F5BC}'}
        </button>
      </div>

      {/* "All Notes" view */}
      <div className="px-3 mb-1">
        <button
          onClick={() => setActiveFolderId(null)}
          className="w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all"
          style={{
            backgroundColor: activeFolderId === null ? 'var(--accent-soft)' : 'transparent',
            color: 'var(--text-primary)',
            borderLeft: activeFolderId === null ? '3px solid var(--accent-primary)' : '3px solid transparent',
          }}
          onDragOver={(e) => handleDragOver(e, null)}
          onDrop={(e) => handleDrop(e, null)}
          onDragLeave={handleDragLeave}
        >
          All Notes ({notes.length})
        </button>
      </div>

      {/* Folder tree + Notes */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* Folders */}
        {sortedFolders.map((folder) => {
          const isCollapsed = collapsedFolders.has(folder.id);
          const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
          const isActive = activeFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div key={folder.id}>
              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all group"
                style={{
                  backgroundColor: isDragOver ? 'var(--accent-soft)' : isActive ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                }}
                onClick={() => {
                  if (activeFolderId === folder.id) {
                    toggleCollapse(folder.id);
                  } else {
                    setActiveFolderId(folder.id);
                    // Expand folder when selecting it
                    setCollapsedFolders((prev) => {
                      const next = new Set(prev);
                      next.delete(folder.id);
                      return next;
                    });
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(folder.id, folder.name);
                }}
                onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragLeave={handleDragLeave}
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10"
                  style={{
                    color: 'var(--text-secondary)',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <path d="M2 3 L5 6 L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm mr-1">{'\u{1F4C1}'}</span>
                {renamingFolderId === folder.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm bg-transparent outline-none px-1"
                    style={{ color: 'var(--text-primary)', border: '1px solid var(--accent-primary)', borderRadius: 4 }}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingFolderId(null); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {folder.name}
                  </span>
                )}
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {folderNotes.length}
                </span>
              </div>

              {/* Notes inside folder */}
              {!isCollapsed && folderNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  indented
                  onSelect={() => setActiveNoteId(note.id)}
                  onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
                  onDragStart={(e) => handleDragStart(e, note.id)}
                />
              ))}
            </div>
          );
        })}

        {/* Unfoldered notes */}
        {unfolderedNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            isActive={note.id === activeNoteId}
            indented={false}
            onSelect={() => setActiveNoteId(note.id)}
            onContextMenu={(e) => handleNoteContextMenu(e, note.id)}
            onDragStart={(e) => handleDragStart(e, note.id)}
          />
        ))}

        {filteredNotes.length === 0 && (
          <div className="text-center py-8 text-sm font-display italic" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenuPopup
          menu={contextMenu}
          folders={folders}
          notes={notes}
          onClose={() => setContextMenu(null)}
          onDeleteNote={onDeleteNote}
          onDeleteFolder={(id) => { onDeleteFolder(id); setContextMenu(null); }}
          onRenameFolder={(id) => {
            const f = folders.find(fo => fo.id === id);
            if (f) startRename(id, f.name);
          }}
          onMoveNote={onMoveNote}
          onDuplicateNote={(id) => { onDuplicateNote(id); setContextMenu(null); }}
        />
      )}

      {/* Sync status + Settings */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div
          className={`flex items-center gap-2 text-xs ${syncState === 'auth_error' ? 'cursor-pointer hover:opacity-80' : ''}`}
          style={{ color: syncState === 'auth_error' ? '#ef4444' : 'var(--text-secondary)' }}
          onClick={() => {
            if (syncState === 'auth_error') {
              setShowSettings(true);
              useStore.getState().setSettingsTab('server');
            }
          }}
        >
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: syncDotColor }} />
          <span className="truncate">{syncState === 'auth_error' ? '\uD83D\uDD11 ' : ''}{syncLabel}</span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-full py-2 rounded-xl text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {'\u2699'} Settings
        </button>
      </div>
    </aside>
  );
}

function NoteRow({ note, isActive, indented, onSelect, onContextMenu, onDragStart }: {
  note: Note;
  isActive: boolean;
  indented: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className="group p-2 mb-0.5 rounded-lg cursor-pointer transition-all"
      style={{
        marginLeft: indented ? 16 : 0,
        backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
        boxShadow: isActive ? 'var(--shadow)' : 'none',
      }}
    >
      <div className="flex items-center gap-2">
        {note.tags.length > 0 && (
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent-purple)' }} />
        )}
        <h3 className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
          {note.title || 'Untitled'}
        </h3>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: note.synced ? '#22c55e' : '#f59e0b' }} />
      </div>
      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
        {getExcerpt(note.content)}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
        {formatDate(note.updatedAt)}
      </p>
    </div>
  );
}

function ContextMenuPopup({ menu, folders, notes, onClose, onDeleteNote, onDeleteFolder, onRenameFolder, onMoveNote, onDuplicateNote }: {
  menu: { x: number; y: number; type: 'note' | 'folder'; targetId: string };
  folders: Folder[];
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onDuplicateNote: (id: string) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 py-1 rounded-lg shadow-lg min-w-[160px]"
        style={{
          left: menu.x,
          top: menu.y,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {menu.type === 'folder' ? (
          <>
            <CtxItem onClick={() => onRenameFolder(menu.targetId)}>Rename</CtxItem>
            <CtxItem onClick={() => onDeleteFolder(menu.targetId)} danger>Delete</CtxItem>
          </>
        ) : (
          <>
            <CtxItem onClick={() => setShowMoveMenu(!showMoveMenu)}>Move to Folder</CtxItem>
            {showMoveMenu && (
              <div className="pl-2">
                <CtxItem onClick={() => { onMoveNote(menu.targetId, null); onClose(); }}>No Folder</CtxItem>
                {folders.map((f) => (
                  <CtxItem key={f.id} onClick={() => { onMoveNote(menu.targetId, f.id); onClose(); }}>
                    {f.name}
                  </CtxItem>
                ))}
              </div>
            )}
            <CtxItem onClick={() => onDuplicateNote(menu.targetId)}>Duplicate</CtxItem>
            <CtxItem onClick={() => { onDeleteNote(menu.targetId); onClose(); }} danger>Delete</CtxItem>
          </>
        )}
      </div>
    </>
  );
}

function CtxItem({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80 transition-all"
      style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getExcerpt(content: string, maxLen = 60): string {
  const plain = content.replace(/[#*_~`>\[\]()!|-]/g, '').trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
}
