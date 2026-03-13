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
    if (noteId) onMoveNote(noteId, folderId);
    setDragOverFolderId(null);
  }, [onMoveNote]);

  const handleDragLeave = useCallback(() => setDragOverFolderId(null), []);

  const unfolderedNotes = filteredNotes.filter((n) => !n.folderId);
  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);

  const { syncMessage } = useStore();

  const syncLabel =
    syncState === 'synced'       ? (serverStatus.lastSync ? `Synced` : 'Synced')
    : syncState === 'syncing'    ? (syncMessage || 'Syncing\u2026')
    : syncState === 'connecting' ? 'Connecting\u2026'
    : syncState === 'pending'    ? `${pendingChanges} changes pending`
    : syncState === 'auth_error' ? 'Auth error \u2014 tap to fix'
    : syncState === 'error'      ? 'Sync error \u2014 tap to retry'
    : syncState === 'offline'    ? 'Offline \u2014 changes saved locally'
    : 'Disconnected';

  const syncDotColor =
    syncState === 'synced'       ? '#6EE7A0'
    : syncState === 'syncing'    ? '#60A5FA'
    : syncState === 'connecting' ? '#60A5FA'
    : syncState === 'pending'    ? '#FCD34D'
    : syncState === 'auth_error' ? '#F87171'
    : syncState === 'error'      ? '#FB923C'
    : '#9CA3AF';

  return (
    <aside
      className="flex flex-col h-full select-none"
      style={{
        width: 240,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Wordmark ── */}
      <div
        style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '1.15rem',
          letterSpacing: '0.06em',
          color: 'var(--text-primary)',
        }}>
          SH<span style={{ color: 'var(--accent)' }}>U</span>KI
        </span>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: '12px 12px 4px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'var(--bg-hover)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 10px',
        }}>
          {/* Search icon */}
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── New Note / New Folder ── */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px 10px' }}>
        <ActionButton onClick={onNewNote} icon="✦">New note</ActionButton>
        <ActionButton
          onClick={() => {
            const newId = onNewFolder();
            if (newId) setTimeout(() => startRename(newId, 'New Folder'), 50);
          }}
          icon="⊞"
        >
          Folder
        </ActionButton>
      </div>

      {/* ── Section label ── */}
      <SectionLabel>Notes</SectionLabel>

      {/* ── Note tree ── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 8px 8px' }}>

        {/* All Notes */}
        <NavRow
          isActive={activeFolderId === null}
          isDragTarget={dragOverFolderId === null}
          onClick={() => setActiveFolderId(null)}
          onDragOver={(e) => handleDragOver(e, null)}
          onDrop={(e) => handleDrop(e, null)}
          onDragLeave={handleDragLeave}
        >
          <span style={{ fontSize: '0.82rem', color: activeFolderId === null ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeFolderId === null ? 500 : 400 }}>
            All Notes
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{notes.length}</span>
        </NavRow>

        {/* Folders */}
        {sortedFolders.map((folder) => {
          const isCollapsed = collapsedFolders.has(folder.id);
          const folderNotes = filteredNotes.filter((n) => n.folderId === folder.id);
          const isActive = activeFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div key={folder.id}>
              <NavRow
                isActive={isActive}
                isDragTarget={isDragOver}
                onClick={() => {
                  if (activeFolderId === folder.id) toggleCollapse(folder.id);
                  else {
                    setActiveFolderId(folder.id);
                    setCollapsedFolders((prev) => { const n = new Set(prev); n.delete(folder.id); return n; });
                  }
                }}
                onDoubleClick={(e) => { e.stopPropagation(); startRename(folder.id, folder.name); }}
                onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragLeave={handleDragLeave}
              >
                {/* Chevron */}
                <svg width="9" height="9" viewBox="0 0 10 10" style={{
                  color: 'var(--text-muted)',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}>
                  <path d="M2 3 L5 6 L8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {renamingFolderId === folder.id ? (
                  <input
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: '0.82rem',
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
                  <>
                    <span style={{
                      flex: 1,
                      fontSize: '0.82rem',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 500 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {folder.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{folderNotes.length}</span>
                  </>
                )}
              </NavRow>

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
            padding: '36px 16px',
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 8, opacity: 0.5 }}>✦</div>
            <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </div>
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
            const f = folders.find((fo) => fo.id === id);
            if (f) startRename(id, f.name);
          }}
          onMoveNote={onMoveNote}
          onDuplicateNote={(id) => { onDuplicateNote(id); setContextMenu(null); }}
        />
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 12px' }}>
        {/* Sync row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            cursor: (syncState === 'auth_error' || syncState === 'error') ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (syncState === 'auth_error') {
              useStore.getState().setShowSettings(true);
              useStore.getState().setSettingsTab('server');
            } else if (syncState === 'error' || syncState === 'offline') {
              // Trigger a reconnect attempt via a custom event
              window.dispatchEvent(new CustomEvent('shuki:retry-sync'));
            }
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: syncDotColor,
            flexShrink: 0,
            boxShadow: `0 0 0 2px ${syncDotColor}33`,
          }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {syncLabel}
          </span>
        </div>

        {/* Settings / Gallery */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FooterLink onClick={() => setShowSettings(true)}>Settings</FooterLink>
          <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
          <FooterLink onClick={() => setShowGallery(true)}>Gallery</FooterLink>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────
   Small reusable primitives
───────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '2px 16px 6px',
      fontSize: '0.6rem',
      fontWeight: 500,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
    }}>
      {children}
    </div>
  );
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '6px 8px',
        borderRadius: 7,
        border: '1px solid var(--border)',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        color: hovered ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: '0.76rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{icon}</span>
      {children}
    </button>
  );
}

function NavRow({
  isActive, isDragTarget, children, onClick, onDoubleClick, onContextMenu,
  onDragOver, onDrop, onDragLeave,
}: {
  isActive: boolean;
  isDragTarget?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        marginBottom: 1,
        backgroundColor: isDragTarget
          ? 'rgba(193,127,58,0.10)'
          : isActive
          ? 'var(--bg-active)'
          : hovered
          ? 'var(--bg-hover)'
          : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </div>
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
  const [hovered, setHovered] = useState(false);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: indented ? '5px 10px 5px 28px' : '5px 10px',
        borderRadius: 7,
        cursor: 'pointer',
        marginBottom: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        backgroundColor: isActive ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Tiny decorative dot */}
      <span style={{
        width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
        backgroundColor: isActive ? 'var(--accent)' : 'var(--border)',
      }} />
      <span style={{
        fontSize: '0.82rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 500 : 400,
      }}>
        {note.title || 'Untitled'}
      </span>
    </div>
  );
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '0.75rem',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-ui)',
        transition: 'color 0.12s',
      }}
    >
      {children}
    </button>
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
          borderRadius: 10,
          padding: '5px',
          minWidth: 168,
        }}
      >
        {menu.type === 'folder' ? (
          <>
            <CtxItem onClick={() => onRenameFolder(menu.targetId)}>Rename</CtxItem>
            <CtxDivider />
            <CtxItem onClick={() => onDeleteFolder(menu.targetId)} danger>Delete folder</CtxItem>
          </>
        ) : (
          <>
            <CtxItem onClick={() => setShowMoveMenu(!showMoveMenu)}>
              <span>Move to folder</span>
              <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: '0.7rem' }}>▸</span>
            </CtxItem>
            {showMoveMenu && (
              <div style={{
                margin: '2px 4px',
                background: 'var(--bg-hover)',
                borderRadius: 7,
                padding: '3px',
              }}>
                <CtxItem onClick={() => { onMoveNote(menu.targetId, null); onClose(); }}>No folder</CtxItem>
                {folders.map((f) => (
                  <CtxItem key={f.id} onClick={() => { onMoveNote(menu.targetId, f.id); onClose(); }}>
                    {f.name}
                  </CtxItem>
                ))}
              </div>
            )}
            <CtxItem onClick={() => onDuplicateNote(menu.targetId)}>Duplicate</CtxItem>
            <CtxDivider />
            <CtxItem onClick={() => { onDeleteNote(menu.targetId); onClose(); }} danger>Delete note</CtxItem>
          </>
        )}
      </div>
    </>
  );
}

function CtxItem({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: '0.82rem',
        color: danger ? '#E57373' : 'var(--text-primary)',
        background: hovered ? 'var(--bg-hover)' : 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function CtxDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '3px 6px' }} />;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
