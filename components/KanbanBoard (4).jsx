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
  dailyBriefing: [
    "Good morning Sylvain. Here's your daily briefing. You have {total} tasks. {inProgress} in progress, {blocked} blocked, {stale} stale, and {overdue} overdue. {suggestion}",
  ],
  statusReport: [
    "Status report: {total} tasks total. {inProgress} active, {blocked} blocked, {stale} stale, {overdue} overdue. {completed} completed this week.",
  ],
  taskMoved: [
    "Done. Task {number}, {task}, moved to {column}.",
    "Task {number} is now in {column}.",
    "Noted. {task} moved to {column}.",
  ],
  taskCreated: [
    "New task logged as number {number}. I'm watching it.",
    "Added as task {number}.",
    "Task {number} recorded. Nothing escapes my gaze.",
  ],
  taskCompleted: [
    "Well done. Task {number} complete.",
    "Excellent. {task} finished. Keep that momentum.",
    "Task {number} marked done. Progress feels good.",
  ],
  taskBlocked: [
    "Task {number} is now blocked.",
    "Noted. {task} is blocked. Let's clear that path soon.",
  ],
  taskUnblocked: [
    "Task {number} is unblocked. Path is clear.",
    "Good. {task} can move forward now.",
  ],
  focusSuggestion: [
    "I suggest task {number}: {task}. High impact and ready.",
    "Consider task {number}, {task}. It's been waiting.",
    "My recommendation: task {number}, {task}.",
  ],
  noFocusFound: [
    "Your board looks balanced. Pick what energizes you.",
    "No urgent priorities. Follow your intuition today.",
  ],
  streak: [
    "That's {count} tasks completed this week. Impressive!",
    "{count} done this week. You're on fire.",
  ],
  overdue: [
    "Warning: {count} tasks are past due.",
    "Attention: {count} overdue items.",
  ],
  listening: [
    "I'm listening.",
    "Yes?",
    "Go ahead.",
  ],
  processing: [
    "Processing...",
  ],
  notUnderstood: [
    "I didn't catch that. Try: move task 5 to done, or say help.",
    "Sorry, I didn't understand. Say 'Argus help' for commands.",
  ],
  taskNotFound: [
    "I can't find task {number}. Check the board for valid numbers.",
    "Task {number} doesn't exist. Try another number.",
  ],
  commandHelp: [
    "Commands: Move task number to column. Status. Block or unblock task number. Focus. What's stale. What's overdue. What is task number.",
  ],
  taskInfo: [
    "Task {number} is {task}. Currently in {status}. Impact: {impact}.",
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

// Find column from spoken text
const findColumn = (text) => {
  const lower = text.toLowerCase();
  for (const [columnId, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (lower.includes(alias)) return columnId;
    }
  }
  return null;
};

// Extract number from text
const extractNumber = (text) => {
  const wordToNum = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24, 'twenty five': 25,
    'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28, 'twenty nine': 29, 'thirty': 30,
    'thirty one': 31, 'thirty two': 32, 'thirty three': 33, 'thirty four': 34, 'thirty five': 35,
    'to': null, 'too': null, 'for': null, // Ignore these - they're likely not numbers
  };
  
  const lower = text.toLowerCase();
  
  // Check for "number X" or "task X" pattern first - be more specific
  const patterns = [
    /(?:number|task)\s+(\d+)/i,
    /(?:number|task)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)/i,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const numStr = match[1];
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed)) return parsed;
      if (wordToNum[numStr] !== undefined && wordToNum[numStr] !== null) return wordToNum[numStr];
    }
  }
  
  // Check for compound numbers like "twenty one"
  const compoundMatch = lower.match(/(twenty|thirty)\s+(one|two|three|four|five|six|seven|eight|nine)/);
  if (compoundMatch) {
    const compound = compoundMatch[0];
    if (wordToNum[compound]) return wordToNum[compound];
  }
  
  // Check for simple word numbers (but not "to" or "for")
  for (const [word, num] of Object.entries(wordToNum)) {
    if (num !== null && lower.includes(` ${word} `) || lower.includes(` ${word}`) || lower.startsWith(`${word} `)) {
      return num;
    }
  }
  
  // Finally check for standalone digits
  const digitMatch = lower.match(/\b(\d+)\b/);
  return digitMatch ? parseInt(digitMatch[1], 10) : null;
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
          
          if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current);
          }
          
          commandTimeoutRef.current = setTimeout(() => {
            if (command && command !== lastProcessedRef.current) {
              console.log('Executing command:', command);
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
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (pendingCommand && pendingCommand !== lastProcessedRef.current) {
        console.log('Executing on end:', pendingCommand);
        lastProcessedRef.current = pendingCommand;
        onCommand(pendingCommand);
        setPendingCommand('');
        setTranscript('');
      }
      
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.log('Restart failed:', e);
        }
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
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
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

  // STABLE task numbers - based on creation order, never changes when tasks move!
  const numberedTasks = useMemo(() => {
    // Sort by createdAt date (oldest first) to get stable numbers
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

  // Command handler
  const handleVoiceCommand = useCallback((command) => {
    console.log('Processing command:', command);
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
    if (lower.includes('status') || lower.includes('report') || lower.includes('briefing')) {
      giveStatusReport();
      return;
    }

    // Focus suggestion
    if (lower.includes('focus') || lower.includes('suggest') || lower.includes('what should i')) {
      giveFocusSuggestion();
      return;
    }

    // What is task X
    if (lower.includes('what is task') || lower.includes('what\'s task') || lower.includes('task info')) {
      const num = extractNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          const columnName = columns.find(c => c.id === task.status)?.title || task.status;
          const msg = getRandomInsight('taskInfo', { number: num, task: task.title, status: columnName, impact: task.impact || 'Medium' });
          setArgusMessage(msg);
          speak(msg);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num });
          setArgusMessage(msg);
          speak(msg);
        }
      }
      return;
    }

    // What's stale
    if (lower.includes('stale') || lower.includes('old') || lower.includes('neglected')) {
      const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
      if (staleTasks.length === 0) {
        const msg = "No stale tasks. Everything is fresh.";
        setArgusMessage(msg);
        speak(msg);
      } else {
        const staleInfo = staleTasks.slice(0, 3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ');
        const msg = `${staleTasks.length} stale tasks: ${staleInfo}`;
        setArgusMessage(msg);
        speak(msg);
      }
      return;
    }

    // What's overdue
    if (lower.includes('overdue') || lower.includes('late') || lower.includes('past due')) {
      const overdueTasks = tasks.filter(isOverdue);
      if (overdueTasks.length === 0) {
        const msg = "No overdue tasks. You're on track.";
        setArgusMessage(msg);
        speak(msg);
      } else {
        const overdueInfo = overdueTasks.slice(0, 3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ');
        const msg = `${overdueTasks.length} overdue: ${overdueInfo}`;
        setArgusMessage(msg);
        speak(msg);
      }
      return;
    }

    // What's blocked
    if ((lower.includes('what') && lower.includes('blocked')) || (lower.includes('blocked') && !lower.includes('unblock') && !extractNumber(lower))) {
      const blockedTasks = tasks.filter(t => t.blocked);
      if (blockedTasks.length === 0) {
        const msg = "No blocked tasks. All clear.";
        setArgusMessage(msg);
        speak(msg);
      } else {
        const blockedInfo = blockedTasks.slice(0, 3).map(t => `Task ${numberedTasks.get(t.id)}`).join(', ');
        const msg = `${blockedTasks.length} blocked: ${blockedInfo}`;
        setArgusMessage(msg);
        speak(msg);
      }
      return;
    }

    // Move task X to column
    if (lower.includes('move')) {
      const num = extractNumber(lower);
      const columnId = findColumn(lower);
      
      console.log('Move command - num:', num, 'column:', columnId);
      
      if (num && columnId) {
        const task = getTaskByNumber(num);
        if (task) {
          moveTask(task, columnId, num);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num });
          setArgusMessage(msg);
          speak(msg);
        }
      } else if (!num) {
        const msg = "Which task number? Say: move task 5 to done.";
        setArgusMessage(msg);
        speak(msg);
      } else {
        const msg = "Which column? Try: backlog, ready, in progress, review, done, or parked.";
        setArgusMessage(msg);
        speak(msg);
      }
      return;
    }

    // Block task X
    if (lower.includes('block') && !lower.includes('unblock')) {
      const num = extractNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          toggleBlockTask(task, true, num);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num });
          setArgusMessage(msg);
          speak(msg);
        }
      }
      return;
    }

    // Unblock task X
    if (lower.includes('unblock')) {
      const num = extractNumber(lower);
      if (num) {
        const task = getTaskByNumber(num);
        if (task) {
          toggleBlockTask(task, false, num);
        } else {
          const msg = getRandomInsight('taskNotFound', { number: num });
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
  }, [tasks, numberedTasks, speak, getTaskByNumber, columns]);

  const { isListening, transcript, pendingCommand, startListening, stopListening } = useArgusListener(handleVoiceCommand);

  useEffect(() => { fetchTasks(); fetchArchivedTasks(); }, []);

  // Daily briefing
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

  // Update message based on board state
  useEffect(() => {
    if (tasks.length === 0 && !loading) {
      setArgusMessage(getRandomInsight('greeting'));
      return;
    }
    if (loading) return;

    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const overdueTasks = tasks.filter(isOverdue);
    const wipExceededCols = columns.filter(col => col.wipLimit && tasks.filter(t => t.status === col.id).length > col.wipLimit);

    let message = '';
    if (overdueTasks.length > 0) {
      message = getRandomInsight('overdue', { count: overdueTasks.length });
    } else if (staleTasks.length > 0) {
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

  const giveDailyBriefing = () => {
    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const overdueTasks = tasks.filter(isOverdue);
    
    let suggestion = '';
    const readyHighImpact = tasks.find(t => t.status === 'ready' && t.impact === 'High' && !t.blocked);
    if (readyHighImpact) {
      const num = numberedTasks.get(readyHighImpact.id);
      suggestion = `I suggest starting with task ${num}.`;
    } else if (inProgressTasks.length > 0) {
      const num = numberedTasks.get(inProgressTasks[0].id);
      suggestion = `Continue with task ${num}.`;
    }

    const report = getRandomInsight('dailyBriefing', {
      total: tasks.length,
      inProgress: inProgressTasks.length,
      blocked: blockedTasks.length,
      stale: staleTasks.length,
      overdue: overdueTasks.length,
      suggestion,
    });

    setArgusMessage(report);
    speak(report);
  };

  const giveStatusReport = () => {
    const staleTasks = tasks.filter(t => daysSince(t.lastSessionDate) >= 14);
    const blockedTasks = tasks.filter(t => t.blocked);
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const overdueTasks = tasks.filter(isOverdue);
    const completedThisWeek = tasks.filter(t => t.completedDate && daysSince(t.completedDate) <= 7);

    const report = getRandomInsight('statusReport', {
      total: tasks.length,
      inProgress: inProgressTasks.length,
      blocked: blockedTasks.length,
      stale: staleTasks.length,
      overdue: overdueTasks.length,
      completed: completedThisWeek.length,
    });

    setArgusMessage(report);
    speak(report);

    if (completedThisWeek.length >= 3) {
      setTimeout(() => {
        const streak = getRandomInsight('streak', { count: completedThisWeek.length });
        speak(streak);
      }, 4000);
    }
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

  const moveTask = async (task, columnId, taskNumber) => {
    const now = new Date().toISOString().split('T')[0];
    const updates = { ...task, status: columnId, lastSessionDate: now };
    
    if (columnId === 'in-progress' && !task.startDate) updates.startDate = now;
    
    const columnName = columns.find(c => c.id === columnId)?.title || columnId;
    let msg;
    
    if (columnId === 'done' && !task.completedDate) {
      updates.completedDate = now;
      msg = getRandomInsight('taskCompleted', { number: taskNumber || numberedTasks.get(task.id), task: task.title });
    } else {
      msg = getRandomInsight('taskMoved', { number: taskNumber || numberedTasks.get(task.id), task: task.title, column: columnName });
    }
    
    setTasks(tasks.map(t => t.id === task.id ? updates : t));
    setArgusMessage(msg);
    speak(msg);
    
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

  const toggleBlockTask = async (task, blocked, taskNumber) => {
    const updated = { ...task, blocked };
    setTasks(tasks.map(t => t.id === task.id ? updated : t));
    
    const msg = blocked 
      ? getRandomInsight('taskBlocked', { number: taskNumber || numberedTasks.get(task.id), task: task.title })
      : getRandomInsight('taskUnblocked', { number: taskNumber || numberedTasks.get(task.id), task: task.title });
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
    await moveTask(draggedTask, columnId);
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
        setTasks([...tasks, data.task]); // Add to end to get highest number
        const newNum = tasks.length + 1;
        const msg = getRandomInsight('taskCreated', { number: newNum });
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
      setTasks([...tasks, { ...task, archivedAt: null }]);
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
    await toggleBlockTask(task, !task.blocked);
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
  const overdueTasks = tasks.filter(isOverdue);
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    blocked: tasks.filter(t => t.blocked).length,
    stale: staleTasks.length,
    overdue: overdueTasks.length,
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
            <div style={styles.stat}><span style={{...styles.statValue, color: '#22c55e'}}>{stats.completedThisWeek}</span><span style={styles.statLabel}>This Week</span></div>
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
              {isListening && !transcript && <p style={styles.awakeText}>🎤 Say "Argus" followed by your command...</p>}
            </div>
          </div>
          <div style={styles.argusPanelActions}>
            {isListening ? (
              <button onClick={stopListening} style={{...styles.micButton, ...styles.micButtonActive}}>🎤</button>
            ) : (
              <button onClick={startListening} style={styles.micButton}>🎤</button>
            )}
            {isSpeaking ? (
              <button onClick={stop} style={styles.voiceButton}>🔇</button>
            ) : (
              <button onClick={() => speak(argusMessage)} style={{...styles.voiceButton, opacity: voiceEnabled ? 1 : 0.5}} disabled={!voiceEnabled}>🔊</button>
            )}
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
              <input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} style={styles.checkbox} />
              Enable Voice
            </label>
            {voices.length > 0 && (
              <select value={selectedVoice?.name || ''} onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))} style={styles.voiceSelect} disabled={!voiceEnabled}>
                {voices.filter(v => v.lang.startsWith('en')).map(voice => (
                  <option key={voice.name} value={voice.name}>{voice.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => speak("Argus online. Voice confirmed.")} style={styles.testVoiceButton} disabled={!voiceEnabled}>Test</button>
          </div>
          <div style={styles.commandHints}>
            <strong>Say:</strong> "Argus, move task 2 to done" • "Argus, status" • "Argus, what is task 3" • "Argus, focus"
          </div>
          <div style={styles.stableNumberNote}>
            ℹ️ Task numbers are stable — they don't change when tasks move between columns.
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
            Stale &gt; 14d
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
          {task.blocked && <span style={styles.blockedBadge}>🚫</span>}
          {overdue && <span style={styles.overdueBadge}>⏰</span>}
          {isStale && <span style={styles.staleBadgeCard}>👁</span>}
        </div>
      </div>
      <h3 style={styles.cardTitle}>{task.title}</h3>
      {task.nextAction && <p style={styles.nextAction}><strong>→</strong> {task.nextAction}</p>}
      <div style={styles.cardFooter}>
        <div style={styles.cardMeta}>
          {task.effort && <span style={styles.effortBadge}>{task.effort}</span>}
          {task.impact && <span style={{...styles.impactBadge, backgroundColor: task.impact === 'High' ? '#dcfce7' : task.impact === 'Medium' ? '#fef3c7' : '#f1f5f9', color: task.impact === 'High' ? '#166534' : task.impact === 'Medium' ? '#92400e' : '#475569'}}>{task.impact}</span>}
        </div>
        {stale !== null && <span style={{...styles.staleBadge, color: isStale ? '#f59e0b' : '#64748b'}}>{stale}d</span>}
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
              <label style={styles.checkboxLabel}><input type="checkbox" checked={form.blocked || false} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} style={styles.checkbox} />Blocked</label>
              {form.blocked && <input type="text" placeholder="Reason..." value={form.blockerReason || ''} onChange={(e) => setForm({ ...form, blockerReason: e.target.value })} style={{...styles.input, marginTop: '8px'}} />}
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}><label style={styles.label}>Due</label><input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Start</label><input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={styles.input} /></div>
              <div style={styles.formGroup}><label style={styles.label}>Done</label><input type="date" value={form.completedDate || ''} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} style={styles.input} /></div>
            </div>
            <div style={styles.sectionTitle}>Session Context</div>
            <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={form.sessionNotes || ''} onChange={(e) => setForm({ ...form, sessionNotes: e.target.value })} style={styles.textarea} rows={2} placeholder="Where we left off..." /></div>
            <div style={styles.formGroup}><label style={styles.label}>Next Action</label><input type="text" value={form.nextAction || ''} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} style={styles.input} placeholder="The very next step..." /></div>
            <div style={styles.formGroup}><label style={styles.label}>Repo / URL</label><input type="text" value={form.repoUrl || ''} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} style={styles.input} placeholder="https://..." /></div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tech Stack</label>
              <div style={styles.techInputRow}><input type="text" value={techInput} onChange={(e) => setTechInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTech())} style={{...styles.input, flex: 1}} placeholder="Add tech..." /><button type="button" onClick={addTech} style={styles.addTechBtn}>+</button></div>
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
  container: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif" },
  loadingContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' },
  argusEyeLoading: { fontSize: '64px', animation: 'pulse 2s ease-in-out infinite' },
  loadingText: { fontSize: '18px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' },
  errorContainer: { minHeight: '100vh', backgroundColor: '#0a0f1a', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 100%)' },
  headerLeft: {},
  headerRight: {},
  logoContainer: { display: 'flex', alignItems: 'center', gap: '12px' },
  argusLogo: { width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)', transition: 'all 0.3s ease' },
  argusLogoSpeaking: { boxShadow: '0 0 30px rgba(124, 58, 237, 0.8), 0 0 60px rgba(124, 58, 237, 0.4)', animation: 'pulse 0.5s ease-in-out infinite' },
  argusLogoListening: { boxShadow: '0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.4)', background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)' },
  eyeIcon: { fontSize: '24px' },
  title: { fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '3px', background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  subtitle: { margin: '2px 0 0 0', color: '#64748b', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' },
  statsRow: { display: 'flex', gap: '20px' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statValue: { fontSize: '20px', fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' },
  argusPanel: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)', borderBottom: '1px solid rgba(124, 58, 237, 0.3)', transition: 'all 0.3s ease' },
  argusPanelListening: { background: 'linear-gradient(135deg, rgba(22, 101, 52, 0.3) 0%, rgba(34, 197, 94, 0.3) 100%)', borderBottom: '1px solid rgba(34, 197, 94, 0.5)' },
  argusPanelContent: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 },
  argusPanelText: { flex: 1 },
  argusPanelEye: { fontSize: '18px', transition: 'all 0.3s ease' },
  argusPanelEyeSpeaking: { animation: 'pulse 0.5s ease-in-out infinite', filter: 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.8))' },
  argusPanelMessage: { margin: 0, fontSize: '13px', color: '#c4b5fd', fontStyle: 'italic' },
  transcriptText: { margin: '4px 0 0 0', fontSize: '12px', color: '#86efac', fontFamily: 'monospace' },
  pendingIndicator: { color: '#fbbf24' },
  awakeText: { margin: '4px 0 0 0', fontSize: '11px', color: '#86efac' },
  argusPanelActions: { display: 'flex', alignItems: 'center', gap: '6px' },
  micButton: { padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' },
  micButtonActive: { backgroundColor: '#22c55e', animation: 'pulse 1s ease-in-out infinite' },
  voiceButton: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' },
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
  stableNumberNote: { marginTop: '4px', fontSize: '10px', color: '#22c55e' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #1e293b', backgroundColor: '#0a0f1a', flexWrap: 'wrap', gap: '10px' },
  filters: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  select: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '13px', cursor: 'pointer' },
  searchInput: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', fontSize: '13px', width: '160px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer' },
  checkbox: { cursor: 'pointer' },
  actions: { display: 'flex', gap: '10px' },
  button: { padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
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
  column: { minWidth: '280px', maxWidth: '280px', backgroundColor: '#111827', borderRadius: '10px', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', border: '1px solid #1e293b' },
  columnOverLimit: { boxShadow: '0 0 0 2px #ef4444' },
  columnHeader: { padding: '12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  columnTitle: { margin: 0, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  columnMeta: { display: 'flex', alignItems: 'center', gap: '6px' },
  columnCount: { backgroundColor: '#1e293b', padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' },
  wipLimit: { fontSize: '9px', color: '#64748b', padding: '2px 5px', borderRadius: '4px', backgroundColor: '#0f172a' },
  wipLimitExceeded: { backgroundColor: '#7f1d1d', color: '#fca5a5' },
  columnBody: { padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' },
  card: { backgroundColor: '#0f172a', borderRadius: '8px', padding: '12px', cursor: 'grab', borderLeft: '4px solid', transition: 'all 0.2s', position: 'relative' },
  cardBlocked: { opacity: 0.7, background: 'repeating-linear-gradient(45deg, #0f172a, #0f172a 10px, #1a1a2e 10px, #1a1a2e 20px)' },
  cardStale: { boxShadow: 'inset 0 0 0 1px #f59e0b' },
  cardOverdue: { boxShadow: 'inset 0 0 0 2px #dc2626' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' },
  taskNumberBadge: { backgroundColor: '#7c3aed', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', fontFamily: 'monospace' },
  tag: { padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', color: '#fff' },
  cardBadges: { marginLeft: 'auto', display: 'flex', gap: '3px' },
  blockedBadge: { fontSize: '10px' },
  overdueBadge: { fontSize: '10px' },
  staleBadgeCard: { fontSize: '10px', color: '#fbbf24' },
  cardTitle: { margin: '0 0 6px 0', fontSize: '13px', fontWeight: '600', lineHeight: '1.3' },
  nextAction: { margin: '0 0 6px 0', fontSize: '11px', color: '#94a3b8', lineHeight: '1.3' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { display: 'flex', gap: '4px' },
  effortBadge: { padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', backgroundColor: '#334155', color: '#94a3b8' },
  impactBadge: { padding: '2px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: '600' },
  staleBadge: { fontSize: '10px' },
  cardActions: { position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '3px', opacity: 0, transition: 'opacity 0.2s' },
  cardActionBtn: { padding: '3px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', cursor: 'pointer', fontSize: '10px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modal: { backgroundColor: '#111827', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', border: '1px solid #1e293b' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e293b' },
  modalTitle: { margin: 0, fontSize: '18px', fontWeight: '600' },
  closeButton: { background: 'none', border: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer', lineHeight: 1 },
  form: { padding: '20px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '14px' },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '13px' },
  textarea: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#e2e8f0', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' },
  sectionTitle: { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '6px', paddingTop: '14px', borderTop: '1px solid #1e293b' },
  techInputRow: { display: 'flex', gap: '6px' },
  addTechBtn: { padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#334155', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer' },
  techTags: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' },
  techTag: { display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#334155', fontSize: '11px' },
  removeTechBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0, marginLeft: '2px' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #1e293b' },
  modalFooterRight: { display: 'flex', gap: '10px' },
  deleteButton: { padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
};
