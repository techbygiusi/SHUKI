import React from 'react';
import { useStore } from '../store/useStore';

interface Props {
  onNewNote: () => void;
  onDeleteNote: (id: string) => void;
}

export default function Sidebar({ onNewNote, onDeleteNote }: Props) {
  const { notes, activeNoteId, setActiveNoteId, searchQuery, setSearchQuery, setShowSettings, serverStatus } = useStore();

  const filteredNotes = useStore((s) => s.getFilteredNotes());

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

  function getExcerpt(content: string, maxLen = 80): string {
    const plain = content.replace(/[#*_~`>\[\]()!|-]/g, '').trim();
    return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
  }

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: 280,
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ backgroundColor: '#F5C842' }}>
          &#9998;
        </div>
        <span className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
          SHUKI
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: serverStatus.connected ? '#22c55e' : '#ef4444',
            }}
            title={serverStatus.connected ? 'Server connected' : 'Offline'}
          />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes..."
          className="w-full px-3 py-2 rounded-btn text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      {/* New Note */}
      <div className="px-3 mb-2">
        <button
          onClick={onNewNote}
          className="w-full py-2 rounded-btn text-sm font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: '#F5C842', color: '#1A1A1A' }}
        >
          + New Note
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            onClick={() => setActiveNoteId(note.id)}
            className="group p-3 mb-1 rounded-xl cursor-pointer transition-all"
            style={{
              backgroundColor: note.id === activeNoteId ? 'var(--bg-card)' : 'transparent',
              boxShadow: note.id === activeNoteId ? 'var(--shadow)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (note.id !== activeNoteId) e.currentTarget.style.backgroundColor = 'var(--bg-card)';
            }}
            onMouseLeave={(e) => {
              if (note.id !== activeNoteId) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {note.title || 'Untitled'}
                  </h3>
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: note.synced ? '#22c55e' : '#f59e0b',
                    }}
                    title={note.synced ? 'Synced' : 'Pending sync'}
                  />
                </div>
                <p
                  className="text-xs mt-0.5 line-clamp-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {getExcerpt(note.content)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                  {formatDate(note.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote(note.id);
                }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-xs px-1.5 py-0.5 rounded transition-all"
                style={{ color: 'var(--text-secondary)' }}
                title="Delete note"
              >
                &#10005;
              </button>
            </div>
          </div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setShowSettings(true)}
          className="w-full py-2 rounded-btn text-sm transition-all hover:opacity-80 flex items-center justify-center gap-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>&#9881;</span> Settings
        </button>
      </div>
    </aside>
  );
}
