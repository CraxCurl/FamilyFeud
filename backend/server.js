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

const questionSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  question: String,
  category: String,
  answers: [{
    text: String,
    points: Number
  }]
});

const Question = mongoose.model('Question', questionSchema);

mongoose.set('bufferCommands', false);
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/familyfeud';
const mongoOptions = {
  serverSelectionTimeoutMS: 5000,
  family: 4
};

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

// Local Database State (used for memory cache & tracking used questions in current session)
let localDb = {
  questions: [],
  games: {},
  usedQuestionIds: []
};

// Initial seeding from file to MongoDB if empty
async function seedQuestions() {
  if (!isMongoConnected) return;
  try {
    const count = await Question.countDocuments();
    if (count === 0) {
      const questionsPath = path.join(__dirname, 'data', 'initialQuestions.json');
      if (fs.existsSync(questionsPath)) {
        const fileContent = fs.readFileSync(questionsPath, 'utf8');
        const initialQs = JSON.parse(fileContent);
        await Question.insertMany(initialQs.map((q, i) => ({
          ...q,
          id: q.id || 'q_' + (Date.now() + i)
        })));
        console.log("Seeded initial questions to MongoDB.");
      }
    }
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}

// Fetch all questions helper
async function getQuestions() {
  if (isMongoConnected) {
    return await Question.find({});
  }
  return localDb.questions;
}

// Draw questions helper
async function drawQuestions(count, currentQuestionsToExclude = []) {
  const allQuestions = await getQuestions();
  if (allQuestions.length === 0) return [];

  // Filter out any questions we want to exclude
  let available = allQuestions.filter(q => !currentQuestionsToExclude.includes(q.id));
  if (available.length === 0) {
    available = allQuestions;
  }

  if (!localDb.usedQuestionIds) {
    localDb.usedQuestionIds = [];
  }

  // Separate into unused and used
  let unused = available.filter(q => !localDb.usedQuestionIds.includes(q.id));

  // Shuffle array helper
  const shuffle = (array) => array.map(value => ({ value, sort: Math.random() }))
                                 .sort((a, b) => a.sort - b.sort)
                                 .map(({ value }) => value);

  let selected = [];

  if (unused.length >= count) {
    // We have enough unused questions
    selected = shuffle(unused).slice(0, count);
  } else {
    // We don't have enough unused questions
    selected = shuffle(unused);
    const needed = count - selected.length;

    // Reset used list (excluding the ones we just selected)
    localDb.usedQuestionIds = selected.map(q => q.id);

    let poolForRemaining = available.filter(q => !localDb.usedQuestionIds.includes(q.id));
    if (poolForRemaining.length === 0) {
      poolForRemaining = available;
    }

    const remaining = shuffle(poolForRemaining).slice(0, needed);
    selected = selected.concat(remaining);
  }

  // Add the newly selected questions to the used list
  selected.forEach(q => {
    if (!localDb.usedQuestionIds.includes(q.id)) {
      localDb.usedQuestionIds.push(q.id);
    }
  });

  return selected;
}

// Save question helper
async function saveQuestion(question) {
  if (!question.id) {
    question.id = 'q_' + Date.now();
  }

  if (isMongoConnected) {
    return await Question.findOneAndUpdate(
      { id: question.id },
      question,
      { upsert: true, new: true }
    );
  } else {
    const idx = localDb.questions.findIndex(q => q.id === question.id);
    if (idx !== -1) {
      localDb.questions[idx] = question;
    } else {
      localDb.questions.push(question);
    }
    return question;
  }
}

// Delete question helper
async function deleteQuestion(id) {
  if (isMongoConnected) {
    await Question.deleteOne({ id });
  } else {
    localDb.questions = localDb.questions.filter(q => q.id !== id);
  }
}

mongoose.connect(mongoUri, mongoOptions)
  .then(async () => {
    isMongoConnected = true;
    console.log(`Successfully connected to MongoDB at ${mongoUri}`);
    await seedQuestions();
  })
  .catch((err) => {
    isMongoConnected = false;
    console.warn(`MongoDB connection failed (${err.message}). Gracefully falling back to local memory.`);
  });

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
  queue: [], // Waiting queue for players { id, name, socketId }
  buzzState: {
    locked: false,
    player: null,
    team: null,
    time: null
  },
  timer: 0,
  activeInputTeam: null, // Team currently allowed to input answers (or has the buzz)
  maxRounds: 3,
  turnSeconds: 15,
  teamCapacity: 4,
  turnsTaken: {},
  turnsPerTeam: 3,
  winner: null,
  finalScores: {},
  strikeFlash: 0,
  submittedAnswers: []
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
    turnSeconds: gameState.turnSeconds,
    teamCapacity: gameState.teamCapacity,
    turnsTaken: gameState.turnsTaken,
    turnsPerTeam: gameState.turnsPerTeam,
    winner: gameState.winner,
    finalScores: gameState.finalScores,
    strikeFlash: gameState.strikeFlash
  });
}

function sendAdminState(socket) {
  const target = socket || io.to('admin-room');
  getQuestions()
    .then((qs) => {
      target.emit('admin_state_update', {
        ...gameState,
        allQuestions: qs
      });
    })
    .catch((err) => {
      console.error('Could not load admin questions; sending fallback state:', err.message);
      isMongoConnected = false;
      target.emit('admin_state_update', {
        ...gameState,
        allQuestions: localDb.questions || []
      });
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

function resetTurnCounts() {
  gameState.turnsTaken = Object.fromEntries(Object.keys(gameState.teams).map((teamName) => [teamName, 0]));
}

function resetSubmittedAnswers() {
  gameState.submittedAnswers = [];
}

function clearPlayerTeams() {
  Object.values(gameState.teams).forEach((team) => { team.members = []; });

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
app.get('/api/questions', async (req, res) => {
  const qs = await getQuestions();
  res.json(qs);
});

app.post('/api/questions', verifyAdminKey, async (req, res) => {
  if (Array.isArray(req.body)) {
    const questions = req.body.map((q, index) => {
      if (!q.id) {
        q.id = 'q_' + (Date.now() + index);
      }
      if (!q.answers) {
        q.answers = [];
      }
      return q;
    });

    if (isMongoConnected) {
      await Question.deleteMany({});
      await Question.insertMany(questions);
    } else {
      localDb.questions = questions;
    }
    res.json({ success: true, count: questions.length });
  } else {
    const q = await saveQuestion(req.body);
    res.json(q);
  }
});

app.delete('/api/questions', verifyAdminKey, async (req, res) => {
  if (isMongoConnected) {
    await Question.deleteMany({});
  } else {
    localDb.questions = [];
  }
  res.json({ success: true, count: 0 });
});

app.delete('/api/questions/:id', verifyAdminKey, async (req, res) => {
  await deleteQuestion(req.params.id);
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

function processQueue() {
  const lobbyCapacity = 8;
  const currentActiveCount = Object.keys(gameState.players).length;
  const spacesAvailable = lobbyCapacity - currentActiveCount;

  if (spacesAvailable > 0 && gameState.queue.length > 0) {
    const toPromote = gameState.queue.splice(0, spacesAvailable);
    toPromote.forEach(player => {
      gameState.players[player.socketId] = {
        id: player.id,
        name: player.name,
        team: null,
        socketId: player.socketId
      };
      io.to(player.socketId).emit('joined_details', gameState.players[player.socketId]);
    });

    // Recalculate and update queue positions for remaining players
    gameState.queue.forEach((player, idx) => {
      io.to(player.socketId).emit('joined_queue', { position: idx + 1 });
    });
  }
}

function beginTeamTurn(team, buzzed = false) {
  if (!team || gameState.turnsTaken[team] >= gameState.turnsPerTeam) {
    finishTurnCycle();
    return;
  }

  gameState.status = 'PLAYING';
  gameState.activeInputTeam = team;
  gameState.turnsTaken[team] += 1;

  if (!buzzed) {
    // If not triggered by a buzz (e.g. automatic turn transition), clear the buzz state.
    gameState.buzzState = { locked: false, player: null, team: null, time: null };
    io.emit('play_sound', { type: 'ROUND_START' });
  }

  startTimer(gameState.turnSeconds, (secondsLeft) => {
    io.emit('play_sound', { type: 'COUNTDOWN' });
  }, advanceTeamTurn);
}

function advanceTeamTurn() {
  io.emit('play_sound', { type: 'TIMER_END' });
  const currentTeam = gameState.activeInputTeam;
  const otherTeam = Object.keys(gameState.teams).find((teamName) => teamName !== currentTeam);

  if (otherTeam && gameState.turnsTaken[otherTeam] < gameState.turnsPerTeam) {
    beginTeamTurn(otherTeam);
  } else if (gameState.turnsTaken[currentTeam] < gameState.turnsPerTeam) {
    beginTeamTurn(currentTeam);
  } else {
    finishTurnCycle();
  }
}

function startTurnCycle() {
  stopTimer();
  resetTurnCounts();
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

  // Player Registration (team is selected separately in the lobby)
  socket.on('join_game', async ({ id }) => {
    try {
      const resolvedUsername = 'Player';

      // Check if they are already in the active session
      let existingPlayer = Object.values(gameState.players).find(p => p.id === id);
      if (existingPlayer) {
        const oldSocketId = Object.keys(gameState.players).find(k => gameState.players[k].id === id);
        if (oldSocketId && oldSocketId !== socket.id) {
          delete gameState.players[oldSocketId];
        }
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

      // Check if they are already in the queue
      let existingQueueIndex = gameState.queue.findIndex(p => p.id === id);
      if (existingQueueIndex !== -1) {
        gameState.queue[existingQueueIndex].socketId = socket.id;
        socket.emit('joined_queue', { position: existingQueueIndex + 1 });
        return;
      }

      if (gameState.status !== 'LOBBY') {
        const queuedPlayer = { id, name: resolvedUsername, socketId: socket.id };
        gameState.queue.push(queuedPlayer);
        socket.emit('joined_queue', { position: gameState.queue.length });
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

  // Players choose one of at most two named teams, within the host-configured capacity.
  socket.on('select_team', ({ teamName }, acknowledge = () => {}) => {
    const player = gameState.players[socket.id];
    if (!player) {
      acknowledge({ ok: false, message: 'Your player session is not ready. Please try again.' });
      return;
    }

    if (gameState.status !== 'LOBBY') {
      const message = 'Teams are locked once the game starts.';
      socket.emit('join_blocked', { message });
      acknowledge({ ok: false, message });
      return;
    }

    if (player.team) {
      acknowledge({ ok: true, team: player.team });
      socket.emit('joined_details', player);
      return;
    }

    const requestedName = String(teamName || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!requestedName) {
      const message = 'Enter a team name to join.';
      socket.emit('join_blocked', { message });
      acknowledge({ ok: false, message });
      return;
    }

    const existingTeamName = Object.keys(gameState.teams).find((name) => name.toLowerCase() === requestedName.toLowerCase());
    const assignedTeam = existingTeamName || requestedName;
    if (!existingTeamName && Object.keys(gameState.teams).length >= 2) {
      const message = 'Two teams are already set up. Join one of those teams.';
      socket.emit('join_blocked', { message });
      acknowledge({ ok: false, message });
      return;
    }

    if (!gameState.teams[assignedTeam]) gameState.teams[assignedTeam] = { score: 0, members: [] };
    if (gameState.teams[assignedTeam].members.length >= gameState.teamCapacity) {
      const message = `${assignedTeam} is full (${gameState.teamCapacity}/${gameState.teamCapacity}).`;
      socket.emit('join_blocked', { message });
      acknowledge({ ok: false, message });
      return;
    }

    player.team = assignedTeam;
    gameState.teams[assignedTeam].members.push({ id: player.id, socketId: socket.id });

    console.log(`Player joined ${assignedTeam} (${gameState.teams[assignedTeam].members.length}/4)`);
    logPlayerAction({ userId: player.id, team: assignedTeam, round: gameState.currentRound, action: 'join' });

    socket.emit('joined_details', player);
    acknowledge({ ok: true, team: assignedTeam });
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
        gameState.questions = await drawQuestions(gameState.maxRounds);
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
        gameState.strikeFlash = 0;
        resetSubmittedAnswers();
        resetTurnCounts();
        startTurnCycle();
        break;

      case 'START_QUESTION':
        resetSubmittedAnswers();
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
        gameState.strikeFlash = 0;
        resetSubmittedAnswers();
        resetTurnCounts();
        stopTimer();
        processQueue();
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
          resetSubmittedAnswers();
          resetTurnCounts();
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
          resetSubmittedAnswers();
          resetTurnCounts();
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
            io.emit('play_sound', { type: 'POINTS_SCORED' });
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
          io.emit('play_sound', { type: 'POINTS_SCORED' });
        }
        break;

      case 'ADD_STRIKE':
        gameState.strikes = 1;
        gameState.strikeFlash += 1;
        io.emit('play_sound', { type: 'WRONG' });
        break;

      case 'RESET_STRIKES':
        gameState.strikes = 0;
        break;

      case 'UPDATE_SETTINGS':
        if (gameState.status !== 'LOBBY') break;
        if (payload.maxRounds !== undefined) {
          gameState.maxRounds = Math.max(1, Math.min(10, Number(payload.maxRounds) || 3));
        }
        if (payload.turnSeconds !== undefined) {
          gameState.turnSeconds = Math.max(5, Math.min(60, Number(payload.turnSeconds) || 15));
        }
        if (payload.teamCapacity !== undefined) {
          const requestedCapacity = Math.max(1, Math.min(10, Number(payload.teamCapacity) || 4));
          const largestTeam = Math.max(0, ...Object.values(gameState.teams).map((team) => team.members.length));
          gameState.teamCapacity = Math.max(requestedCapacity, largestTeam);
        }
        break;

      case 'RESET_BUZZ':
        stopTimer();
        gameState.activeInputTeam = null;
        gameState.buzzState = { locked: false, player: null, team: null, time: null };
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
        resetTurnCounts();
        beginTeamTurn(payload.team || Object.keys(gameState.teams)[0]);
        break;

      case 'SKIP_QUESTION':
        const currentInGameIds = gameState.questions.map(q => q.id);
        const replacementQs = await drawQuestions(1, currentInGameIds);
        if (replacementQs.length > 0) {
          const newQ = replacementQs[0];
          gameState.questions[gameState.currentRound - 1] = newQ;
          gameState.currentQuestion = newQ;
          gameState.revealedAnswers = Array(newQ.answers.length).fill(false);
          gameState.strikes = 0;
          gameState.buzzState = { locked: false, player: null, team: null, time: null };
          gameState.activeInputTeam = null;
          resetSubmittedAnswers();
          resetTurnCounts();
          stopTimer();
        }
        break;

      case 'KICK_PLAYER':
        const targetPlayerId = payload.playerId;
        const targetSocketId = payload.socketId;
        const socketIdToKick = Object.keys(gameState.players).find(
          sId => sId === targetSocketId || gameState.players[sId].id === targetPlayerId
        );
        if (socketIdToKick) {
          const playerToKick = gameState.players[socketIdToKick];
          console.log(`Host kicked player: ${playerToKick.name}`);

          if (playerToKick.team && gameState.teams[playerToKick.team]) {
            gameState.teams[playerToKick.team].members = gameState.teams[playerToKick.team].members.filter(
              m => m.id !== playerToKick.id && m.socketId !== socketIdToKick
            );
          }
          delete gameState.players[socketIdToKick];

          const targetSocket = io.sockets.sockets.get(socketIdToKick);
          if (targetSocket) {
            targetSocket.emit('join_blocked');
            targetSocket.disconnect(true);
          }
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
    beginTeamTurn(player.team, true);
  });

  // Player Answer Submission
  socket.on('player_submit_answer', ({ answer }) => {
    const player = gameState.players[socket.id];
    if (!player || player.team !== gameState.activeInputTeam) return;

    const submittedAnswer = String(answer || '').trim().slice(0, 100);
    if (!submittedAnswer) return;

    let matchedIndex = -1;
    if (gameState.currentQuestion) {
      const cleanInput = submittedAnswer.toLowerCase();
      matchedIndex = gameState.currentQuestion.answers.findIndex(ans => {
        const cleanAns = ans.text.trim().toLowerCase();
        return cleanAns === cleanInput;
      });
    }

    const isExactUnrevealedMatch = matchedIndex !== -1 && !gameState.revealedAnswers[matchedIndex];

    const response = {
      id: `${socket.id}-${Date.now()}`,
      team: player.team,
      answer: submittedAnswer,
      matchedIndex,
      matched: isExactUnrevealedMatch,
      autoRevealed: isExactUnrevealedMatch,
      submittedAt: Date.now()
    };
    gameState.submittedAnswers.push(response);

    if (isExactUnrevealedMatch) {
      gameState.revealedAnswers[matchedIndex] = true;
      const points = gameState.currentQuestion.answers[matchedIndex].points;
      gameState.teams[player.team].score += points;
      io.emit('play_sound', { type: 'CORRECT' });
      io.emit('play_sound', { type: 'POINTS_SCORED' });
    }
    io.to('admin-room').emit('incoming_answer', response);

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
      if (player.team && gameState.teams[player.team]) {
        gameState.teams[player.team].members = gameState.teams[player.team].members
          .filter((member) => member.socketId !== socket.id && member.id !== player.id);
      }
      delete gameState.players[socket.id];
    }

    gameState.queue = gameState.queue.filter(p => p.socketId !== socket.id);
    gameState.queue.forEach((p, idx) => {
      io.to(p.socketId).emit('joined_queue', { position: idx + 1 });
    });

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

function startServer(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Trying ${nextPort} instead.`);
      startServer(nextPort);
      return;
    }

    console.error('Failed to start server:', err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

const PORT = Number(process.env.PORT || 5000);
startServer(PORT);
