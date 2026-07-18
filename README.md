# Survey Says - Real-time Multiplayer Family Feud Game

An interactive, real-time multiplayer Family Feud style game customized for **Android Club, VIT Chennai Club Expo**. Players scan a QR code on the main display screen to join teams and buzz in from their mobile phones, while the host manages questions, reveals answers, and updates scores live.

---

## Features

- **Premium Dark UI**: Inspired by moxiebeauty.in, featuring glassmorphic panels, neon purple/pink/cyan accents, and glowing card components.
- **Zero-Asset synthesized Sound Effects**: Programmatically synthesized retro game audio utilizing the browser Web Audio API (Correct, Buzz, Timer Alarm, Strikes, Winner Fanfare).
- **Interactive Host Dashboard**: Create/edit questions, duplicate items, import/export survey data JSON, award points, reset buzzers, and handle strikes.
- **Live Display Board**: Designed for TVs/projectors, showing flipping cards, real-time team lists, scores, dynamic strikes, and automatic confetti explosions.
- **Responsive Mobile Web Buzzers**: Instant mobile setup (no installation needed) for player registrations, live buzz locks, and answer submission inputs.
- **Persistent Local Database**: Saves all game setup questions and categories changes locally to a JSON file database (`data/db.json`) on the backend server.

---

## Project Structure

```
FamilyFeud/
├── backend/
│   ├── data/
│   │   ├── initialQuestions.json   # Seed questions list
│   │   └── db.json                 # Persistent local DB fallback
│   ├── package.json
│   └── server.js                   # Node.js + Express + Socket.io Server
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable custom UI components
│   │   ├── context/
│   │   │   └── SocketContext.jsx   # Global socket context provider
│   │   ├── pages/
│   │   │   ├── Landing.jsx         # Beautiful entry landing portal
│   │   │   ├── Play.jsx            # Mobile player controller view
│   │   │   ├── Display.jsx         # TV Gameboard screen
│   │   │   └── Admin.jsx           # Host control panel
│   │   ├── utils/
│   │   │   └── sounds.js           # Web Audio API Synthesizer
│   │   ├── App.jsx
│   │   ├── index.css               # Tailored CSS, shadows & glows
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Installation & Setup

### 1. Backend Server Setup
Navigate to the `backend/` directory:
```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` to configure the server port and host access key:
```env
PORT=5000
ADMIN_KEY=your_secure_admin_key_here
```
*Note: If no ADMIN_KEY is configured, the server defaults to 'android_club_expo'. All question data is saved locally to the JSON database at `backend/data/db.json`.*

Start the backend server:
```bash
npm start
```

### 2. Frontend Client Setup
Navigate to the `frontend/` directory:
```bash
cd ../frontend
npm install
```

Create a `.env` file inside `frontend/` (optional):
```env
VITE_BACKEND_URL=http://localhost:5000
```

Start the local Vite server:
```bash
npm run dev
```

---

## Deployment

- **Frontend**: Deploy to Vercel by selecting the `frontend` subfolder.
- **Backend**: Deploy to Render by pointing to the `backend` folder and running `npm start`. Set appropriate environment variables on Render.
