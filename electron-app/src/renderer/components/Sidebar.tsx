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
  const syncLabel =
    syncState === 'synced' ? (serverStatus.lastSync ? `Last synced ${formatTimeAgo(serverStatus.lastSync)}` : 'Synced')
    : syncState === 'syncing' ? 'Syncing...'
    : syncState === 'pending' ? `Pending (${pendingChanges} changes)`
    : syncState === 'auth_error' ? 'Auth Error'
    : 'Offline';

  const syncDotColor =
    syncState === 'synced' ? '#22c55e'
    : syncState === 'syncing' ? '#f59e0b'
    : syncState === 'pending' ? '#f97316'
    : '#ef4444';

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
      <div style={{ padding: '20px 16px 12px', WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--accent)',
          }}
        >
          SHUKI
        </span>
      </div>

      {/* Search input */}
      <div style={{ margin: '0 12px 8px' }}>
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '0.875rem',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        />
      </div>

      {/* Buttons row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px', marginBottom: 8 }}>
        <button
          onClick={onNewNote}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'var(--font-ui)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          + New Note
        </button>
        <button
          onClick={() => {
            const newId = onNewFolder();
            if (newId) {
              setTimeout(() => startRename(newId, 'New Folder'), 50);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'var(--font-ui)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          + Folder
        </button>
      </div>

      {/* Folder tree + Notes */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 8px' }}>
        {/* All Notes */}
        <button
          onClick={() => setActiveFolderId(null)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '4px 16px',
            borderRadius: 6,
            fontSize: '0.875rem',
            backgroundColor: activeFolderId === null ? 'var(--bg-active)' : 'transparent',
            color: activeFolderId === null ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: activeFolderId === null ? 500 : 400,
            border: 'none',
            cursor: 'pointer',
            marginBottom: 2,
            fontFamily: 'var(--font-ui)',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  marginBottom: 2,
                  backgroundColor: isDragOver ? 'var(--bg-hover)' : isActive ? 'var(--bg-hover)' : 'transparent',
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
                    style={{
                      flex: 1,
                      fontSize: '0.875rem',
                      background: 'transparent',
                      outline: 'none',
                      padding: '0 4px',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--accent)',
                      borderRadius: 4,
                      fontFamily: 'var(--font-ui)',
                    }}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingFolderId(null); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={{
                    flex: 1,
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
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
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            fontSize: '0.875rem',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
          }}>
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

      {/* Bottom: Sync status + Settings */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            padding: '12px 16px 4px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: syncState === 'auth_error' ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (syncState === 'auth_error') {
              useStore.getState().setShowSettings(true);
              useStore.getState().setSettingsTab('server');
            }
          }}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: syncDotColor,
            flexShrink: 0,
          }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {syncLabel}
          </span>
        </div>
        <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-ui)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Settings
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>&middot;</span>
          <button
            onClick={() => setShowGallery(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-ui)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
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
      style={{
        padding: indented ? '6px 16px 6px 32px' : '6px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        marginBottom: 2,
        backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{
        fontSize: '0.875rem',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: isActive ? 'var(--accent)' : 'var(--text-primary)',
        fontWeight: isActive ? 500 : 400,
      }}>
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
        className="fixed z-50"
        style={{
          left: menu.x,
          top: menu.y,
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 8,
          padding: '4px 0',
          minWidth: 160,
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
              <div style={{ paddingLeft: 8 }}>
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
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '6px 12px',
        fontSize: '0.875rem',
        color: danger ? '#EF4444' : 'var(--text-primary)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
