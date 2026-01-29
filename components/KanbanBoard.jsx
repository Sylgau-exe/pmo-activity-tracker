'use client';

import React, { useState, useEffect, useCallback } from 'react';

const DEFAULT_COLUMNS = [
  { id: 'backlog', title: 'Backlog', wipLimit: null },
  { id: 'ready', title: 'Ready', wipLimit: 5 },
  { id: 'in-progress', title: 'In Progress', wipLimit: 3 },
  { id: 'review', title: 'Review/Test', wipLimit: 2 },
  { id: 'done', title: 'Done', wipLimit: null },
  { id: 'parked', title: 'Parked', wipLimit: null },
];

const PROJECT_TAGS = {
  'pmo-eco': { label: 'PMO Ecosystem', color: '#3b82f6', emoji: '🎯' },
  'consulting': { label: 'Consulting', color: '#22c55e', emoji: '💼' },
  'tools': { label: 'Tools', color: '#f97316', emoji: '📊' },
  'speaking': { label: 'Speaking', color: '#a855f7', emoji: '🚢' },
};

const PROJECTS = {
  'pmo-eco': ['BizSimHub', 'ProjectManagerTool', 'PMO Advisor', 'Education Hub', 'PMO Ecosystem Hub'],
  'consulting': ['BL Camions', 'Capacity Planner'],
  'tools': ['Financial Dashboard', 'Invoice Tracker', 'Activity Tracker'],
  'speaking': ['Cruise Content', 'Presentations', 'Destination Talks'],
};

const EFFORT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const IMPACT_LEVELS = ['Low', 'Medium', 'High'];

// ARGUS Personality - Insights and nudges
const ARGUS_INSIGHTS = {
  stale: [
    "I've spotted {count} tasks gathering dust. Shall we revisit them?",
    "{count} items haven't moved in over 14 days. Time for a check-in?",
    "My eyes see {count} stale tasks. Let's not forget these.",
  ],
  blocked: [
    "{count} tasks are blocked. Every blocker is a decision waiting to be made.",
    "I'm watching {count} blocked items. Need help clearing the path?",
  ],
  wipExceeded: [
    "WIP limits exceeded in {columns}. Focus beats multitasking.",
    "Too much in flight. I recommend finishing before starting.",
  ],
  allClear: [
    "All systems nominal. Your flow looks healthy today.",
    "Nothing urgent on my radar. Steady progress wins.",
    "Clean board, clear mind. Keep the momentum going.",
  ],
  greeting: [
    "Argus online. I see all, forget nothing.",
    "100 eyes, one focus: your success.",
    "Standing watch. Let's review your commitments.",
  ],
  statusReport: [
    "Status report: You have {total} tasks total. {inProgress} are active, {blocked} are blocked, and {stale} need attention. {completed} completed this week.",
  ],
  taskMoved: [
    "Noted. Task moved to {column}.",
    "I see you. {column} it is.",
    "Tracking the change. {column}.",
  ],
  taskCreated: [
    "New task logged. I'm watching it now.",
    "Added to my watchlist.",
    "Recorded. Nothing escapes my gaze.",
  ],
  taskCompleted: [
    "Well done. Another one finished.",
    "Task complete. Progress feels good, doesn't it?",
    "Marked as done. Keep that momentum.",
  ],
};

const getRandomInsight = (category, replacements = {}) => {
  const insights = ARGUS_INSIGHTS[category];
  if (!insights) return '';
  let insight = insights[Math.floor(Math.random() * insights.length)];
  Object.entries(replacements).forEach(([key, value]) => {
    insight = insight.replace(`{${key}}`, value);
  });
  return insight;
};

// Calculate days since date
const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
};

// ARGUS Voice System
const useArgusVoice = () => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Prefer a deep, authoritative voice
        const preferred = availableVoices.find(v => 
          v.name.includes('Daniel') || 
          v.name.includes('Alex') ||
          v.name.includes('Google UK English Male') ||
          v.name.includes('Microsoft David') ||
          v.name.includes('Male')
        ) || availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
        
        setSelectedVoice(preferred);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 0.85;
    utterance.volume = options.volume || 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, selectedVoice]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { voiceEnabled, setVoiceEnabled, isSpeaking, speak, stop, voices, selectedVoice, setSelectedVoice };
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [columns] = useState(DEFAULT_COLUMNS);
  const [draggedTask, setDraggedTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterPortfolio, setFilterPortfolio] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [argusMessage, setArgusMessage] = useState('');
  const [showArgusPanel, setShowArgusPanel] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const { voiceEnabled, setVoiceEnabled, isSpeaking, speak, stop, voices, selectedVoice, setSelectedVoice } = useArgusVoice();

  useEffect(() => { fetchTasks(); fetchArchivedTasks(); }, []);

  useEffect(() => {
    if (tasks.length === 0 && !loading) {
      setArgusMessage(getRandomInsight('greeting'));
      return;
    }
    if (loading) return;

    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const wipExceededCols = columns.filter(col => {
      if (!col.wipLimit) return false;
      return tasks.filter(t => t.status === col.id).length > col.wipLimit;
    });

    let message = '';
    if (staleTasks.length > 0) {
      message = getRandomInsight('stale', { count: staleTasks.length });
    } else if (blockedTasks.length > 0) {
      message = getRandomInsight('blocked', { count: blockedTasks.length });
    } else if (wipExceededCols.length > 0) {
      message = getRandomInsight('wipExceeded', { columns: wipExceededCols.map(c => c.title).join(', ') });
    } else {
      message = getRandomInsight('allClear');
    }
    setArgusMessage(message);
  }, [tasks, columns, loading]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTasks(data.tasks || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchArchivedTasks = async () => {
    try {
      const res = await fetch('/api/tasks?archived=true');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setArchivedTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch archived tasks:', err);
    }
  };

  const giveStatusReport = () => {
    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const completedThisWeek = tasks.filter(t => t.completedDate && daysSince(t.completedDate) <= 7);

    const report = getRandomInsight('statusReport', {
      total: tasks.length,
      inProgress: inProgressTasks.length,
      blocked: blockedTasks.length,
      stale: staleTasks.length,
      completed: completedThisWeek.length,
    });

    setArgusMessage(report);
    speak(report);
  };

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    if (!draggedTask) return;
    
    const now = new Date().toISOString().split('T')[0];
    const updates = { ...draggedTask, status: columnId, lastSessionDate: now };
    
    if (columnId === 'in-progress' && !draggedTask.startDate) updates.startDate = now;
    if (columnId === 'done' && !draggedTask.completedDate) {
      updates.completedDate = now;
      const msg = getRandomInsight('taskCompleted');
      setArgusMessage(msg);
      speak(msg);
    } else {
      const columnName = columns.find(c => c.id === columnId)?.title || columnId;
      const msg = getRandomInsight('taskMoved', { column: columnName });
      setArgusMessage(msg);
      speak(msg);
    }
    
    setTasks(tasks.map(t => t.id === draggedTask.id ? updates : t));
    setDraggedTask(null);
    
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to update task:', err);
      fetchTasks();
    }
  };

  const saveTask = async (taskData) => {
    try {
      if (editingTask) {
        const res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...taskData, id: editingTask.id }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTasks(tasks.map(t => t.id === editingTask.id ? data.task : t));
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTasks([data.task, ...tasks]);
        const msg = getRandomInsight('taskCreated');
        setArgusMessage(msg);
        speak(msg);
      }
      setShowModal(false);
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Failed to save task: ' + err.message);
    }
  };

  const archiveTask = async (taskId) => {
    try {
      await fetch('/api/tasks/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      });
      const task = tasks.find(t => t.id === taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
      setArchivedTasks([{ ...task, archivedAt: new Date().toISOString() }, ...archivedTasks]);
    } catch (err) {
      console.error('Failed to archive task:', err);
    }
  };

  const restoreTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/archive?id=${taskId}`, { method: 'DELETE' });
      const task = archivedTasks.find(t => t.id === taskId);
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
      setTasks([{ ...task, archivedAt: null }, ...tasks]);
    } catch (err) {
      console.error('Failed to restore task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Permanently delete this task?')) return;
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const toggleBlock = async (task) => {
    const updated = { ...task, blocked: !task.blocked };
    setTasks(tasks.map(t => t.id === task.id ? updated : t));
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to toggle block:', err);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterPortfolio !== 'all' && task.portfolio !== filterPortfolio) return false;
    if (filterProject !== 'all' && task.project !== filterProject) return false;
    if (showStaleOnly && daysSince(task.lastSessionDate) < 14) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getColumnTasks = (columnId) => filteredTasks.filter(t => t.status === columnId);
  const isOverWipLimit = (column) => column.wipLimit && getColumnTasks(column.id).length > column.wipLimit;

  const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    blocked: tasks.filter(t => t.blocked).length,
    stale: staleTasks.length,
    completedThisWeek: tasks.filter(t => t.completedDate && daysSince(t.completedDate) <= 7).length,
  };

  if (loading) return (
    <div style={styles.loadingContainer}>
      <div style={styles.argusEyeLoading}>👁</div>
      <p style={styles.loadingText}>ARGUS initializing...</p>
    </div>
  );

  if (error) return (
    <div style={styles.errorContainer}>
      <h2>⚠️ Connection Error</h2>
      <p>{error}</p>
      <button onClick={fetchTasks} style={styles.button}>Retry</button>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoContainer}>
            <div style={{...styles.argusLogo, ...(isSpeaking ? styles.argusLogoSpeaking : {})}}>
              <span style={styles.eyeIcon}>👁</span>
            </div>
            <div>
              <h1 style={styles.title}>ARGUS</h1>
              <p style={styles.subtitle}>Nothing slips through</p>
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statsRow}>
            <div style={styles.stat}><span style={styles.statValue}>{stats.total}</span><span style={styles.statLabel}>Total</span></div>
            <div style={styles.stat}><span style={{...styles.statValue, color: '#3b82f6'}}>{stats.inProgress}</span><span style={styles.statLabel}>Active</span></div>
            <div style={styles.stat}><span style={{...styles.statValue, color: '#ef4444'}}>{stats.blocked}</span><span style={styles.statLabel}>Blocked</span></div>
            <div style={styles.stat}><span style={{...styles.statValue, color: '#f59e0b'}}>{stats.stale}</span><span style={styles.statLabel}>Stale</span></div>
            <div style={styles.stat}><span style={{...styles.statValue, color: '#22c55e'}}>{stats.completedThisWeek}</span><span style={styles.statLabel}>This Week</span></div>
          </div>
        </div>
      </header>

      {showArgusPanel && (
        <div style={styles.argusPanel}>
          <div style={styles.argusPanelContent}>
            <span style={{...styles.argusPanelEye, ...(isSpeaking ? styles.argusPanelEyeSpeaking : {})}}>👁</span>
            <p style={styles.argusPanelMessage}>{argusMessage}</p>
          </div>
          <div style={styles.argusPanelActions}>
            {isSpeaking ? (
              <button onClick={stop} style={styles.voiceButton} title="Stop speaking">🔇</button>
            ) : (
              <button onClick={() => speak(argusMessage)} style={{...styles.voiceButton, opacity: voiceEnabled ? 1 : 0.5}} title={voiceEnabled ? "Speak this message" : "Enable voice first"} disabled={!voiceEnabled}>🔊</button>
            )}
            <button onClick={giveStatusReport} style={styles.reportButton} title="Get status report">📊 Status</button>
            <button onClick={() => setShowVoiceSettings(!showVoiceSettings)} style={{...styles.voiceSettingsButton, backgroundColor: voiceEnabled ? '#7c3aed' : '#334155'}} title="Voice settings">🎙️</button>
            <button onClick={() => setShowArgusPanel(false)} style={styles.argusPanelClose} title="Dismiss">×</button>
          </div>
        </div>
      )}

      {showVoiceSettings && (
        <div style={styles.voiceSettingsPanel}>
          <div style={styles.voiceSettingsRow}>
            <label style={styles.voiceSettingsLabel}>
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} style={styles.checkbox} />
              Enable ARGUS Voice
            </label>
            {voices.length > 0 && (
              <select value={selectedVoice?.name || ''} onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))} style={styles.voiceSelect} disabled={!voiceEnabled}>
                {voices.filter(v => v.lang.startsWith('en')).map(voice => (
                  <option key={voice.name} value={voice.name}>{voice.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => speak("Argus online. Testing voice configuration.")} style={styles.testVoiceButton} disabled={!voiceEnabled}>Test Voice</button>
          </div>
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.filters}>
          <select value={filterPortfolio} onChange={(e) => { setFilterPortfolio(e.target.value); setFilterProject('all'); }} style={styles.select}>
            <option value="all">All Portfolios</option>
            {Object.entries(PROJECT_TAGS).map(([key, val]) => (<option key={key} value={key}>{val.emoji} {val.label}</option>))}
          </select>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} style={styles.select} disabled={filterPortfolio === 'all'}>
            <option value="all">All Projects</option>
            {filterPortfolio !== 'all' && PROJECTS[filterPortfolio]?.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>
          <input type="text" placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={showStaleOnly} onChange={(e) => setShowStaleOnly(e.target.checked)} style={styles.checkbox} />
            Stale &gt; 14 days
          </label>
        </div>
        <div style={styles.actions}>
          {!showArgusPanel && <button onClick={() => setShowArgusPanel(true)} style={{...styles.button, ...styles.argusButton}} title="Show ARGUS">👁</button>}
          <button onClick={() => setShowArchive(!showArchive)} style={{...styles.button, ...styles.secondaryButton}}>📦 Archive ({archivedTasks.length})</button>
          <button onClick={() => { setEditingTask(null); setShowModal(true); }} style={styles.button}>+ New Task</button>
        </div>
      </div>

      {showArchive && (
        <div style={styles.archivePanel}>
          <h3 style={styles.archiveTitle}>📦 Archived Tasks</h3>
          {archivedTasks.length === 0 ? <p style={styles.emptyArchive}>No archived tasks</p> : (
            <div style={styles.archiveList}>
              {archivedTasks.map(task => (
                <div key={task.id} style={styles.archiveItem}>
                  <span style={{...styles.tag, backgroundColor: PROJECT_TAGS[task.portfolio]?.color}}>{PROJECT_TAGS[task.portfolio]?.emoji}</span>
                  <span style={styles.archiveItemTitle}>{task.title}</span>
                  <span style={styles.archiveItemProject}>{task.project}</span>
                  <button onClick={() => restoreTask(task.id)} style={styles.restoreButton}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.board}>
        {columns.map(column => {
          const columnTasks = getColumnTasks(column.id);
          const overLimit = isOverWipLimit(column);
          return (
            <div key={column.id} style={{...styles.column, ...(overLimit ? styles.columnOverLimit : {})}} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id)}>
              <div style={styles.columnHeader}>
                <h2 style={styles.columnTitle}>{column.title}</h2>
                <div style={styles.columnMeta}>
                  <span style={styles.columnCount}>{columnTasks.length}</span>
                  {column.wipLimit && <span style={{...styles.wipLimit, ...(overLimit ? styles.wipLimitExceeded : {})}}>WIP: {column.wipLimit}</span>}
                </div>
              </div>
              <div style={styles.columnBody}>
                {columnTasks.map(task => (
                  <TaskCard key={task.id} task={task} onDragStart={handleDragStart} onEdit={() => { setEditingTask(task); setShowModal(true); }} onArchive={() => archiveTask(task.id)} onToggleBlock={() => toggleBlock(task)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && <TaskModal task={editingTask} onSave={saveTask} onClose={() => { setShowModal(false); setEditingTask(null); }} onDelete={editingTask ? () => { deleteTask(editingTask.id); setShowModal(false); setEditingTask(null); } : null} />}
    </div>
  );
}

function TaskCard({ task, onDragStart, onEdit, onArchive, onToggleBlock }) {
  const stale = daysSince(task.lastSessionDate);
  const isStale = stale !== null && stale > 14;
  const tag = PROJECT_TAGS[task.portfolio];

  return (
    <div draggable onDragStart={(e) => onDragStart(e, task)} onClick={onEdit} style={{...styles.card, ...(task.blocked ? styles.cardBlocked : {}), ...(isStale ? styles.cardStale : {}), borderLeftColor: tag?.color || '#64748b'}}>
      <div style={styles.cardHeader}>
        <span style={{...styles.tag, backgroundColor: tag?.color}}>{tag?.emoji} {task.project}</span>
        {task.blocked && <span style={styles.blockedBadge}>🚫 Blocked</span>}
        {isStale && <span style={styles.staleBadgeCard}>👁 Stale</span>}
      </div>
      <h3 style={styles.cardTitle}>{task.title}</h3>
      {task.nextAction && <p style={styles.nextAction}><strong>Next:</strong> {task.nextAction}</p>}
      <div style={styles.cardFooter}>
        <div style={styles.cardMeta}>
          {task.effort && <span style={styles.effortBadge}>{task.effort}</span>}
          {task.impact && <span style={{...styles.impactBadge, backgroundColor: task.impact === 'High' ? '#dcfce7' : task.impact === 'Medium' ? '#fef3c7' : '#f1f5f9', color: task.impact === 'High' ? '#166534' : task.impact === 'Medium' ? '#92400e' : '#475569'}}>{task.impact}</span>}
        </div>
        {stale !== null && <span style={{...styles.staleBadge, color: isStale ? '#f59e0b' : '#64748b'}}>{stale}d ago</span>}
      </div>
      <div style={styles.cardActions}>
        <button onClick={(e) => { e.stopPropagation(); onToggleBlock(); }} style={styles.cardActionBtn} title={task.blocked ? 'Unblock' : 'Mark Blocked'}>{task.blocked ? '✓' : '🚫'}</button>
        <button onClick={(e) => { e.stopPropagation(); onArchive(); }} style={styles.cardActionBtn} title="Archive">📦</button>
      </div>
    </div>
  );
}

function TaskModal({ task, onSave, onClose, onDelete }) {
  const [form, setForm] = useState(task || { title: '', description: '', status: 'backlog', portfolio: 'pmo-eco', project: '', effort: 'M', impact: 'Medium', blocked: false, blockerReason: '', dueDate: '', startDate: '', completedDate: '', lastSessionDate: new Date().toISOString().split('T')[0], sessionNotes: '', nextAction: '', repoUrl: '', techStack: [] });
  const [techInput, setTechInput] = useState('');

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
  const addTech = () => { if (techInput.trim() && !form.techStack?.includes(techInput.trim())) { setForm({ ...form, techStack: [...(form.techStack || []), techInput.trim()] }); setTechInput(''); } };
  const removeTech = (tech) => { setForm({ ...form, techStack: (form.techStack || []).filter(t => t !== tech) }); };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}><label style={styles.label}>Title *</label><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={styles.input} required /></div>
            <div style={styles.formGroup}><label style={styles.label}>Description</label><textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} style={styles.textarea} rows={2} /></div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Portfolio</label><select value={form.portfolio} onChange={(e) => setForm({ ...form, portfolio: e.target.value, project: '' })} style={styles.input}>{Object.entries(PROJECT_TAGS).map(([key, val]) => (<option key={key} value={key}>{val.emoji} {val.label}</option>))}</select></div>
              <div style={styles.formGroup}><label style={styles.label}>Project</label><select value={form.project || ''} onChange={(e) => setForm({ ...form, project: e.target.value })} style={styles.input}><option value="">Select project...</option>{PROJECTS[form.portfolio]?.map(p => (<option key={p} value={p}>{p}</option>))}</select></div>
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={styles.input}>{DEFAULT_COLUMNS.map(col => (<option key={col.id} value={col.id}>{col.title}</option>))}</select></div>
              <div style={styles.formGroup}><label style={styles.label}>Effort</label><select value={form.effort || 'M'} onChange={(e) => setForm({ ...form, effort: e.target.value })} style={styles.input}>{EFFORT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={styles.formGroup}><label style={styles.label}>Impact</label><select value={form.impact || 'Medium'} onChange={(e) => setForm({ ...form, impact: e.target.value })} style={styles.input}>{IMPACT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}><input type="checkbox" checked={form.blocked || false} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} style={styles.checkbox} />Blocked</label>
              {form.blocked && <input type="text" placeholder="Blocker reason..." value={form.blockerReason || ''} onChange={(e) => setForm({ ...form, blockerReason: e.target.value })} style={{...styles.input, marginTop: '8px'}} />}
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Due Date</label><input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Start Date</label><input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Completed</label><input type="date" value={form.completedDate || ''} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} style={styles.input} /></div>
            </div>
            <div style={styles.sectionTitle}>Session Context</div>
            <div style={styles.formGroup}><label style={styles.label}>Session Notes</label><textarea value={form.sessionNotes || ''} onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })} style={styles.textarea} rows={2} placeholder="Where we left off..." /></div>
            <div style={styles.formGroup}><label style={styles.label}>Next Action</label><input type="text" value={form.nextAction || ''} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} style={styles.input} placeholder="The very next concrete step..." /></div>
            <div style={styles.formGroup}><label style={styles.label}>Repository / URL</label><input type="text" value={form.repoUrl || ''} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} style={styles.input} placeholder="https://github.com/..." /></div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tech Stack</label>
              <div style={styles.techInputRow}><input type="text" value={techInput} onChange={(e) => setTechInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())} style={{...styles.input, flex: 1}} placeholder="Add technology..." /><button type="button" onClick={addTech} style={styles.addTechBtn}>+</button></div>
              <div style={styles.techTags}>{(form.techStack || []).map(tech => (<span key={tech} style={styles.techTag}>{tech}<button type="button" onClick={() => removeTech(tech)} style={styles.removeTechBtn}>×</button></span>))}</div>
            </div>
          </div>
          <div style={styles.modalFooter}>
            {onDelete && <button type="button" onClick={onDelete} style={styles.deleteButton}>Delete</button>}
            <div style={styles.modalFooterRight}>
              <button type="button" onClick={onClose} style={{...styles.button, ...styles.secondaryButton}}>Cancel</button>
              <button type="submit" style={styles.button}>{task ? 'Update' : 'Create'} Task</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif" },
  loadingContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' },
  argusEyeLoading: { fontSize: '64px', animation: 'pulse 2s ease-in-out infinite' },
  loadingText: { fontSize: '18px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' },
  errorContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 100%)' },
  headerLeft: {},
  headerRight: {},
  logoContainer: { display: 'flex', alignItems: 'center', gap: '16px' },
  argusLogo: { width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)', transition: 'all 0.3s ease' },
  argusLogoSpeaking: { boxShadow: '0 0 30px rgba(124, 58, 237, 0.8), 0 0 60px rgba(124, 58, 237, 0.4)', animation: 'pulse 0.5s ease-in-out infinite' },
  eyeIcon: { fontSize: '28px' },
  title: { fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '4px', background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  subtitle: { margin: '2px 0 0 0', color: '#64748b', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' },
  statsRow: { display: 'flex', gap: '24px' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' },
  argusPanel: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)', borderBottom: '1px solid rgba(124, 58, 237, 0.3)' },
  argusPanelContent: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 },
  argusPanelEye: { fontSize: '20px', transition: 'all 0.3s ease' },
  argusPanelEyeSpeaking: { animation: 'pulse 0.5s ease-in-out infinite', filter: 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.8))' },
  argusPanelMessage: { margin: 0, fontSize: '14px', color: '#c4b5fd', fontStyle: 'italic' },
  argusPanelActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  voiceButton: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' },
  reportButton: { padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  voiceSettingsButton: { padding: '6px 10px', borderRadius: '4px', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' },
  argusPanelClose: { background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' },
  voiceSettingsPanel: { padding: '12px 32px', backgroundColor: '#111827', borderBottom: '1px solid #1e293b' },
  voiceSettingsRow: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  voiceSettingsLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#e2e8f0', cursor: 'pointer' },
  voiceSelect: { padding: '6px 12px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '12px', maxWidth: '200px' },
  testVoiceButton: { padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#7c3aed', color: '#fff', fontSize: '12px', cursor: 'pointer' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #1e293b', backgroundColor: '#0a0f1a', flexWrap: 'wrap', gap: '12px' },
  filters: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  select: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer' },
  searchInput: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '14px', width: '200px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#94a3b8', cursor: 'pointer' },
  checkbox: { cursor: 'pointer' },
  actions: { display: 'flex', gap: '12px' },
  button: { padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  secondaryButton: { backgroundColor: '#334155' },
  argusButton: { background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', padding: '10px 14px' },
  archivePanel: { padding: '16px 32px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  archiveTitle: { margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' },
  emptyArchive: { color: '#64748b', fontSize: '14px' },
  archiveList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  archiveItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: '#0f172a', borderRadius: '6px' },
  archiveItemTitle: { flex: 1, fontSize: '14px' },
  archiveItemProject: { color: '#64748b', fontSize: '12px' },
  restoreButton: { padding: '4px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' },
  board: { display: 'flex', gap: '16px', padding: '24px 32px', overflowX: 'auto', minHeight: 'calc(100vh - 200px)' },
  column: { minWidth: '300px', maxWidth: '300px', backgroundColor: '#111827', borderRadius: '12px', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', border: '1px solid #1e293b' },
  columnOverLimit: { boxShadow: '0 0 0 2px #ef4444' },
  columnHeader: { padding: '16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  columnTitle: { margin: 0, fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  columnMeta: { display: 'flex', alignItems: 'center', gap: '8px' },
  columnCount: { backgroundColor: '#1e293b', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' },
  wipLimit: { fontSize: '10px', color: '#64748b', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0f172a' },
  wipLimitExceeded: { backgroundColor: '#7f1d1d', color: '#fca5a5' },
  columnBody: { padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' },
  card: { backgroundColor: '#0f172a', borderRadius: '8px', padding: '14px', cursor: 'grab', borderLeft: '4px solid', transition: 'all 0.2s', position: 'relative' },
  cardBlocked: { opacity: 0.7, background: 'repeating-linear-gradient(45deg, #0f172a, #0f172a 10px, #1a1a2e 10px, #1a1a2e 20px)' },
  cardStale: { boxShadow: 'inset 0 0 0 1px #f59e0b' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' },
  tag: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: '#fff' },
  blockedBadge: { fontSize: '11px', color: '#fca5a5' },
  staleBadgeCard: { fontSize: '11px', color: '#fbbf24' },
  cardTitle: { margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', lineHeight: '1.4' },
  nextAction: { margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { display: 'flex', gap: '6px' },
  effortBadge: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', backgroundColor: '#334155', color: '#94a3b8' },
  impactBadge: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' },
  staleBadge: { fontSize: '11px' },
  cardActions: { position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s' },
  cardActionBtn: { padding: '4px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', cursor: 'pointer', fontSize: '12px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { backgroundColor: '#111827', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto', border: '1px solid #1e293b' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #1e293b' },
  modalTitle: { margin: 0, fontSize: '20px', fontWeight: '600' },
  closeButton: { background: 'none', border: 'none', fontSize: '28px', color: '#64748b', cursor: 'pointer', lineHeight: 1 },
  form: { padding: '24px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '14px' },
  textarea: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' },
  sectionTitle: { fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #1e293b' },
  techInputRow: { display: 'flex', gap: '8px' },
  addTechBtn: { padding: '10px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '16px', cursor: 'pointer' },
  techTags: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' },
  techTag: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '12px' },
  removeTechBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', padding: 0, marginLeft: '2px' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1e293b' },
  modalFooterRight: { display: 'flex', gap: '12px' },
  deleteButton: { padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
};
