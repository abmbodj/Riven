# ⚡ Riven

A beautiful, minimal flashcard app for mastering any subject. Features **cross-device sync**, **offline support**, and a **streak system** with Gmail the Pug 🐶 as your study companion!

Built entirely through **prompt engineering** — no manual coding required.

![Made with AI](https://img.shields.io/badge/Made%20with-AI%20Prompt%20Engineering-blueviolet)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa)

## 🌐 Live Demo

- **App**: https://riven-virid.vercel.app
- **API**: https://riven-wa9y.onrender.com

## ✨ Features

- **🔐 Cross-Device Sync** — Sign up to access your flashcards from any device
- **📱 PWA Support** — Install on iOS/Android for a native app experience
- **🐶 Gmail the Pug** — Your study companion! Maintain your streak to see Gmail grow from a puppy to a king
- **🦴 Streak System** — Visual streak tracking with dog-themed rewards
- **📚 Deck Management** — Create, organize with folders, and tag flashcard decks
- **🔄 Study Mode** — Flip through cards with smooth 3D animations
- **🧠 Spaced Repetition** — Focus on cards you're actually forgetting
- **🎯 Test Mode** — Auto-generated multiple-choice quizzes
- **🎨 Custom Themes** — Multiple built-in themes or create your own
- **💾 Offline Mode** — Works without internet using IndexedDB (guest data migrates on signup)
- **📤 Export/Import** — Export decks as JSON or CSV

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS |
| Backend | Express 5, Node.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (30-day tokens) |
| Offline Storage | IndexedDB |
| Hosting | Vercel (frontend), Render (backend) |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+

### Local Development

```bash
# Clone the repository
git clone https://github.com/abmbodj/Riven.git
cd Riven

# Backend (Terminal 1)
cd server
npm install
npm run dev          # Runs on http://localhost:3001

# Frontend (Terminal 2)
cd client
npm install
npm run dev          # Runs on http://localhost:5173
```

### Environment Variables

**Client** (`client/.env`):
```
VITE_API_URL=http://localhost:3001/api
```

**Server** (`server/.env` or environment):
```
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:5173
```

## 🚢 Deployment

### Backend (Render)

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repo
3. Set root directory: `server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:
   - `JWT_SECRET` — Random secure string
   - `ALLOWED_ORIGINS` — Your Vercel frontend URL

### Frontend (Vercel)

1. Import project on [Vercel](https://vercel.com)
2. Set root directory: `client`
3. Add environment variable:
   - `VITE_API_URL` — Your Render backend URL + `/api`
4. Deploy

## 📁 Project Structure

```
Riven/
├── client/                 # React frontend (PWA)
│   ├── src/
│   │   ├── api/            # Server API calls
│   │   ├── components/     # UI components
│   │   ├── context/        # React contexts (Auth, Theme, Streak, Toast)
│   │   ├── db/             # IndexedDB for offline/guest mode
│   │   ├── pages/          # Route pages
│   │   └── api.js          # Hybrid API (server or IndexedDB)
│   └── ...
├── server/
│   ├── index.js            # Express API routes
│   └── db.js               # SQLite database setup
└── README.md
```

## 🔑 Key Features Explained

### Hybrid Storage
- **Logged in**: Data syncs with SQLite backend
- **Guest mode**: Data stored locally in IndexedDB
- **On signup**: Guest data automatically migrates to your account

### PWA Installation
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome menu → Install app

## 🤖 Built with Prompt Engineering

This entire project was created using **AI prompt engineering**. From the SVG animations of Gmail the Pug to the hybrid storage logic, every line of code was generated through natural language prompts.

## 📝 License

MIT — Feel free to use, modify, and share!

---

<p align="center">
  Made with ⚡ and AI
</p>
