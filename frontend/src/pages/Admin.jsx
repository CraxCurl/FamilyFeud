import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Play, RotateCcw, FastForward, Check, X, ShieldAlert, Sparkles, Plus, Trash2, Copy, FileCode, Search, HelpCircle, Eye, EyeOff, Trophy, RefreshCw, Key } from 'lucide-react';

export default function Admin() {
  const { socket, adminState } = useSocket();
  const fileInputRef = useRef(null);

  // Auth States
  const [adminKey, setAdminKey] = useState(localStorage.getItem('feud_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');

  // Question Builder States
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('Campus');
  const [newAnswers, setNewAnswers] = useState([
    { text: '', points: 0 },
    { text: '', points: 0 },
    { text: '', points: 0 },
    { text: '', points: 0 }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [builderTab, setBuilderTab] = useState('controls'); // controls, builder
  
  // Register as Admin when key or socket changes
  useEffect(() => {
    if (socket && adminKey) {
      socket.emit('admin_register', { key: adminKey });
    }
  }, [socket, adminKey]);

  // Auth response listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('admin_auth_failed', () => {
      setIsAuthenticated(false);
      setAuthError('Invalid Access Key');
      localStorage.removeItem('feud_admin_key');
    });

    // When admin state is successfully received, it implies they are registered & authenticated
    socket.on('admin_state_update', () => {
      setIsAuthenticated(true);
      setAuthError('');
    });

    return () => {
      socket.off('admin_auth_failed');
      socket.off('admin_state_update');
    };
  }, [socket]);

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!passcodeInput.trim()) return;

    localStorage.setItem('feud_admin_key', passcodeInput);
    setAdminKey(passcodeInput);
    if (socket) {
      socket.emit('admin_register', { key: passcodeInput });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('feud_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
    setPasscodeInput('');
    window.location.reload();
  };

  const sendControl = (action, payload = {}) => {
    if (socket) {
      socket.emit('admin_game_control', { action, payload, key: adminKey });
    }
  };

  // Add Answer Row helper
  const addAnswerRow = () => {
    setNewAnswers([...newAnswers, { text: '', points: 0 }]);
  };

  // Save/Create Question
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    const filteredAnswers = newAnswers
      .filter(a => a.text.trim())
      .map(a => ({ text: a.text.trim(), points: parseInt(a.points) || 0 }))
      .sort((a, b) => b.points - a.points);

    if (filteredAnswers.length === 0) return alert("Add at least one answer.");

    const questionObj = {
      question: newQuestion,
      category: newCategory,
      answers: filteredAnswers
    };

    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/questions',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-key': adminKey
          },
          body: JSON.stringify(questionObj)
        }
      );
      if (response.ok) {
        setNewQuestion('');
        setNewAnswers([
          { text: '', points: 0 },
          { text: '', points: 0 },
          { text: '', points: 0 },
          { text: '', points: 0 }
        ]);
        alert("Question Saved!");
        sendControl('REFRESH_QUESTIONS');
      } else {
        alert("Authorization failed / Server Error.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving question.");
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + `/api/questions/${id}`,
        { 
          method: 'DELETE',
          headers: {
            'x-admin-key': adminKey
          }
        }
      );
      if (response.ok) {
        alert("Question deleted!");
      } else {
        alert("Delete authorization failed.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Duplicate Question Helper
  const handleDuplicate = (q) => {
    setNewQuestion(q.question);
    setNewCategory(q.category);
    setNewAnswers(q.answers.map(a => ({ text: a.text, points: a.points })));
    setBuilderTab('builder');
  };

  // Export JSON Questions
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminState.allQuestions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "family_feud_questions.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON Questions
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          for (const q of parsed) {
            await fetch(
              (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/questions',
              {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'x-admin-key': adminKey
                },
                body: JSON.stringify(q)
              }
            );
          }
          alert("Import complete! Refreshing page details.");
          window.location.reload();
        } else {
          alert("Invalid file format. Must be a JSON array of questions.");
        }
      } catch (err) {
        alert("Error parsing file.");
      }
    };
    reader.readAsText(file);
  };

  // Render Login Panel if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-sm p-8 rounded-2xl glass-panel relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neonPurple to-neonPink" />
          
          <div className="w-12 h-12 bg-neonPurple/10 border border-neonPurple/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6 text-neonPurple" />
          </div>

          <h2 className="text-2xl font-extrabold text-white">Enter Host Passkey</h2>
          <p className="text-xs text-gray-400 mt-1 mb-6">Authorization required to access game controls</p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Enter Admin Key..."
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-center focus:outline-none focus:border-neonPurple/50"
            />
            {authError && <p className="text-xs text-red-500 font-semibold">{authError}</p>}
            
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-neonPurple to-neonPink rounded-xl font-bold text-white shadow-neonPurple hover:opacity-90 active:scale-[0.98] transition"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Loader if adminState is not synced yet
  if (!adminState) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center">
        <div>
          <div className="w-10 h-10 border-2 border-dashed border-neonPurple animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading Dashboard Sync...</p>
        </div>
      </div>
    );
  }

  // Filter questions list
  const filteredQs = (adminState.allQuestions || []).filter(q =>
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 md:p-10 select-none">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-neonPurple via-neonPink to-neonCyan text-glow-purple">
            HOST CONTROLS
          </h1>
          <p className="text-xs text-gray-500 font-semibold tracking-widest uppercase">VIT Chennai Android Club</p>
        </div>

        {/* Tab Selection & Logout */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl">
            <button
              onClick={() => setBuilderTab('controls')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                builderTab === 'controls' ? 'bg-gradient-to-r from-neonPurple to-neonPink text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Game Controls
            </button>
            <button
              onClick={() => setBuilderTab('builder')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                builderTab === 'builder' ? 'bg-gradient-to-r from-neonPurple to-neonPink text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Question Builder
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="px-3.5 py-2.5 bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-red-400 rounded-xl transition"
          >
            Lock Dashboard
          </button>
        </div>
      </div>

      {builderTab === 'controls' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Controls Grid */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Status Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neonPurple to-neonPink" />
              
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <h3 className="font-bold text-white text-lg">Game Operations</h3>
                <span className="px-3 py-1 bg-pink-500/10 border border-pink-500/30 rounded-lg text-pink-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                  STATUS: {adminState.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {adminState.status === 'LOBBY' ? (
                  <button
                    onClick={() => sendControl('START_GAME')}
                    className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 text-emerald-400 font-bold transition group"
                  >
                    <Play className="w-6 h-6 mb-2 group-hover:scale-110 transition" />
                    Start Game
                  </button>
                ) : (
                  <button
                    onClick={() => sendControl('RESET_GAME')}
                    className="flex flex-col items-center justify-center p-4 bg-red-500/10 border border-red-500/30 rounded-xl hover:bg-red-500/20 text-red-400 font-bold transition group"
                  >
                    <RotateCcw className="w-6 h-6 mb-2 group-hover:rotate-45 transition" />
                    New Game
                  </button>
                )}

                <button
                  onClick={() => sendControl('START_QUESTION')}
                  disabled={adminState.status !== 'PLAYING'}
                  className="flex flex-col items-center justify-center p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 text-cyan-400 font-bold transition group disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkles className="w-6 h-6 mb-2 group-hover:animate-bounce transition" />
                  Start Question
                </button>

                <button
                  onClick={() => sendControl('PREV_ROUND')}
                  disabled={adminState.status !== 'PLAYING'}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white font-bold transition disabled:opacity-50"
                >
                  <FastForward className="w-6 h-6 mb-2 rotate-180" />
                  Prev Round
                </button>

                <button
                  onClick={() => sendControl('NEXT_ROUND')}
                  disabled={adminState.status !== 'PLAYING'}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white font-bold transition group disabled:opacity-50"
                >
                  <FastForward className="w-6 h-6 mb-2 group-hover:translate-x-1 transition" />
                  Next Round / End
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <button
                  onClick={() => sendControl('PAUSE_GAME')}
                  className="py-2.5 bg-white/5 border border-white/10 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition"
                >
                  Stop Timer
                </button>
                <button
                  onClick={() => sendControl('RESET_BUZZ')}
                  className="py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold rounded-xl transition"
                >
                  Unlock Buzzer
                </button>
                <button
                  onClick={() => sendControl('SKIP_QUESTION')}
                  className="py-2.5 bg-white/5 border border-white/10 text-xs font-semibold rounded-xl text-gray-400 hover:text-white transition"
                >
                  Skip Question
                </button>
              </div>
            </div>

            {/* Current Question Status */}
            {adminState.currentQuestion && (
              <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neonCyan to-neonPurple" />
                
                <h3 className="font-bold text-white text-lg mb-2">Round {adminState.currentRound}: Question Panel</h3>
                <p className="text-xl font-bold text-neonCyan mb-6">“{adminState.currentQuestion.question}”</p>

                {/* Answers List */}
                <div className="space-y-3">
                  <span className="text-xs text-gray-500 uppercase font-semibold">Answer Board Control</span>
                  {adminState.currentQuestion.answers.map((ans, idx) => {
                    const isRevealed = adminState.revealedAnswers[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!isRevealed) {
                            sendControl('REVEAL_ANSWER', { 
                              index: idx, 
                              awardToTeam: adminState.activeInputTeam || undefined 
                            });
                          }
                        }}
                        className={`flex justify-between items-center p-3 rounded-xl border transition ${
                          isRevealed 
                            ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default' 
                            : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-gray-400">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-white">{ans.text}</span>
                        </div>

                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className="font-extrabold text-neonPink text-sm mr-2">{ans.points} Pts</span>
                          {isRevealed ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendControl('HIDE_ANSWER', { index: idx });
                              }}
                              className="px-3 py-1.5 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <EyeOff className="w-3.5 h-3.5" /> Mask
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendControl('REVEAL_ANSWER', { index: idx });
                                }}
                                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> Reveal Only
                              </button>
                              
                              {Object.keys(adminState.teams).map(tName => (
                                <button
                                  key={tName}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendControl('REVEAL_ANSWER', { index: idx, awardToTeam: tName });
                                  }}
                                  className="px-2 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  + {tName === 'Team Alpha' ? 'Alpha' : tName === 'Team Beta' ? 'Beta' : tName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Strikes controller */}
                <div className="mt-8 border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-semibold block mb-1">Strikes Control</span>
                    <div className="flex gap-2 text-2xl font-black text-red-500">
                      {Array(3).fill(null).map((_, i) => (
                        <span key={i} className={i < adminState.strikes ? 'opacity-100' : 'opacity-20'}>X</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => sendControl('ADD_STRIKE')}
                      className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-bold text-xs flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-4 h-4" /> Trigger Strike (X)
                    </button>
                    <button
                      onClick={() => sendControl('RESET_STRIKES')}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-gray-400 rounded-xl font-bold text-xs"
                    >
                      Clear Strikes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right/Side Panel: Teams & Devices */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Active Team Turn Panel */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-neonCyan" />
              <h3 className="font-bold text-white text-lg mb-4">Active Team Turn</h3>
              {adminState.activeInputTeam ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 block font-semibold">NOW PLAYING</span>
                  <span className="font-black text-neonCyan text-lg block my-1">{adminState.activeInputTeam}</span>
                  <div className="text-xs text-gray-300 font-bold mb-4">
                    <span className="text-neonPink">{adminState.timer || 0}s</span> &middot; turn {adminState.turnsTaken?.[adminState.activeInputTeam] || 0} of {adminState.turnsPerTeam || 3}
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: 10 })}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold"
                    >
                      +10 Pts
                    </button>
                    <button
                      onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: 50 })}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold"
                    >
                      +50 Pts
                    </button>
                    <button
                      onClick={() => sendControl('AWARD_POINTS', { team: adminState.activeInputTeam, points: -10 })}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold"
                    >
                      -10 Pts
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">Start a turn cycle to put a team on the clock.</p>
              )}
            </div>

            {/* Live Buzzer State Panel */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neonPink to-neonCyan" />
              
              <h3 className="font-bold text-white text-lg mb-4">Live Buzzer</h3>
              
              {adminState.buzzState.locked ? (
                <div className="p-4 bg-neonPink/10 border border-neonPink/30 rounded-xl text-center">
                  <div className="w-10 h-10 bg-neonPink rounded-full flex items-center justify-center font-bold text-white text-lg mx-auto mb-2 text-glow-pink">
                    🔥
                  </div>
                  <span className="text-xs text-gray-400 block font-semibold">BUZZ WINNER</span>
                  <span className="font-black text-white text-lg block">{adminState.buzzState.player?.name}</span>
                  <span className="text-xs text-neonCyan font-bold">{adminState.buzzState.team}</span>

                  <button
                    onClick={() => sendControl('RESET_BUZZ')}
                    className="mt-4 w-full py-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 rounded-xl text-xs font-bold transition"
                  >
                    Unlock Buzzer
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 text-xs font-semibold border border-dashed border-white/10 rounded-xl">
                  Buzzer Open
                </div>
              )}
            </div>

            {/* Teams & Scores */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-bold text-white text-lg mb-4">Teams & Scores</h3>
              {Object.keys(adminState.teams).length === 0 ? (
                <p className="text-xs text-gray-500">No teams registered yet.</p>
              ) : (
                <div className="space-y-4">
                  {Object.keys(adminState.teams).map(tName => {
                    const team = adminState.teams[tName];
                    return (
                      <div key={tName} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-white text-sm truncate">{tName}</span>
                          <span className="font-extrabold text-neonCyan">{team.score || 0} Pts</span>
                        </div>

                        <div className="flex gap-1.5 mb-3">
                          <button
                            onClick={() => sendControl('AWARD_POINTS', { team: tName, points: 10 })}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/5"
                          >
                            +10
                          </button>
                          <button
                            onClick={() => sendControl('AWARD_POINTS', { team: tName, points: -10 })}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/5"
                          >
                            -10
                          </button>
                          <button
                            onClick={() => sendControl('AWARD_POINTS', { team: tName, points: 50 })}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/5"
                          >
                            +50
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                          <span>{team.members?.length || 0} Players</span>
                          <button
                            onClick={() => sendControl('REMOVE_TEAM', { team: tName })}
                            className="text-red-400 hover:text-red-300 underline"
                          >
                            Remove Team
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Connected Devices */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-bold text-white text-lg mb-2">Connected Devices</h3>
              <p className="text-[10px] text-gray-500 mb-4 uppercase font-bold">Real-time player socket connections</p>
              
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {adminState.players.map((p, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg text-xs">
                    <div className="truncate">
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="text-gray-500 text-[10px] ml-1.5">({p.team})</span>
                    </div>

                    <button
                      onClick={() => sendControl('FORCE_BUZZ_WINNER', { player: { name: p.name, socketId: p.socketId }, team: p.team })}
                      className="text-[9px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold uppercase"
                    >
                      Force Buzz
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* TAB: QUESTION BUILDER & MANAGEMENT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Add Question Form */}
          <form onSubmit={handleSaveQuestion} className="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-white text-lg border-b border-white/5 pb-2">Add New Survey Question</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Survey Question</label>
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Name something every VIT student carries..."
                required
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-neonPurple/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-darkBg border border-white/10 rounded-xl text-white focus:outline-none focus:border-neonPurple/50"
              >
                <option value="Campus">Campus</option>
                <option value="Food">Food</option>
                <option value="Academics">Academics</option>
                <option value="Hostel">Hostel</option>
                <option value="Events">Events</option>
                <option value="Android Club">Android Club</option>
                <option value="Funny">Funny</option>
              </select>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Answers & Points</label>
              {newAnswers.map((ans, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={ans.text}
                    onChange={(e) => {
                      const updated = [...newAnswers];
                      updated[idx].text = e.target.value;
                      setNewAnswers(updated);
                    }}
                    placeholder={`Answer #${idx + 1}`}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                  <input
                    type="number"
                    value={ans.points || ''}
                    onChange={(e) => {
                      const updated = [...newAnswers];
                      updated[idx].points = parseInt(e.target.value) || 0;
                      setNewAnswers(updated);
                    }}
                    placeholder="Pts"
                    className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={addAnswerRow}
                className="flex-1 py-2 bg-white/5 border border-white/10 text-xs font-semibold rounded-xl text-gray-300 hover:text-white transition"
              >
                + Add Answer Row
              </button>
              
              <button
                type="submit"
                className="flex-1 py-2 bg-gradient-to-r from-neonPurple to-neonPink text-xs font-bold rounded-xl text-white"
              >
                Save Question
              </button>
            </div>
          </form>

          {/* Questions List & JSON Import/Export */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="glass-panel p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-sm">Bulk Management</h4>
                <p className="text-[10px] text-gray-500">Backup or restore survey database</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExportJSON}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 font-bold flex items-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5" /> Export JSON
                </button>

                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleImportJSON}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl text-xs text-cyan-400 font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Import JSON
                </button>
              </div>
            </div>

            {/* Questions Search list */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions or categories..."
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-neonPurple/50"
                />
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredQs.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="px-2 py-0.5 bg-neonPurple/10 border border-neonPurple/20 text-neonPurple rounded text-[9px] font-bold uppercase tracking-wider">
                          {q.category}
                        </span>
                        <h4 className="font-bold text-white text-sm mt-1">{q.question}</h4>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDuplicate(q)}
                          className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded transition"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500">
                      <strong>Answers:</strong> {q.answers.map(a => `${a.text} (${a.points})`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
