import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Play, RotateCcw, FastForward, Check, X, ShieldAlert, Sparkles, Plus, Trash2, Copy, FileCode, Search, HelpCircle, Eye, EyeOff, Trophy, RefreshCw, Key, Settings } from 'lucide-react';

export default function Admin() {
  const { socket, adminState, gameState } = useSocket();
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

    socket.on('admin_state_update', () => {
      setIsAuthenticated(true);
      setAuthError('');
    });

    return () => {
      socket.off('admin_auth_failed');
      socket.off('admin_state_update');
    };
  }, [socket]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        (import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`) + '/api/admin/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: passcodeInput })
        }
      );
      const data = await response.json();
      if (data.success) {
        setAdminKey(passcodeInput);
        localStorage.setItem('feud_admin_key', passcodeInput);
        if (socket) {
          socket.emit('admin_register', { key: passcodeInput });
        }
        setAuthError('');
      } else {
        setAuthError('Invalid Access Key');
      }
    } catch (err) {
      setAuthError('Failed to authenticate with server');
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

  const addAnswerRow = () => {
    setNewAnswers([...newAnswers, { text: '', points: 0 }]);
  };

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
        sendControl('REFRESH_QUESTIONS');
      } else {
        alert("Delete authorization failed.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = (q) => {
    setNewQuestion(q.question);
    setNewCategory(q.category);
    setNewAnswers(q.answers.map(a => ({ text: a.text, points: a.points })));
    setBuilderTab('builder');
  };

  const handleExportJSON = () => {
    if (!adminState?.allQuestions) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminState.allQuestions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "family_feud_questions.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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
          alert("Import complete! Refreshing page.");
          sendControl('REFRESH_QUESTIONS');
        } else {
          alert("Invalid file format. Must be a JSON array of questions.");
        }
      } catch (err) {
        alert("Error parsing file.");
      }
    };
    reader.readAsText(file);
  };

  // Filtered list of questions based on search query
  const filteredQs = (adminState?.allQuestions || []).filter(q => 
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render Login Panel if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF6EE] px-4 py-8">
        <div className="w-full max-w-sm p-8 bg-white border-2 border-[#0D483F] shadow-[8px_8px_0_#0D483F] relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPurple to-neonCyan" />
          
          <div className="w-12 h-12 bg-neonPurple/10 border-2 border-[#0D483F]/20 rounded-none flex items-center justify-center mx-auto mb-4 text-[#0D483F]">
            <Key className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-condensed font-black uppercase text-[#0D483F]">Enter Host Passkey</h2>
          <p className="text-xs font-semibold text-[#0D483F]/60 mt-1 mb-6">Authorization required to access game controls</p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Enter Admin Key..."
              required
              className="w-full px-4 py-3 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] text-center font-bold focus:outline-none focus:border-neonPurple/55 placeholder-[#0D483F]/40"
            />
            {authError && <p className="text-xs text-red-600 font-semibold">{authError}</p>}
            
            <button
              type="submit"
              className="w-full py-3 bg-[#D2F128] text-[#0D483F] border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider rounded-none text-base hover:bg-[#0D483F] hover:text-white transition cursor-pointer shadow-[4px_4px_0_#0D483F] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
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
      <div className="flex items-center justify-center min-h-screen bg-[#FAF6EE]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-dashed border-[#0D483F] animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-[#0D483F]">Syncing Admin Game State...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#112521] p-4 md:p-8 flex flex-col items-center">
      {/* Dashboard Header */}
      <div className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 bg-white px-6 py-4 border-2 border-[#0D483F] shadow-[4px_4px_0_#0D483F]">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-neonPurple" />
          <h1 className="text-xl md:text-2xl font-condensed font-black uppercase text-[#0D483F] tracking-tight">Host Administration Panel</h1>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setBuilderTab('controls')}
            className={`px-4 py-2 border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-xs transition cursor-pointer ${
              builderTab === 'controls' ? 'bg-[#0D483F] text-white shadow-[2px_2px_0_#D2F128]' : 'bg-white text-[#0D483F]'
            }`}
          >
            Controls
          </button>
          <button
            onClick={() => setBuilderTab('builder')}
            className={`px-4 py-2 border-2 border-[#0D483F] font-condensed font-bold uppercase tracking-wider text-xs transition cursor-pointer ${
              builderTab === 'builder' ? 'bg-[#0D483F] text-white shadow-[2px_2px_0_#D2F128]' : 'bg-white text-[#0D483F]'
            }`}
          >
            Builder
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-red-600 bg-white text-red-600 font-condensed font-bold uppercase tracking-wider text-xs transition cursor-pointer hover:bg-red-50 hover:text-red-700"
          >
            Logout Lock
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl">
        {builderTab === 'controls' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Game Control Operations */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Game Operations status card */}
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 rounded-none relative">
                <div className="flex justify-between items-center mb-6 border-b border-[#0D483F]/10 pb-4">
                  <h3 className="font-bold text-[#0D483F] text-lg uppercase font-condensed">Game Status</h3>
                  <span className="px-3 py-1 bg-neonPink/10 border border-neonPink/30 rounded-lg text-neonPink text-xs font-bold uppercase tracking-wider">
                    {adminState.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {adminState.status === 'LOBBY' ? (
                    <button
                      onClick={() => sendControl('START_GAME')}
                      className="py-3 bg-emerald-600/10 border border-emerald-600/30 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Play className="w-4 h-4" /> Start Game
                    </button>
                  ) : (
                    <button
                      onClick={() => sendControl('RESET_GAME')}
                      className="py-3 bg-red-600/10 border border-red-600/30 text-red-700 text-xs font-bold rounded-lg hover:bg-red-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <RotateCcw className="w-4 h-4" /> New Game
                    </button>
                  )}

                  <button
                    onClick={() => sendControl('START_QUESTION')}
                    disabled={adminState.status === 'LOBBY' || adminState.status === 'GAME_OVER'}
                    className="py-3 bg-cyan-600/10 border border-cyan-600/30 text-cyan-700 text-xs font-bold rounded-lg hover:bg-cyan-600/20 transition disabled:opacity-40 cursor-pointer uppercase tracking-wider"
                  >
                    Restart Round
                  </button>
                  <button
                    onClick={() => sendControl('PREV_ROUND')}
                    disabled={adminState.status === 'LOBBY' || adminState.status === 'GAME_OVER'}
                    className="py-3 bg-neonPurple/5 border border-neonPurple/15 text-[#0D483F] text-xs font-bold rounded-lg hover:bg-neonPurple/10 transition disabled:opacity-40 cursor-pointer uppercase tracking-wider"
                  >
                    Prev Round
                  </button>
                  <button
                    onClick={() => sendControl('NEXT_ROUND')}
                    disabled={adminState.status === 'LOBBY' || adminState.status === 'GAME_OVER'}
                    className="py-3 bg-neonPurple/5 border border-neonPurple/15 text-[#0D483F] text-xs font-bold rounded-lg hover:bg-neonPurple/10 transition disabled:opacity-40 cursor-pointer uppercase tracking-wider"
                  >
                    Next / Finish
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-[#0D483F]/10">
                  <label className="text-xs text-[#0D483F]/70 font-semibold block">
                    Number of rounds
                    <select
                      value={adminState.maxRounds || 3}
                      disabled={adminState.status !== 'LOBBY'}
                      onChange={(e) => sendControl('UPDATE_SETTINGS', { maxRounds: Number(e.target.value) })}
                      className="mt-1.5 w-full px-3 py-2 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] disabled:opacity-50 font-bold"
                    >
                      <option value={1}>1 round</option>
                      <option value={2}>2 rounds</option>
                      <option value={3}>3 rounds</option>
                    </select>
                  </label>
                  <label className="text-xs text-[#0D483F]/70 font-semibold block">
                    Seconds per turn
                    <select
                      value={adminState.turnSeconds || 15}
                      disabled={adminState.status !== 'LOBBY'}
                      onChange={(e) => sendControl('UPDATE_SETTINGS', { turnSeconds: Number(e.target.value) })}
                      className="mt-1.5 w-full px-3 py-2 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] disabled:opacity-50 font-bold"
                    >
                      {[10, 15, 20, 30, 45, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-1">
                  <button
                    onClick={() => sendControl('PAUSE_GAME')}
                    className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] font-bold rounded cursor-pointer transition uppercase"
                  >
                    Pause Timer
                  </button>
                  <button
                    onClick={() => sendControl('RESET_BUZZ')}
                    className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] font-bold rounded cursor-pointer transition uppercase"
                  >
                    Restart Turn Cycle
                  </button>
                  <button
                    onClick={() => sendControl('SKIP_QUESTION')}
                    className="py-2 bg-neonPurple/5 border border-neonPurple/15 text-[10px] text-[#0D483F]/80 hover:text-[#0D483F] font-bold rounded cursor-pointer transition uppercase"
                  >
                    Skip Question
                  </button>
                </div>
              </div>

              {/* Reveals & Strikes board controls */}
              {adminState.currentQuestion && (
                <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 rounded-none space-y-4">
                  <span className="text-xs font-bold text-[#0D483F]/60 uppercase tracking-widest block border-b border-[#0D483F]/10 pb-1">Reveals & Strikes</span>
                  
                  <div className="bg-[#FAF6EE] p-4 border border-[#0D483F]/20 text-[#0D483F] mb-4">
                    <span className="text-[10px] text-neonPink uppercase font-bold tracking-wider">CURRENT SURVEY QUESTION</span>
                    <h4 className="text-lg font-bold mt-1 uppercase font-condensed">“{adminState.currentQuestion.question}”</h4>
                  </div>

                  <div className="space-y-2">
                    {adminState.currentQuestion.answers.map((ans, idx) => {
                      const isRevealed = adminState.revealedAnswers?.[idx];
                      return (
                        <div key={idx} className="flex justify-between items-center bg-neonPurple/5 px-3 py-2 border-2 border-[#0D483F]/10">
                          <span className="text-xs font-bold text-[#0D483F]">{idx+1}. {ans.text} ({ans.points} Pts)</span>
                          
                          <div className="flex gap-1.5">
                            {isRevealed ? (
                              <button
                                onClick={() => sendControl('HIDE_ANSWER', { index: idx })}
                                className="px-2.5 py-1 bg-pink-500/10 border border-pink-500/30 text-pink-500 rounded text-[10px] font-bold cursor-pointer"
                              >
                                Hide
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => sendControl('REVEAL_ANSWER', { index: idx })}
                                  className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Reveal Only
                                </button>
                                {Object.keys(adminState.teams).map(tName => (
                                  <button
                                    key={tName}
                                    onClick={() => sendControl('REVEAL_ANSWER', { index: idx, awardToTeam: tName })}
                                    className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 rounded text-[9px] font-bold cursor-pointer"
                                  >
                                    + {tName === 'Team Alpha' ? 'Alpha' : 'Beta'}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#0D483F]/10">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase block mb-1 font-bold">Active Strikes</span>
                      <div className="text-red-600 font-black text-2xl flex gap-1.5">
                        {Array(3).fill(null).map((_, i) => (
                          <span key={i} className={i < (adminState.strikes || 0) ? 'opacity-100' : 'opacity-25'}>X</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => sendControl('ADD_STRIKE')}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-600 font-bold text-xs cursor-pointer flex items-center gap-1 uppercase"
                      >
                        <ShieldAlert className="w-4 h-4" /> Trigger Strike (X)
                      </button>
                      <button
                        onClick={() => sendControl('RESET_STRIKES')}
                        className="px-4 py-2 bg-[#FAF6EE] border border-[#0D483F] text-[#0D483F] font-bold text-xs cursor-pointer uppercase"
                      >
                        Clear Strikes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Devices, Teams and Buzzer Status */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Live buzzer panel */}
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 rounded-none relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neonPink to-neonCyan" />
                
                <h3 className="font-bold text-[#0D483F] text-lg mb-4 uppercase font-condensed">Live Buzzer</h3>
                
                {adminState.buzzState.locked ? (
                  <div className="p-4 bg-neonPink/10 border border-neonPink/30 text-center">
                    <div className="w-10 h-10 bg-neonPink rounded-full flex items-center justify-center font-bold text-white text-lg mx-auto mb-2">
                      🔥
                    </div>
                    <span className="text-xs text-gray-500 block font-semibold">BUZZ WINNER</span>
                    <span className="font-black text-[#0D483F] text-lg block leading-tight my-1">{adminState.buzzState.player?.name}</span>
                    <span className="text-xs text-neonPink font-bold uppercase tracking-wider block mb-4">{adminState.buzzState.team}</span>

                    <button
                      onClick={() => sendControl('RESET_BUZZ')}
                      className="w-full py-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-700 hover:bg-amber-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Unlock Buzzer
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-400 text-xs font-bold border-2 border-dashed border-[#0D483F]/10 uppercase tracking-widest">
                    Buzzer Open
                  </div>
                )}
              </div>

              {/* Team Scores Override list */}
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 rounded-none">
                <h3 className="font-bold text-[#0D483F] text-lg mb-4 uppercase font-condensed">Teams & Scores</h3>
                {Object.keys(adminState.teams).length === 0 ? (
                  <p className="text-xs text-gray-500">No teams registered yet.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.keys(adminState.teams).map(tName => {
                      const team = adminState.teams[tName];
                      return (
                        <div key={tName} className="p-3 bg-neonPurple/5 border border-neonPurple/10">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-[#0D483F] text-xs truncate uppercase tracking-wider">{tName}</span>
                            <span className="font-black text-neonPurple">{team.score || 0} Pts</span>
                          </div>

                          <div className="flex gap-1.5 mb-2">
                            <button
                              onClick={() => sendControl('AWARD_POINTS', { team: tName, points: 10 })}
                              className="px-2 py-0.5 bg-neonPurple/10 text-[9px] text-[#0D483F] rounded hover:bg-neonPurple/20 cursor-pointer font-bold"
                            >
                              +10
                            </button>
                            <button
                              onClick={() => sendControl('AWARD_POINTS', { team: tName, points: -10 })}
                              className="px-2 py-0.5 bg-neonPurple/10 text-[9px] text-[#0D483F] rounded hover:bg-neonPurple/20 cursor-pointer font-bold"
                            >
                              -10
                            </button>
                            <button
                              onClick={() => sendControl('AWARD_POINTS', { team: tName, points: 50 })}
                              className="px-2 py-0.5 bg-neonPurple/10 text-[9px] text-[#0D483F] rounded hover:bg-neonPurple/20 cursor-pointer font-bold"
                            >
                              +50
                            </button>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1 border-t border-[#0D483F]/5">
                            <span>{team.members?.length || 0} Players</span>
                            <button
                              onClick={() => sendControl('REMOVE_TEAM', { team: tName })}
                              className="text-red-500 hover:underline font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connected Active Sockets */}
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 rounded-none">
                <h3 className="font-bold text-[#0D483F] text-lg mb-2 uppercase font-condensed">Connected Sockets</h3>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {adminState.players.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-[#FAF6EE] border border-[#0D483F]/10 px-2.5 py-1.5 text-xs">
                      <div className="truncate">
                        <strong className="text-neonPurple block">{p.name}</strong>
                        <span className="text-gray-500 text-[9px] font-bold block uppercase leading-none mt-0.5">({p.team || 'Lobby'})</span>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => sendControl('FORCE_BUZZ_WINNER', { player: { name: p.name, socketId: p.socketId }, team: p.team })}
                          className="text-[9px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 border border-cyan-500/30 px-1.5 py-0.5 rounded font-bold uppercase cursor-pointer"
                        >
                          Buzz
                        </button>
                        <button
                          onClick={() => sendControl('KICK_PLAYER', { playerId: p.id, socketId: p.socketId })}
                          className="text-[9px] bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase cursor-pointer"
                        >
                          Kick
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!adminState.players || adminState.players.length === 0) && (
                    <div className="text-center py-4 text-gray-400 text-xs font-bold">No active players.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TAB: SURVEY QUESTION BUILDER */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Add Question Form */}
            <form onSubmit={handleSaveQuestion} className="lg:col-span-5 bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 space-y-4">
              <h3 className="font-bold text-[#0D483F] text-lg border-b border-[#0D483F]/10 pb-2 uppercase font-condensed">Add Survey Question</h3>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Question Text</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Name something every VIT student carries..."
                  required
                  className="w-full px-4 py-2.5 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] placeholder-[#0D483F]/40 font-bold focus:outline-none focus:border-neonPurple/55"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] font-bold focus:outline-none"
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Answers & Points</label>
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
                      className="flex-1 px-3 py-2 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] text-xs placeholder-[#0D483F]/40 font-bold focus:outline-none"
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
                      className="w-20 px-3 py-2 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] text-xs placeholder-[#0D483F]/40 font-bold focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={addAnswerRow}
                  className="flex-1 py-2.5 bg-[#FAF6EE] border-2 border-[#0D483F] text-xs font-bold text-[#0D483F] cursor-pointer hover:bg-[#0D483F] hover:text-white transition uppercase"
                >
                  + Add Row
                </button>
                
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#D2F128] text-[#0D483F] border-2 border-[#0D483F] font-bold text-xs uppercase tracking-wider cursor-pointer shadow-[2px_2px_0_#D2F128] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                >
                  Save Question
                </button>
              </div>
            </form>

            {/* Questions list & imports */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[#0D483F] text-sm uppercase">Bulk Operations</h4>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Backup or restore survey database</p>
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={handleExportJSON}
                    className="px-4 py-2 bg-[#FAF6EE] hover:bg-[#0D483F] hover:text-white border-2 border-[#0D483F] text-xs text-[#0D483F] font-bold flex items-center gap-1.5 uppercase cursor-pointer"
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
                    className="px-4 py-2 bg-[#D2F128] text-[#0D483F] border-2 border-[#0D483F] text-xs font-bold flex items-center gap-1.5 uppercase cursor-pointer shadow-[2px_2px_0_#D2F128]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Import JSON
                  </button>
                </div>
              </div>

              {/* Questions List search */}
              <div className="bg-white border-2 border-[#0D483F] shadow-[6px_6px_0_#0D483F] p-6 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#0D483F]/50 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions or categories..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[#FAF6EE] border-2 border-[#0D483F] rounded-none text-[#0D483F] placeholder-[#0D483F]/40 text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredQs.map((q, idx) => (
                    <div key={q.id || idx} className="p-4 bg-neonPurple/5 border-2 border-[#0D483F]/10 space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2 py-0.5 bg-neonPurple/10 border border-neonPurple/20 text-neonPurple rounded text-[9px] font-bold uppercase tracking-wider">
                            {q.category}
                          </span>
                          <h4 className="font-bold text-[#0D483F] text-sm mt-1 uppercase font-condensed">{q.question}</h4>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDuplicate(q)}
                            className="p-1 hover:bg-neonPurple/10 text-[#0D483F]/60 hover:text-[#0D483F] rounded cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 hover:bg-red-500/10 text-red-500 rounded cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-500 font-semibold uppercase">
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
    </div>
  );
}
