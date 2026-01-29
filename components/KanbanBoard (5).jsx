'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const DEFAULT_COLUMNS = [
  { id: 'backlog', title: 'Backlog', wipLimit: null },
  { id: 'ready', title: 'Ready', wipLimit: 5 },
  { id: 'in-progress', title: 'In Progress', wipLimit: 3 },
  { id: 'review', title: 'Review/Test', wipLimit: 2 },
  { id: 'done', title: 'Done', wipLimit: null },
  { id: 'parked', title: 'Parked', wipLimit: null },
];

const COLUMN_ALIASES = {
  'backlog': ['backlog', 'back log'],
  'ready': ['ready', 'to do', 'todo'],
  'in-progress': ['in progress', 'progress', 'working', 'active', 'doing'],
  'review': ['review', 'test', 'testing', 'review test'],
  'done': ['done', 'complete', 'completed', 'finished', 'finish'],
  'parked': ['parked', 'park', 'hold', 'on hold', 'paused'],
};

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

// ARGUS Personality
const ARGUS_INSIGHTS = {
  stale: [
    "I've spotted {count} tasks gathering dust. Shall we revisit them?",
    "{count} items haven't moved in over 14 days. Time for a check-in?",
  ],
  blocked: [
    "{count} tasks are blocked. Every blocker is a decision waiting to be made.",
  ],
  wipExceeded: [
    "WIP limits exceeded in {columns}. Focus beats multitasking.",
  ],
  allClear: [
    "All systems nominal. Your flow looks healthy today.",
    "Nothing urgent on my radar. Steady progress wins.",
    "Clean board, clear mind. Keep the momentum going.",
  ],
  greeting: [
    "Argus online. I see all, forget nothing.",
  ],
  dailyBriefing: [
    "Good morning Sylvain. You have {total} tasks. {inProgress} in progress, {blocked} blocked, {stale} stale. {suggestion}",
  ],
  statusReport: [
    "Status report: {total} tasks. {inProgress} active, {blocked} blocked, {stale} stale. {completed} completed this week.",
  ],
  taskMoved: [
    "Done. Task {number}, {task}, moved to {column}.",
    "Task {number} is now in {column}.",
  ],
  taskCreated: [
    "New task logged as number {number}.",
  ],
  taskCompleted: [
    "Well done. Task {number}, {task}, marked complete.",
    "Excellent. Task {number} finished.",
  ],
  taskBlocked: [
    "Task {number} is now blocked.",
  ],
  taskUnblocked: [
    "Task {number} is unblocked.",
  ],
  focusSuggestion: [
    "I suggest task {number}: {task}.",
  ],
  noFocusFound: [
    "Your board looks balanced. Pick what energizes you.",
  ],
  streak: [
    "That's {count} tasks completed this week!",
  ],
  overdue: [
    "Warning: {count} tasks are past due.",
  ],
  listening: [
    "I'm listening.",
  ],
  notUnderstood: [
    "I didn't catch that. Try: move task 5 to done.",
  ],
  taskNotFound: [
    "Task {number} not found. Valid numbers are 1 to {max}.",
  ],
  commandHelp: [
    "Commands: Move task number to column. Status. Block task. Focus. What's stale.",
  ],
  taskInfo: [
    "Task {number} is {task}. Currently in {status}.",
  ],
  confirmingMove: [
    "Moving task {number}: {task} to {column}...",
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

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
};

const isOverdue = (task) => {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(task.dueDate) < new Date();
};

// Find column from spoken text - improved to avoid false matches
const findColumn = (text) => {
  const lower = text.toLowerCase();
  
  // Check for explicit column mentions
  for (const [columnId, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      // Look for "to <column>" pattern specifically
      if (lower.includes(` to ${alias}`) || lower.includes(` ${alias}`) || lower.endsWith(alias)) {
        return columnId;
      }
    }
  }
  return null;
};

// Extract task number from text - be very specific
const extractTaskNumber = (text) => {
  const wordToNum = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24, 'twenty five': 25,
    'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28, 'twenty nine': 29, 'thirty': 30,
    'thirty one': 31, 'thirty two': 32, 'thirty three': 33, 'thirty four': 34, 'thirty five': 35,
  };
  
  const lower = text.toLowerCase();
  
  // Pattern 1: "task number X" or "task X"
  const taskPatterns = [
    /task\s+number\s+(\d+)/i,
    /task\s+number\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)/i,
    /task\s+(\d+)/i,
    /task\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)/i,
  ];
  
  for (const pattern of taskPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const numStr = match[1];
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed)) return parsed;
      if (wordToNum[numStr]) return wordToNum[numStr];
    }
  }
  
  // Pattern 2: compound numbers "twenty one" etc
  for (const [word, num] of Object.entries(wordToNum)) {
    if (word.includes(' ') && lower.includes(word)) {
      return num;
    }
  }
  
  return null;
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
        const preferred = availableVoices.find(v => v.name.includes('Ree') || v.name.includes('Daniel') || v.name.includes('UK English Male')) 
          || availableVoices.find(v => v.lang.startsWith('en-GB'))
          || availableVoices.find(v => v.lang.startsWith('en')) 
          || availableVoices[0];
        setSelectedVoice(preferred);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = useCallback((text, options = {}) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 0.9;
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

// ARGUS Listening System
const useArgusListener = (onCommand) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pendingCommand, setPendingCommand] = useState('');
  const recognitionRef = useRef(null);
  const commandTimeoutRef = useRef(null);
  const lastProcessedRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }

      const lower = fullTranscript.toLowerCase().trim();
      setTranscript(lower);

      if (lower.includes('argus') || lower.includes('ar gus')) {
        const commandMatch = lower.match(/(?:hey\s+)?(?:argus|ar gus)[,.]?\s*(.*)/i);
        const command = commandMatch ? commandMatch[1].trim() : '';
        
        if (command && command !== lastProcessedRef.current) {
          setPendingCommand(command);
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
          commandTimeoutRef.current = setTimeout(() => {
            if (command && command !== lastProcessedRef.current) {
              console.log('=== EXECUTING COMMAND ===', command);
              lastProcessedRef.current = command;
              onCommand(command);
              setPendingCommand('');
              setTranscript('');
            }
          }, 1500);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') setIsListening(false);
    };

    recognition.onend = () => {
      if (pendingCommand && pendingCommand !== lastProcessedRef.current) {
        lastProcessedRef.current = pendingCommand;
        onCommand(pendingCommand);
        setPendingCommand('');
        setTranscript('');
      }
      if (isListening) {
        try { recognition.start(); } catch (e) { console.log('Restart failed'); }
      }
    };

    recognitionRef.current = recognition;
    return () => {
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      recognition.stop();
    };
  }, [isListening, onCommand, pendingCommand]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        lastProcessedRef.current = '';
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) { console.error('Failed to start:', e); }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setTranscript('');
      setPendingCommand('');
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
    }
  }, []);

  return { isListening, transcript, pendingCommand, startListening, stopListening };
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
  const [dailyBriefingGiven, setDailyBriefingGiven] = useState(false);

  const { voiceEnabled, setVoiceEnabled, isSpeaking, speak, stop, voices, selectedVoice, setSelectedVoice } = useArgusVoice();

  // STABLE task numbers - based on creation order
  const numberedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.id || 0);
      const dateB = new Date(b.createdAt || b.id || 0);
      return dateA - dateB;
    });
    const map = new Map();
    sorted.forEach((task, index) => {
      map.set(task.id, index + 1);
    });
    return map;
  }, [tasks]);

  // Get task by number
  const getTaskByNumber = useCallback((num) => {
    for (const [taskId, taskNum] of numberedTasks.entries()) {
      if (taskNum === num) {
        return tasks.find(t => t.id === taskId);
      }
    }
    return null;
  }, [numberedTasks, tasks]);

  // SAFE MOVE TASK - does NOT delete, only updates status
  const moveTaskSafely = useCallback(async (task, newColumnId, taskNumber) => {
    if (!task || !task.id) {
      console.error('moveTaskSafely: Invalid task', task);
      return;
    }
    if (!newColumnId) {
      console.error('moveTaskSafely: Invalid column', newColumnId);
      return;
    }

    console.log('=== MOVE TASK SAFELY ===');
    console.log('Task ID:', task.id);
    console.log('Task Title:', task.title);
    console.log('From:', task.status);
    console.log('To:', newColumnId);

    const now = new Date().toISOString().split('T')[0];
    const columnName = columns.find(c => c.id === newColumnId)?.title || newColumnId;
    
    // Create updated task object - ONLY changing status-related fields
    const updatedTask = {
      ...task,
      status: newColumnId,
      lastSessionDate: now,
    };
    
    // Add start date if moving to in-progress
    if (newColumnId === 'in-progress' && !task.startDate) {
      updatedTask.startDate = now;
    }
    
    // Add completed date if moving to done
    if (newColumnId === 'done' && !task.completedDate) {
      updatedTask.completedDate = now;
    }

    // Optimistic update - update local state FIRST
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(t => {
        if (t.id === task.id) {
          console.log('Updating task in state:', t.id, '-> status:', newColumnId);
          return updatedTask;
        }
        return t;
      });
      console.log('Tasks after update:', newTasks.length);
      return newTasks;
    });

    // Announce the move
    let msg;
    if (newColumnId === 'done') {
      msg = getRandomInsight('taskCompleted', { number: taskNumber, task: task.title });
    } else {
      msg = getRandomInsight('taskMoved', { number: taskNumber, task: task.title, column: columnName });
    }
    setArgusMessage(msg);
    speak(msg);

    // Persist to database
    try {
      console.log('Sending PUT request to /api/tasks');
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      const data = await res.json();
      console.log('API response:', data);
      
      if (data.error) {
        console.error('API error:', data.error);
        // Revert on error
        fetchTasks();
      }
    } catch (err) {
      console.error('Network error:', err);
      // Revert on error
      fetchTasks();
    }
  }, [columns, speak]);

  // Command handler
  const handleVoiceCommand = useCallback((command) => {
    console.log('=== VOICE COMMAND ===', command);
    const lower = command.toLowerCase().trim();
    if (!lower) return;

    // Help
    if (lower.includes('help')) {
      const msg = getRandomInsight('commandHelp');
      setArgusMessage(msg);
      speak(msg);
      return;
    }

    // Status report
    if (lower.includes('status') || lower.includes('report')) {
      giveStatusReport();
      return;
    }

    // Focus suggestion
    if (lower.includes('focus') || lower.includes('suggest')) {
      giveFocusSuggestion();
      return;
    }

    // What is task X
    if (lower.includes('what is task') || lower.includes('what\'s task')) {
      const num = extractTaskNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          const columnName = columns.find(c => c.id === task.status)?.title || task.status;
          const msg = getRandomInsight('taskInfo', { number: num, task: task.title, status: columnName });
          setArgusMessage(msg);
          speak(msg);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num, max: tasks.length });
          setArgusMessage(msg);
          speak(msg);
        }
      }
      return;
    }

    // What's stale
    if (lower.includes('stale')) {
      const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
      const msg = staleTasks.length === 0 
        ? "No stale tasks."
        : `${staleTasks.length} stale: ${staleTasks.slice(0,3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ')}`;
      setArgusMessage(msg);
      speak(msg);
      return;
    }

    // What's overdue
    if (lower.includes('overdue')) {
      const overdueTasks = tasks.filter(isOverdue);
      const msg = overdueTasks.length === 0
        ? "No overdue tasks."
        : `${overdueTasks.length} overdue: ${overdueTasks.slice(0,3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ')}`;
      setArgusMessage(msg);
      speak(msg);
      return;
    }

    // What's blocked
    if (lower.includes('what') && lower.includes('blocked')) {
      const blockedTasks = tasks.filter(t => t.blocked);
      const msg = blockedTasks.length === 0
        ? "No blocked tasks."
        : `${blockedTasks.length} blocked: ${blockedTasks.slice(0,3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ')}`;
      setArgusMessage(msg);
      speak(msg);
      return;
    }

    // MOVE TASK - the critical command
    if (lower.includes('move')) {
      const num = extractTaskNumber(lower);
      const columnId = findColumn(lower);
      
      console.log('MOVE COMMAND PARSED:');
      console.log('  Task number:', num);
      console.log('  Target column:', columnId);
      
      if (!num) {
        const msg = "Which task? Say: move task 5 to done.";
        setArgusMessage(msg);
        speak(msg);
        return;
      }
      
      if (!columnId) {
        const msg = "Which column? Try: done, ready, in progress, review, backlog, or parked.";
        setArgusMessage(msg);
        speak(msg);
        return;
      }
      
      const task = getTaskByNumber(num);
      
      if (!task) {
        const msg = getRandomInsight('taskNotFound', { number: num, max: tasks.length });
        setArgusMessage(msg);
        speak(msg);
        return;
      }
      
      console.log('Found task:', task.title);
      
      // Confirm and execute the move
      const confirmMsg = getRandomInsight('confirmingMove', { 
        number: num, 
        task: task.title, 
        column: columns.find(c => c.id === columnId)?.title 
      });
      setArgusMessage(confirmMsg);
      
      // Execute the move
      moveTaskSafely(task, columnId, num);
      return;
    }

    // Block task
    if (lower.includes('block') && !lower.includes('unblock')) {
      const num = extractTaskNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          toggleBlockTask(task, true, num);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num, max: tasks.length });
          setArgusMessage(msg);
          speak(msg);
        }
      }
      return;
    }

    // Unblock task
    if (lower.includes('unblock')) {
      const num = extractTaskNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          toggleBlockTask(task, false, num);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num, max: tasks.length });
          setArgusMessage(msg);
          speak(msg);
        }
      }
      return;
    }

    // Not understood
    const msg = getRandomInsight('notUnderstood');
    setArgusMessage(msg);
    speak(msg);
  }, [tasks, numberedTasks, speak, getTaskByNumber, columns, moveTaskSafely]);

  const { isListening, transcript, pendingCommand, startListening, stopListening } = useArgusListener(handleVoiceCommand);

  useEffect(() => { fetchTasks(); fetchArchivedTasks(); }, []);

  useEffect(() => {
    if (!loading && tasks.length > 0 && voiceEnabled && !dailyBriefingGiven) {
      const lastBriefing = localStorage.getItem('argus_last_briefing');
      const today = new Date().toDateString();
      if (lastBriefing !== today) {
        setTimeout(() => {
          giveDailyBriefing();
          localStorage.setItem('argus_last_briefing', today);
          setDailyBriefingGiven(true);
        }, 1000);
      }
    }
  }, [loading, tasks.length, voiceEnabled, dailyBriefingGiven]);

  useEffect(() => {
    if (tasks.length === 0 && !loading) {
      setArgusMessage(getRandomInsight('greeting'));
      return;
    }
    if (loading) return;

    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const overdueTasks = tasks.filter(isOverdue);

    let message = '';
    if (overdueTasks.length > 0) {
      message = getRandomInsight('overdue', { count: overdueTasks.length });
    } else if (staleTasks.length > 0) {
      message = getRandomInsight('stale', { count: staleTasks.length });
    } else if (blockedTasks.length > 0) {
      message = getRandomInsight('blocked', { count: blockedTasks.length });
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
      console.log('Fetched tasks:', data.tasks?.length);
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
      console.error('Failed to fetch archived:', err);
    }
  };

  const giveDailyBriefing = () => {
    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    
    let suggestion = '';
    const readyHighImpact = tasks.find(t => t.status === 'ready' && t.impact === 'High' && !t.blocked);
    if (readyHighImpact) {
      suggestion = `Start with task ${numberedTasks.get(readyHighImpact.id)}.`;
    }

    const report = getRandomInsight('dailyBriefing', {
      total: tasks.length,
      inProgress: inProgressTasks.length,
      blocked: blockedTasks.length,
      stale: staleTasks.length,
      suggestion,
    });
    setArgusMessage(report);
    speak(report);
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

  const giveFocusSuggestion = () => {
    let suggestion = tasks.find(t => t.status === 'ready' && t.impact === 'High' && !t.blocked);
    if (!suggestion) suggestion = tasks.find(t => t.status === 'ready' && !t.blocked);
    if (!suggestion) suggestion = tasks.find(t => t.status === 'in-progress' && !t.blocked);
    
    if (suggestion) {
      const num = numberedTasks.get(suggestion.id);
      const msg = getRandomInsight('focusSuggestion', { number: num, task: suggestion.title });
      setArgusMessage(msg);
      speak(msg);
    } else {
      const msg = getRandomInsight('noFocusFound');
      setArgusMessage(msg);
      speak(msg);
    }
  };

  const toggleBlockTask = async (task, blocked, taskNumber) => {
    const updated = { ...task, blocked };
    setTasks(tasks.map(t => t.id === task.id ? updated : t));
    
    const msg = blocked 
      ? getRandomInsight('taskBlocked', { number: taskNumber, task: task.title })
      : getRandomInsight('taskUnblocked', { number: taskNumber, task: task.title });
    setArgusMessage(msg);
    speak(msg);
    
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
    const taskNumber = numberedTasks.get(draggedTask.id);
    await moveTaskSafely(draggedTask, columnId, taskNumber);
    setDraggedTask(null);
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
        setTasks([...tasks, data.task]);
        const newNum = tasks.length + 1;
        const msg = getRandomInsight('taskCreated', { number: newNum });
        setArgusMessage(msg);
        speak(msg);
      }
      setShowModal(false);
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Failed to save: ' + err.message);
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
      console.error('Failed to archive:', err);
    }
  };

  const restoreTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/archive?id=${taskId}`, { method: 'DELETE' });
      const task = archivedTasks.find(t => t.id === taskId);
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
      setTasks([...tasks, { ...task, archivedAt: null }]);
    } catch (err) {
      console.error('Failed to restore:', err);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Permanently delete this task?')) return;
    try {
      await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const toggleBlock = async (task) => {
    const num = numberedTasks.get(task.id);
    await toggleBlockTask(task, !task.blocked, num);
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

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    blocked: tasks.filter(t => t.blocked).length,
    stale: tasks.filter(t => daysSince(t.lastSessionDate) >= 14).length,
    overdue: tasks.filter(isOverdue).length,
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
            <div style={{...styles.argusLogo, ...(isSpeaking ? styles.argusLogoSpeaking : {}), ...(isListening ? styles.argusLogoListening : {})}}>
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
            <div style={styles.stat}><span style={{...styles.statValue, color: '#dc2626'}}>{stats.overdue}</span><span style={styles.statLabel}>Overdue</span></div>
            <div style={styles.stat}><span style={{...styles.statValue, color: '#22c55e'}}>{stats.completedThisWeek}</span><span style={styles.statLabel}>Week</span></div>
          </div>
        </div>
      </header>

      {showArgusPanel && (
        <div style={{...styles.argusPanel, ...(isListening ? styles.argusPanelListening : {})}}>
          <div style={styles.argusPanelContent}>
            <span style={{...styles.argusPanelEye, ...(isSpeaking ? styles.argusPanelEyeSpeaking : {})}}>👁</span>
            <div style={styles.argusPanelText}>
              <p style={styles.argusPanelMessage}>{argusMessage}</p>
              {isListening && transcript && (
                <p style={styles.transcriptText}>
                  🎤 {transcript}
                  {pendingCommand && <span style={styles.pendingIndicator}> ⏳</span>}
                </p>
              )}
              {isListening && !transcript && <p style={styles.awakeText}>🎤 Say "Argus, move task 5 to done"</p>}
            </div>
          </div>
          <div style={styles.argusPanelActions}>
            <button onClick={isListening ? stopListening : startListening} style={{...styles.micButton, ...(isListening ? styles.micButtonActive : {})}}>🎤</button>
            <button onClick={isSpeaking ? stop : () => speak(argusMessage)} style={{...styles.voiceButton, opacity: voiceEnabled ? 1 : 0.5}} disabled={!voiceEnabled && !isSpeaking}>{isSpeaking ? '🔇' : '🔊'}</button>
            <button onClick={giveStatusReport} style={styles.reportButton}>📊</button>
            <button onClick={giveFocusSuggestion} style={styles.focusButton}>🎯</button>
            <button onClick={() => setShowVoiceSettings(!showVoiceSettings)} style={{...styles.voiceSettingsButton, backgroundColor: voiceEnabled ? '#7c3aed' : '#334155'}}>⚙️</button>
            <button onClick={() => setShowArgusPanel(false)} style={styles.argusPanelClose}>×</button>
          </div>
        </div>
      )}

      {showVoiceSettings && (
        <div style={styles.voiceSettingsPanel}>
          <div style={styles.voiceSettingsRow}>
            <label style={styles.voiceSettingsLabel}>
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} />
              Enable Voice
            </label>
            {voices.length > 0 && (
              <select value={selectedVoice?.name || ''} onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))} style={styles.voiceSelect} disabled={!voiceEnabled}>
                {voices.filter(v => v.lang.startsWith('en')).map(voice => (
                  <option key={voice.name} value={voice.name}>{voice.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => speak("Argus online.")} style={styles.testVoiceButton} disabled={!voiceEnabled}>Test</button>
          </div>
          <div style={styles.commandHints}>
            <strong>Commands:</strong> "Argus, move task 5 to done" • "Argus, status" • "Argus, what is task 3" • "Argus, focus"
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
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={showStaleOnly} onChange={(e) => setShowStaleOnly(e.target.checked)} />
            Stale
          </label>
        </div>
        <div style={styles.actions}>
          {!showArgusPanel && <button onClick={() => setShowArgusPanel(true)} style={{...styles.button, ...styles.argusButton}}>👁</button>}
          <button onClick={() => setShowArchive(!showArchive)} style={{...styles.button, ...styles.secondaryButton}}>📦 ({archivedTasks.length})</button>
          <button onClick={() => { setEditingTask(null); setShowModal(true); }} style={styles.button}>+ New</button>
        </div>
      </div>

      {showArchive && (
        <div style={styles.archivePanel}>
          <h3 style={styles.archiveTitle}>📦 Archived</h3>
          {archivedTasks.length === 0 ? <p style={styles.emptyArchive}>No archived tasks</p> : (
            <div style={styles.archiveList}>
              {archivedTasks.map(task => (
                <div key={task.id} style={styles.archiveItem}>
                  <span style={{...styles.tag, backgroundColor: PROJECT_TAGS[task.portfolio]?.color}}>{PROJECT_TAGS[task.portfolio]?.emoji}</span>
                  <span style={styles.archiveItemTitle}>{task.title}</span>
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
                  <TaskCard key={task.id} task={task} taskNumber={numberedTasks.get(task.id)} onDragStart={handleDragStart} onEdit={() => { setEditingTask(task); setShowModal(true); }} onArchive={() => archiveTask(task.id)} onToggleBlock={() => toggleBlock(task)} />
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

function TaskCard({ task, taskNumber, onDragStart, onEdit, onArchive, onToggleBlock }) {
  const stale = daysSince(task.lastSessionDate);
  const isStale = stale !== null && stale > 14;
  const overdue = isOverdue(task);
  const tag = PROJECT_TAGS[task.portfolio];

  return (
    <div draggable onDragStart={(e) => onDragStart(e, task)} onClick={onEdit} style={{...styles.card, ...(task.blocked ? styles.cardBlocked : {}), ...(isStale ? styles.cardStale : {}), ...(overdue ? styles.cardOverdue : {}), borderLeftColor: tag?.color || '#64748b'}}>
      <div style={styles.cardHeader}>
        <div style={styles.taskNumberBadge}>#{taskNumber}</div>
        <span style={{...styles.tag, backgroundColor: tag?.color}}>{tag?.emoji} {task.project}</span>
        <div style={styles.cardBadges}>
          {task.blocked && <span>🚫</span>}
          {overdue && <span>⏰</span>}
          {isStale && <span style={{color:'#fbbf24'}}>👁</span>}
        </div>
      </div>
      <h3 style={styles.cardTitle}>{task.title}</h3>
      {task.nextAction && <p style={styles.nextAction}>→ {task.nextAction}</p>}
      <div style={styles.cardFooter}>
        <div style={styles.cardMeta}>
          {task.effort && <span style={styles.effortBadge}>{task.effort}</span>}
          {task.impact && <span style={{...styles.impactBadge, backgroundColor: task.impact === 'High' ? '#dcfce7' : task.impact === 'Medium' ? '#fef3c7' : '#f1f5f9', color: task.impact === 'High' ? '#166534' : task.impact === 'Medium' ? '#92400e' : '#475569'}}>{task.impact}</span>}
        </div>
        {stale !== null && <span style={{fontSize:'10px', color: isStale ? '#f59e0b' : '#64748b'}}>{stale}d</span>}
      </div>
      <div style={styles.cardActions}>
        <button onClick={(e) => { e.stopPropagation(); onToggleBlock(); }} style={styles.cardActionBtn}>{task.blocked ? '✓' : '🚫'}</button>
        <button onClick={(e) => { e.stopPropagation(); onArchive(); }} style={styles.cardActionBtn}>📦</button>
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
              <div style={styles.formGroup}><label style={styles.label}>Project</label><select value={form.project || ''} onChange={(e) => setForm({ ...form, project: e.target.value })} style={styles.input}><option value="">Select...</option>{PROJECTS[form.portfolio]?.map(p => (<option key={p} value={p}>{p}</option>))}</select></div>
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={styles.input}>{DEFAULT_COLUMNS.map(col => (<option key={col.id} value={col.id}>{col.title}</option>))}</select></div>
              <div style={styles.formGroup}><label style={styles.label}>Effort</label><select value={form.effort || 'M'} onChange={(e) => setForm({ ...form, effort: e.target.value })} style={styles.input}>{EFFORT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={styles.formGroup}><label style={styles.label}>Impact</label><select value={form.impact || 'Medium'} onChange={(e) => setForm({ ...form, impact: e.target.value })} style={styles.input}>{IMPACT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}><input type="checkbox" checked={form.blocked || false} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} />Blocked</label>
              {form.blocked && <input type="text" placeholder="Reason..." value={form.blockerReason || ''} onChange={(e) => setForm({ ...form, blockerReason: e.target.value })} style={{...styles.input, marginTop: '8px'}} />}
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Due</label><input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Start</label><input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Done</label><input type="date" value={form.completedDate || ''} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} style={styles.input} /></div>
            </div>
            <div style={styles.sectionTitle}>Session Context</div>
            <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={form.sessionNotes || ''} onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })} style={styles.textarea} rows={2} /></div>
            <div style={styles.formGroup}><label style={styles.label}>Next Action</label><input type="text" value={form.nextAction || ''} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} style={styles.input} /></div>
            <div style={styles.formGroup}><label style={styles.label}>Repo / URL</label><input type="text" value={form.repoUrl || ''} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} style={styles.input} /></div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tech Stack</label>
              <div style={styles.techInputRow}><input type="text" value={techInput} onChange={(e) => setTechInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())} style={{...styles.input, flex: 1}} /><button type="button" onClick={addTech} style={styles.addTechBtn}>+</button></div>
              <div style={styles.techTags}>{(form.techStack || []).map(tech => (<span key={tech} style={styles.techTag}>{tech}<button type="button" onClick={() => removeTech(tech)} style={styles.removeTechBtn}>×</button></span>))}</div>
            </div>
          </div>
          <div style={styles.modalFooter}>
            {onDelete && <button type="button" onClick={onDelete} style={styles.deleteButton}>Delete</button>}
            <div style={styles.modalFooterRight}>
              <button type="button" onClick={onClose} style={{...styles.button, ...styles.secondaryButton}}>Cancel</button>
              <button type="submit" style={styles.button}>{task ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" },
  loadingContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' },
  argusEyeLoading: { fontSize: '64px', animation: 'pulse 2s infinite' },
  loadingText: { fontSize: '18px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' },
  errorContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 100%)' },
  headerLeft: {},
  headerRight: {},
  logoContainer: { display: 'flex', alignItems: 'center', gap: '12px' },
  argusLogo: { width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)', transition: 'all 0.3s' },
  argusLogoSpeaking: { boxShadow: '0 0 30px rgba(124, 58, 237, 0.8)', animation: 'pulse 0.5s infinite' },
  argusLogoListening: { boxShadow: '0 0 30px rgba(34, 197, 94, 0.8)', background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' },
  eyeIcon: { fontSize: '24px' },
  title: { fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '3px', background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { margin: '2px 0 0 0', color: '#64748b', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' },
  statsRow: { display: 'flex', gap: '20px' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statValue: { fontSize: '20px', fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase' },
  argusPanel: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)', borderBottom: '1px solid rgba(124, 58, 237, 0.3)' },
  argusPanelListening: { background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.3) 0%, rgba(34, 197, 94, 0.3) 100%)', borderBottom: '1px solid rgba(34, 197, 94, 0.5)' },
  argusPanelContent: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 },
  argusPanelText: { flex: 1 },
  argusPanelEye: { fontSize: '18px' },
  argusPanelEyeSpeaking: { animation: 'pulse 0.5s infinite', filter: 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.8))' },
  argusPanelMessage: { margin: 0, fontSize: '13px', color: '#c4b5fd', fontStyle: 'italic' },
  transcriptText: { margin: '4px 0 0 0', fontSize: '12px', color: '#86efac', fontFamily: 'monospace' },
  pendingIndicator: { color: '#fbbf24' },
  awakeText: { margin: '4px 0 0 0', fontSize: '11px', color: '#86efac' },
  argusPanelActions: { display: 'flex', alignItems: 'center', gap: '6px' },
  micButton: { padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer' },
  micButtonActive: { backgroundColor: '#22c55e', animation: 'pulse 1s infinite' },
  voiceButton: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px 6px' },
  reportButton: { padding: '5px 10px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' },
  focusButton: { padding: '5px 10px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '12px', cursor: 'pointer' },
  voiceSettingsButton: { padding: '5px 8px', borderRadius: '4px', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' },
  argusPanelClose: { background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer', padding: '4px 6px' },
  voiceSettingsPanel: { padding: '10px 24px', backgroundColor: '#111827', borderBottom: '1px solid #1e293b' },
  voiceSettingsRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  voiceSettingsLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' },
  voiceSelect: { padding: '5px 10px', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '11px', maxWidth: '180px' },
  testVoiceButton: { padding: '5px 10px', borderRadius: '4px', border: 'none', backgroundColor: '#7c3aed', color: '#fff', fontSize: '11px', cursor: 'pointer' },
  commandHints: { marginTop: '6px', fontSize: '11px', color: '#64748b' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #1e293b', backgroundColor: '#0a0f1a', flexWrap: 'wrap', gap: '10px' },
  filters: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  select: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '13px' },
  searchInput: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '13px', width: '120px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' },
  actions: { display: 'flex', gap: '10px' },
  button: { padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  secondaryButton: { backgroundColor: '#334155' },
  argusButton: { background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', padding: '8px 12px' },
  archivePanel: { padding: '12px 24px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  archiveTitle: { margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' },
  emptyArchive: { color: '#64748b', fontSize: '13px' },
  archiveList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  archiveItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', backgroundColor: '#0f172a', borderRadius: '6px' },
  archiveItemTitle: { flex: 1, fontSize: '13px' },
  restoreButton: { padding: '4px 10px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '11px', cursor: 'pointer' },
  board: { display: 'flex', gap: '12px', padding: '16px 24px', overflowX: 'auto', minHeight: 'calc(100vh - 180px)' },
  column: { minWidth: '280px', maxWidth: '280px', backgroundColor: '#111827', borderRadius: '10px', display: 'flex', flexDirection: 'column', border: '1px solid #1e293b' },
  columnOverLimit: { boxShadow: '0 0 0 2px #ef4444' },
  columnHeader: { padding: '12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  columnTitle: { margin: 0, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  columnMeta: { display: 'flex', alignItems: 'center', gap: '6px' },
  columnCount: { backgroundColor: '#1e293b', padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  wipLimit: { fontSize: '9px', color: '#64748b', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#0f172a' },
  wipLimitExceeded: { backgroundColor: '#7f1d1d', color: '#fca5a5' },
  columnBody: { padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' },
  card: { backgroundColor: '#0f172a', borderRadius: '8px', padding: '12px', cursor: 'grab', borderLeft: '4px solid', position: 'relative' },
  cardBlocked: { opacity: 0.7, background: 'repeating-linear-gradient(45deg, #0f172a, #0f172a 10px, #1a1a2e 10px, #1a1a2e 20px)' },
  cardStale: { boxShadow: 'inset 0 0 0 1px #f59e0b' },
  cardOverdue: { boxShadow: 'inset 0 0 0 2px #dc2626' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' },
  taskNumberBadge: { backgroundColor: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', fontFamily: 'monospace' },
  tag: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', color: '#fff' },
  cardBadges: { marginLeft: 'auto', display: 'flex', gap: '3px', fontSize: '10px' },
  cardTitle: { margin: '0 0 6px 0', fontSize: '13px', fontWeight: '600', lineHeight: '1.3' },
  nextAction: { margin: '0 0 6px 0', fontSize: '11px', color: '#94a3b8' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { display: 'flex', gap: '4px' },
  effortBadge: { padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', backgroundColor: '#334155', color: '#94a3b8' },
  impactBadge: { padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' },
  cardActions: { position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '3px', opacity: 0 },
  cardActionBtn: { padding: '3px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', cursor: 'pointer', fontSize: '10px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modal: { backgroundColor: '#111827', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', border: '1px solid #1e293b' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e293b' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: '600' },
  closeButton: { background: 'none', border: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer' },
  form: { padding: '20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '14px' },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  input: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '13px' },
  textarea: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' },
  sectionTitle: { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '6px', paddingTop: '14px', borderTop: '1px solid #1e293b' },
  techInputRow: { display: 'flex', gap: '6px' },
  addTechBtn: { padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer' },
  techTags: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' },
  techTag: { display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '11px' },
  removeTechBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #1e293b' },
  modalFooterRight: { display: 'flex', gap: '10px' },
  deleteButton: { padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
};
