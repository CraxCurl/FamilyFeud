import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    status: 'LOBBY',
    currentRound: 0,
    currentQuestion: null,
    revealedAnswers: [],
    strikes: 0,
    teams: {},
    players: [],
    buzzState: { locked: false, player: null, team: null },
    timer: 0,
    activeInputTeam: null,
    maxRounds: 3,
    turnSeconds: 15,
    turnsTaken: { 'Team Alpha': 0, 'Team Beta': 0 },
    turnsPerTeam: 3,
    winner: null,
    finalScores: {},
    strikeFlash: 0
  });

  const [adminState, setAdminState] = useState(null);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_BACKEND_URL || (
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : (window.location.hostname.includes('render.com')
            ? `${window.location.protocol}//${window.location.host}`
            : 'https://familyfeud-cf4d.onrender.com')
    );
    console.log("Connecting to Socket.io server at:", socketUrl);
    const newSocket = io(socketUrl);

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.io connected successfully!');
    });

    newSocket.on('game_state_update', (state) => {
      setGameState(state);
    });

    newSocket.on('admin_state_update', (state) => {
      setAdminState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, gameState, adminState }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
