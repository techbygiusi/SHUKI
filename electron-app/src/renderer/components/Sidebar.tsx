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

  const unfolderedNotes = filteredNotes.filter((n) => !n.folderId);
  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);

  // Sync status
  const syncDotColor =
    syncState === 'synced' ? '#22c55e'
    : syncState === 'syncing' ? '#f59e0b'
    : syncState === 'pending' ? '#f97316'
    : syncState === 'auth_error' ? '#ef4444'
    : '#ef4444';

  const syncEmoji =
    syncState === 'synced' ? '\uD83D\uDFE2'
    : syncState === 'syncing' ? '\uD83D\uDFE1'
    : syncState === 'pending' ? '\uD83D\uDFE0'
    : '\uD83D\uDD34';

  const syncLabel =
    syncState === 'synced' ? (serverStatus.lastSync ? `Last synced ${formatTimeAgo(serverStatus.lastSync)}` : 'Synced')
    : syncState === 'syncing' ? 'Syncing...'
    : syncState === 'pending' ? `Pending (${pendingChanges} changes)`
    : syncState === 'auth_error' ? 'Auth Error \u2014 tap to fix'
    : 'Offline';

  return (
    <aside
      className="flex flex-col h-full select-none"
      style={{
        width: 240,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* SHUKI wordmark */}
      <div className="px-4 pt-4 pb-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span
          className="font-display text-base font-semibold tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          SHUKI
        </span>
      </div>

      {/* Search + New folder button */}
      <div className="px-3 mb-1 flex items-center gap-1">
        <div className="flex-1 relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          />
        </div>
        <button
          onClick={() => {
            const newId = onNewFolder();
            if (newId) {
              setTimeout(() => startRename(newId, 'New Folder'), 50);
            }
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-sm transition-all hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          title="New Folder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
      </div>

      {/* + New page button */}
      <div className="px-3 mb-2">
        <button
          onClick={onNewNote}
          className="w-full text-left px-2 py-1 text-sm transition-all hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          + New page
        </button>
      </div>

      {/* Folder tree + Notes */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* All Notes */}
        <button
          onClick={() => setActiveFolderId(null)}
          className="w-full text-left px-2 py-1 rounded-md text-sm transition-all mb-0.5"
          style={{
            backgroundColor: activeFolderId === null ? 'var(--accent-soft)' : 'transparent',
            color: 'var(--text)',
          }}
          onDragOver={(e) => handleDragOver(e, null)}
          onDrop={(e) => handleDrop(e, null)}
          onDragLeave={handleDragLeave}
        >
          All Notes
        </button>

        {/* Folders */}
        {sortedFolders.map((folder) => {
          const isCollapsed = collapsedFolders.has(folder.id);
          const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
          const isActive = activeFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div key={folder.id}>
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-all group mb-0.5"
                style={{
                  backgroundColor: isDragOver ? 'var(--accent-soft)' : isActive ? 'var(--accent-soft)' : 'transparent',
                }}
                onClick={() => {
                  if (activeFolderId === folder.id) {
                    toggleCollapse(folder.id);
                  } else {
                    setActiveFolderId(folder.id);
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
                    color: 'var(--text-muted)',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <path d="M2 3 L5 6 L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {renamingFolderId === folder.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm bg-transparent outline-none px-1"
                    style={{ color: 'var(--text)', border: '1px solid var(--accent)', borderRadius: 4 }}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingFolderId(null); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }}>
                    {folder.name}
                  </span>
                )}
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
          <div className="text-center py-8 text-sm italic" style={{ color: 'var(--text-muted)' }}>
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

      {/* Bottom: Settings + Sync status */}
      <div className="px-3 py-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className={`flex items-center gap-2 text-xs ${syncState === 'auth_error' ? 'cursor-pointer hover:opacity-80' : ''}`}
          style={{ color: 'var(--text-muted)' }}
          onClick={() => {
            if (syncState === 'auth_error') {
              useStore.getState().setShowSettings(true);
              useStore.getState().setSettingsTab('server');
            }
          }}
        >
          <span>{syncEmoji}</span>
          <span className="truncate">
            {syncState === 'auth_error' ? '\uD83D\uDD11 ' : ''}
            {syncLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Settings
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>&middot;</span>
          <button
            onClick={() => setShowGallery(true)}
            className="text-xs transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Gallery
          </button>
        </div>
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
      className="px-2 py-1 mb-0.5 rounded-md cursor-pointer transition-all"
      style={{
        marginLeft: indented ? 16 : 0,
        backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      <span className="text-sm truncate block" style={{ color: 'var(--text)' }}>
        {note.title || 'Untitled'}
      </span>
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
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
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
      style={{ color: danger ? '#ef4444' : 'var(--text)' }}
    >
      {children}
    </button>
  );
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
