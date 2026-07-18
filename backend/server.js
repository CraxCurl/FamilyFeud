const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Admin Access Configuration
const ADMIN_KEY = String(process.env.ADMIN_KEY || '123456789').trim();

// Setup logs directory
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// MongoDB Connection & Schemas
let isMongoConnected = false;
const playerLogSchema = new mongoose.Schema({
  userId: String,
  username: String,
  team: String,
  round: Number,
  action: String, // 'join', 'leave', 'round_reset'
  timestamp: { type: Date, default: Date.now }
});

const PlayerLog = mongoose.model('PlayerLog', playerLogSchema);

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  username: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

mongoose.set('bufferCommands', false);
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/familyfeud';
mongoose.connect(mongoUri)
  .then(() => {
    isMongoConnected = true;
    console.log(`Successfully connected to MongoDB at ${mongoUri}`);
  })
  .catch((err) => {
    console.log(`MongoDB connection failed (${err.message}). Gracefully falling back to local file log.`);
  });

async function logPlayerAction(data) {
  if (isMongoConnected) {
    try {
      await PlayerLog.create(data);
    } catch (err) {
      console.error('Failed to log to MongoDB:', err.message);
    }
  }
  
  // Write to local fallback file log
  try {
    const logLine = `[${new Date().toISOString()}] Round ${data.round || 0} - Player: ${data.username || 'SYSTEM'} | Team: ${data.team || 'NONE'} | Action: ${data.action}\n`;
    fs.appendFileSync(path.join(__dirname, 'data', 'player_logs.txt'), logLine, 'utf8');
  } catch (err) {
    console.error('Failed to append to fallback file log:', err.message);
  }
}

const RANDOM_NAMES = [
  "Proxy Master", "Kotlin Knight", "Vite Wizard", "Bug Hunter", 
  "Code Ninja", "UI Wizard", "Coffee Dev", "Git Guru", 
  "Flutter Flyer", "Stack Overflowed", "Terminal Hacker", "Ctrl-Alt-Elite",
  "Latecomer", "App Pioneer", "Gradle Groovy", "Logcat Lover"
];

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Load default questions
const questionsPath = path.join(__dirname, 'data', 'initialQuestions.json');
let questionsList = [];
try {
  const fileContent = fs.readFileSync(questionsPath, 'utf8');
  questionsList = JSON.parse(fileContent);
} catch (e) {
  console.error("Could not load default questions:", e);
}

// Local Database State
let localDb = {
  questions: questionsList,
  games: {}
};

// Save helper for persistence
const saveLocalDb = () => {
  try {
    const dbPath = path.join(__dirname, 'data', 'db.json');
    fs.writeFileSync(dbPath, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to save local db:", e);
  }
};

// Load saved local db if exists
try {
  const dbPath = path.join(__dirname, 'data', 'db.json');
  if (fs.existsSync(dbPath)) {
    const content = fs.readFileSync(dbPath, 'utf8');
    localDb = JSON.parse(content);
    console.log("Loaded existing database from local JSON file.");
  }
} catch (e) {
  console.error("Could not read local db.json, using defaults.");
}

// Fetch all questions helper
function getQuestions() {
  return localDb.questions;
}

// Save question helper
function saveQuestion(question) {
  if (!question.id) {
    question.id = 'q_' + Date.now();
  }
  const idx = localDb.questions.findIndex(q => q.id === question.id);
  if (idx !== -1) {
    localDb.questions[idx] = question;
  } else {
    localDb.questions.push(question);
  }
  saveLocalDb();
  return question;
}

// Delete question helper
function deleteQuestion(id) {
  localDb.questions = localDb.questions.filter(q => q.id !== id);
  saveLocalDb();
}

// Global Game Control State
let gameState = {
  status: 'LOBBY', // LOBBY, PLAYING, ROUND_END, GAME_OVER
  currentRound: 0,
  questions: [],
  currentQuestion: null,
  revealedAnswers: [], // Array of booleans matching currentQuestion.answers length
  strikes: 0,
  teams: {}, // { teamName: { score: 0, members: [] } }
  players: {}, // { socketId: { name: '', team: '', id: '' } }
  buzzState: {
    locked: false,
    player: null,
    team: null,
    time: null
  },
  timer: 0,
  activeInputTeam: null, // Team currently allowed to input answers (or has the buzz)
  maxRounds: 3,
  turnsTaken: { 'Team Alpha': 0, 'Team Beta': 0 },
  turnsPerTeam: 3,
  winner: null,
  finalScores: {}
};

// Interval for Countdown Timers
let gameTimerInterval = null;

function broadcastState() {
  io.emit('game_state_update', {
    status: gameState.status,
    currentRound: gameState.currentRound,
    currentQuestion: gameState.currentQuestion ? {
      id: gameState.currentQuestion.id,
      question: gameState.currentQuestion.question,
      category: gameState.currentQuestion.category,
      answers: gameState.currentQuestion.answers.map((ans, idx) => {
        return {
          text: gameState.revealedAnswers[idx] ? ans.text : "",
          points: gameState.revealedAnswers[idx] ? ans.points : 0
        };
      })
    } : null,
    revealedAnswers: gameState.revealedAnswers,
    strikes: gameState.strikes,
    teams: gameState.teams,
    players: Object.values(gameState.players),
    buzzState: gameState.buzzState,
    timer: gameState.timer,
    activeInputTeam: gameState.activeInputTeam,
    maxRounds: gameState.maxRounds,
    turnsTaken: gameState.turnsTaken,
    turnsPerTeam: gameState.turnsPerTeam,
    winner: gameState.winner,
    finalScores: gameState.finalScores
  });
}

function sendAdminState(socket) {
  const target = socket || io.to('admin-room');
  target.emit('admin_state_update', {
    ...gameState,
    allQuestions: localDb.questions
  });
}

function startTimer(seconds, onTick, onComplete) {
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  gameState.timer = seconds;
  broadcastState();
  sendAdminState();
  
  gameTimerInterval = setInterval(() => {
    gameState.timer--;
    if (onTick) onTick(gameState.timer);
    broadcastState();
    sendAdminState();
    
    if (gameState.timer <= 0) {
      clearInterval(gameTimerInterval);
      if (onComplete) onComplete();
    }
  }, 1000);
}

function stopTimer() {
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  gameState.timer = 0;
  broadcastState();
  sendAdminState();
}

function clearPlayerTeams() {
  if (gameState.teams['Team Alpha']) {
    gameState.teams['Team Alpha'].members = [];
  }
  if (gameState.teams['Team Beta']) {
    gameState.teams['Team Beta'].members = [];
  }
  
  Object.keys(gameState.players).forEach(socketId => {
    gameState.players[socketId].team = null;
  });

  logPlayerAction({ action: 'round_reset', round: gameState.currentRound });
  
  broadcastState();
  sendAdminState();
}

// Middleware to verify key
const verifyAdminKey = (req, res, next) => {
  const reqKey = req.headers['x-admin-key'];
  if (reqKey === ADMIN_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized admin key' });
  }
};

// REST APIs
app.get('/api/questions', (req, res) => {
  // Free read to allow display/play view setup if needed
  res.json(getQuestions());
});

app.post('/api/questions', verifyAdminKey, (req, res) => {
  const q = saveQuestion(req.body);
  res.json(q);
});

app.delete('/api/questions/:id', verifyAdminKey, (req, res) => {
  deleteQuestion(req.params.id);
  res.json({ success: true });
});

function finishTurnCycle() {
  gameState.activeInputTeam = null;
  gameState.timer = 0;
  if (gameState.currentRound >= gameState.maxRounds) {
    concludeGame();
    return;
  }
  gameState.status = 'ROUND_END';
  io.emit('play_sound', { type: 'ROUND_COMPLETE' });
  broadcastState();
  sendAdminState();
}

function concludeGame() {
  stopTimer();
  gameState.status = 'GAME_OVER';
  gameState.activeInputTeam = null;
  const scores = Object.entries(gameState.teams).map(([name, data]) => ({ name, score: data.score || 0 }));
  const maxScore = Math.max(...scores.map(({ score }) => score), 0);
  const winners = scores.filter(({ score }) => score === maxScore).map(({ name }) => name);
  gameState.winner = winners.length === 1 ? winners[0] : 'DRAW';
  gameState.finalScores = Object.fromEntries(scores.map(({ name, score }) => [name, score]));

  // Results remain available through finalScores, while the active session is
  // cleared immediately so the next group can join with fresh team slots.
  const finishedPlayerIds = Object.values(gameState.players).map((player) => player.id).filter(Boolean);
  if (isMongoConnected && finishedPlayerIds.length) {
    User.deleteMany({ userId: { $in: finishedPlayerIds } })
      .catch((err) => console.error('Could not clear finished player profiles:', err.message));
  }
  gameState.players = {};
  gameState.teams = {};
  io.emit('game_over_trigger', { winner: gameState.winner });
  broadcastState();
  sendAdminState();
}

function beginTeamTurn(team) {
  if (!team || gameState.turnsTaken[team] >= gameState.turnsPerTeam) {
    finishTurnCycle();
    return;
  }

  gameState.status = 'PLAYING';
  gameState.activeInputTeam = team;
  gameState.turnsTaken[team] += 1;
  // This is a turn-based game now: no buzz winner is required for a team to play.
  gameState.buzzState = { locked: false, player: null, team: null, time: null };
  io.emit('play_sound', { type: 'ROUND_START' });

  startTimer(15, (secondsLeft) => {
    if (secondsLeft <= 3) io.emit('play_sound', { type: 'COUNTDOWN' });
  }, advanceTeamTurn);
}

function advanceTeamTurn() {
  io.emit('play_sound', { type: 'TIMER_END' });
  const currentTeam = gameState.activeInputTeam;
  const otherTeam = currentTeam === 'Team Alpha' ? 'Team Beta' : 'Team Alpha';

  if (gameState.turnsTaken[otherTeam] < gameState.turnsPerTeam) {
    beginTeamTurn(otherTeam);
  } else if (gameState.turnsTaken[currentTeam] < gameState.turnsPerTeam) {
    beginTeamTurn(currentTeam);
  } else {
    finishTurnCycle();
  }
}

function startTurnCycle() {
  stopTimer();
  gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
  gameState.activeInputTeam = null;
  gameState.buzzState = { locked: false, player: null, team: null, time: null };
  gameState.status = 'PLAYING';
  gameState.strikes = 0;
  // The only buzzer in a question: it decides which team receives the first turn.
  io.emit('play_sound', { type: 'ROUND_START' });
  broadcastState();
  sendAdminState();
}

// Socket logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Send current state on connect
  broadcastState();

  // Player Registration (automatic name assignment with MongoDB profiles, team: null initially)
  socket.on('join_game', async ({ id }) => {
    try {
      let resolvedUsername = null;

      // Find or create User in MongoDB only if connected
      if (isMongoConnected) {
        try {
          let user = await User.findOne({ userId: id });
          if (!user) {
            const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] || `User_${Math.floor(Math.random()*1000)}`;
            user = await User.create({ userId: id, username: randomName });
          }
          resolvedUsername = user.username;
        } catch (dbErr) {
          console.log(`Database query failed: ${dbErr.message}. Falling back to memory.`);
        }
      }

      // If database was not connected or query failed, fallback to memory
      if (!resolvedUsername) {
        const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] || `User_${Math.floor(Math.random()*1000)}`;
        resolvedUsername = randomName;
      }

      // Check if they are already in the active session
      let existingPlayer = Object.values(gameState.players).find(p => p.id === id);
      if (existingPlayer) {
        gameState.players[socket.id] = { ...existingPlayer, socketId: socket.id };
        const team = existingPlayer.team;
        if (team && gameState.teams[team]) {
          const memIdx = gameState.teams[team].members.findIndex(m => m.id === id);
          if (memIdx !== -1) {
            gameState.teams[team].members[memIdx].socketId = socket.id;
          }
        }
        socket.emit('joined_details', gameState.players[socket.id]);
        broadcastState();
        sendAdminState();
        return;
      }

      // Add to session players list with team: null (lobby state)
      const newPlayer = { name: resolvedUsername, team: null, id, socketId: socket.id };
      gameState.players[socket.id] = newPlayer;

      socket.emit('joined_details', newPlayer);
      broadcastState();
      sendAdminState();
    } catch (err) {
      console.error('Error joining game:', err.message);
    }
  });

  // Player Draws new Identity and Enters Active Team (3 max per team, 6 total max)
  socket.on('draw_identity', () => {
    const player = gameState.players[socket.id];
    if (!player) return;

    // Reject if already enrolled in a team for this round
    if (player.team) return;

    const activePlayersWithTeam = Object.values(gameState.players).filter(p => p.team !== null).length;
    if (activePlayersWithTeam >= 6) {
      socket.emit('join_blocked', {
        message: "The arena teams are full (6/6 players). Please wait in the queue patiently and learn more about Android Club!"
      });
      return;
    }

    if (!gameState.teams['Team Alpha']) gameState.teams['Team Alpha'] = { score: 0, members: [] };
    if (!gameState.teams['Team Beta']) gameState.teams['Team Beta'] = { score: 0, members: [] };

    const teamA = gameState.teams['Team Alpha'];
    const teamB = gameState.teams['Team Beta'];

    let assignedTeam = 'Team Alpha';
    if (teamA.members.length >= 3) {
      assignedTeam = 'Team Beta';
    } else if (teamB.members.length >= 3) {
      assignedTeam = 'Team Alpha';
    } else {
      assignedTeam = teamA.members.length <= teamB.members.length ? 'Team Alpha' : 'Team Beta';
    }

    // Draw a new random alias for this specific round
    const activeNames = Object.values(gameState.players).map(p => p.name);
    const availableNames = RANDOM_NAMES.filter(n => !activeNames.includes(n));
    const randomAlias = availableNames[Math.floor(Math.random() * availableNames.length)] || player.name;

    player.name = randomAlias;
    player.team = assignedTeam;
    gameState.teams[assignedTeam].members.push({ name: randomAlias, id: player.id, socketId: socket.id });

    console.log(`Player ${randomAlias} drawn for round onto ${assignedTeam}`);
    logPlayerAction({ userId: player.id, username: randomAlias, team: assignedTeam, round: gameState.currentRound, action: 'join' });

    socket.emit('joined_details', player);
    broadcastState();
    sendAdminState();
  });

  socket.on('admin_register', ({ key }) => {
    if (key && String(key).trim() === ADMIN_KEY) {
      socket.join('admin-room');
      sendAdminState(socket);
      console.log(`Socket ${socket.id} authenticated as Admin.`);
    } else {
      socket.emit('admin_auth_failed');
      console.log(`Socket ${socket.id} failed admin authentication.`);
    }
  });

  socket.on('admin_game_control', async ({ action, payload, key }) => {
    if (key !== ADMIN_KEY) {
      socket.emit('admin_auth_failed');
      return;
    }
    
    console.log(`Admin control received: ${action}`, payload);
    
    switch (action) {
      case 'START_GAME':
        const allQs = getQuestions();
        gameState.questions = allQs.sort(() => 0.5 - Math.random()).slice(0, gameState.maxRounds);
        gameState.status = 'PLAYING';
        gameState.currentRound = 1;
        gameState.currentQuestion = gameState.questions[0] || null;
        if (gameState.currentQuestion) {
          gameState.revealedAnswers = Array(gameState.currentQuestion.answers.length).fill(false);
        }
        gameState.strikes = 0;
        gameState.buzzState = { locked: false, player: null, team: null, time: null };
        gameState.activeInputTeam = null;
        gameState.winner = null;
        gameState.finalScores = {};
        gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
        startTurnCycle();
        break;

      case 'START_QUESTION':
        startTurnCycle();
        break;

      case 'PAUSE_GAME':
        stopTimer();
        break;

      case 'RESET_GAME':
        gameState.status = 'LOBBY';
        gameState.currentRound = 0;
        gameState.currentQuestion = null;
        gameState.revealedAnswers = [];
        gameState.strikes = 0;
        gameState.teams = {};
        gameState.players = {};
        gameState.buzzState = { locked: false, player: null, team: null, time: null };
        gameState.activeInputTeam = null;
        gameState.winner = null;
        gameState.finalScores = {};
        gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
        stopTimer();
        break;

      case 'NEXT_ROUND':
        if (gameState.currentRound < gameState.maxRounds) {
          gameState.currentRound++;
          gameState.currentQuestion = gameState.questions[gameState.currentRound - 1] || null;
          if (gameState.currentQuestion) {
            gameState.revealedAnswers = Array(gameState.currentQuestion.answers.length).fill(false);
          }
          gameState.strikes = 0;
          gameState.buzzState = { locked: false, player: null, team: null, time: null };
          gameState.activeInputTeam = null;
          gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
          // Keep the same players and their teams for the complete game.
          // A new question immediately begins the next alternating turn cycle.
          startTurnCycle();
        } else {
          concludeGame();
        }
        break;

      case 'PREV_ROUND':
        if (gameState.currentRound > 1) {
          gameState.currentRound--;
          gameState.currentQuestion = gameState.questions[gameState.currentRound - 1] || null;
          if (gameState.currentQuestion) {
            gameState.revealedAnswers = Array(gameState.currentQuestion.answers.length).fill(false);
          }
          gameState.strikes = 0;
          gameState.buzzState = { locked: false, player: null, team: null, time: null };
          gameState.activeInputTeam = null;
          gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
          startTurnCycle();
        }
        break;

      case 'REVEAL_ANSWER':
        const index = payload.index;
        if (gameState.currentQuestion && index >= 0 && index < gameState.revealedAnswers.length) {
          gameState.revealedAnswers[index] = true;
          io.emit('play_sound', { type: 'CORRECT' });
          
          if (payload.awardToTeam && gameState.teams[payload.awardToTeam]) {
            const pts = gameState.currentQuestion.answers[index].points;
            gameState.teams[payload.awardToTeam].score += pts;
          }
        }
        break;

      case 'HIDE_ANSWER':
        const hideIndex = payload.index;
        if (gameState.currentQuestion && hideIndex >= 0 && hideIndex < gameState.revealedAnswers.length) {
          gameState.revealedAnswers[hideIndex] = false;
        }
        break;

      case 'AWARD_POINTS':
        const targetTeamName = payload.team;
        const ptsToAward = payload.points;
        if (gameState.teams[targetTeamName]) {
          gameState.teams[targetTeamName].score += ptsToAward;
          io.emit('play_sound', { type: 'ROUND_COMPLETE' });
        }
        break;

      case 'ADD_STRIKE':
        gameState.strikes = Math.min(3, gameState.strikes + 1);
        io.emit('play_sound', { type: 'WRONG' });
        break;

      case 'RESET_STRIKES':
        gameState.strikes = 0;
        break;

      case 'RESET_BUZZ':
        gameState.buzzState = { locked: false, player: null, team: null, time: null };
        startTurnCycle();
        break;

      case 'REMOVE_TEAM':
        delete gameState.teams[payload.team];
        Object.keys(gameState.players).forEach(pId => {
          if (gameState.players[pId].team === payload.team) {
            gameState.players[pId].team = '';
          }
        });
        break;

      case 'FORCE_BUZZ_WINNER':
        // Kept for older host controls: forcing a player now simply opens that
        // team's next timed turn instead of reviving the buzzer mechanic.
        stopTimer();
        gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
        beginTeamTurn(payload.team || 'Team Alpha');
        break;
      
      case 'SKIP_QUESTION':
        const replacementQs = getQuestions().filter(q => q.id !== gameState.currentQuestion.id);
        if (replacementQs.length > 0) {
          const newQ = replacementQs[Math.floor(Math.random() * replacementQs.length)];
          gameState.questions[gameState.currentRound - 1] = newQ;
          gameState.currentQuestion = newQ;
          gameState.revealedAnswers = Array(newQ.answers.length).fill(false);
          gameState.strikes = 0;
          gameState.buzzState = { locked: false, player: null, team: null, time: null };
          gameState.activeInputTeam = null;
          gameState.turnsTaken = { 'Team Alpha': 0, 'Team Beta': 0 };
          stopTimer();
        }
        break;

      default:
        break;
    }

    broadcastState();
    sendAdminState();
  });

  // Opening buzz: it only decides the first team. All later turns alternate
  // automatically on the 15-second timer.
  socket.on('player_buzz', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.team || gameState.status !== 'PLAYING') return;
    if (gameState.activeInputTeam || gameState.buzzState.locked) return;

    gameState.buzzState = {
      locked: true,
      player: { name: player.name, socketId: socket.id },
      team: player.team,
      time: Date.now()
    };
    io.emit('play_sound', { type: 'BUZZ' });
    beginTeamTurn(player.team);
  });

  // Player Answer Submission
  socket.on('player_submit_answer', ({ answer }) => {
    const player = gameState.players[socket.id];
    if (!player || player.team !== gameState.activeInputTeam) return;

    io.to('admin-room').emit('incoming_answer', {
      player: player.name,
      team: player.team,
      answer: answer
    });

    let matchedIndex = -1;
    if (gameState.currentQuestion) {
      const cleanInput = answer.trim().toLowerCase();
      matchedIndex = gameState.currentQuestion.answers.findIndex(ans => {
        const cleanAns = ans.text.trim().toLowerCase();
        return cleanAns === cleanInput || cleanAns.includes(cleanInput) || cleanInput.includes(cleanAns);
      });
    }

    if (matchedIndex !== -1 && !gameState.revealedAnswers[matchedIndex]) {
      gameState.revealedAnswers[matchedIndex] = true;
      const pts = gameState.currentQuestion.answers[matchedIndex].points;
      gameState.teams[player.team].score += pts;
      
      io.emit('play_sound', { type: 'CORRECT' });
      // Keep the current 15-second team turn running after a correct answer.
    } else {
      gameState.strikes = Math.min(3, gameState.strikes + 1);
      io.emit('play_sound', { type: 'WRONG' });
    }

    broadcastState();
    sendAdminState();
  });

  socket.on('walk_off', async () => {
    try {
      const player = gameState.players[socket.id];
      if (player) {
        const team = player.team;
        if (team && gameState.teams[team]) {
          gameState.teams[team].members = gameState.teams[team].members.filter(m => m.socketId !== socket.id);
        }

        // Delete user profile from MongoDB if connected
        if (isMongoConnected) {
          try {
            await User.deleteOne({ userId: player.id });
            console.log(`Deleted user profile ${player.name} (${player.id}) from MongoDB.`);
          } catch (dbErr) {
            console.error("Failed to delete user profile from DB:", dbErr.message);
          }
        }

        delete gameState.players[socket.id];
        logPlayerAction({ userId: player.id, username: player.name, team: player.team, round: gameState.currentRound, action: 'leave' });
      }
      broadcastState();
      sendAdminState();
    } catch (err) {
      console.error('Error on walk_off:', err.message);
    }
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      delete gameState.players[socket.id];
    }
    broadcastState();
    sendAdminState();
  });
});

// Serve static assets from frontend build
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all route to serve Index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Fallback status route if deploying backend standalone
  app.get('/', (req, res) => {
    res.json({ status: 'healthy', message: 'Android Club Family Feud Server is Live!' });
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
