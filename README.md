# ⚡ Riven

A beautiful, minimal flashcard app for mastering any subject. Features **cross-device sync**, **offline support**, and a **streak system** with a beautiful garden 🌱 that grows with your dedication!

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa)

## 🌐 Live Demo

- **App**: https://riven-virid.vercel.app
- **API**: https://riven-wa9y.onrender.com

## ✨ Features

- **🔐 Cross-Device Sync** — Sign up to access your flashcards from any device
- **📱 PWA Support** — Install on iOS/Android for a native app experience
- **🌱 Streak Garden** — Watch your garden grow from bare soil to paradise as you maintain your streak
- **🌸 Garden Customization** — Unlock themes, decorations, and special plants as rewards
- **📚 Deck Management** — Create, organize with folders, and tag flashcard decks
- **🔄 Study Mode** — Flip through cards with smooth 3D animations
- **🧠 Spaced Repetition** — Focus on cards you're actually forgetting
- **🎯 Test Mode** — Auto-generated multiple-choice quizzes
- **🎨 Custom Themes** — Multiple built-in themes or create your own
- **💾 Offline Mode** — Works without internet using IndexedDB
- **📤 Export/Import** — Export decks as JSON or CSV

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS |
| Backend | Express 5, Node.js |
| Database | PostgreSQL (Supabase) |
| Auth | JWT (30-day tokens), bcrypt |
| Offline Storage | IndexedDB |
| Hosting | Vercel (frontend), Render (backend) |

## 🔒 Security Features

- **Rate Limiting** — 10 auth attempts/15min, 100 API requests/min
- **Password Hashing** — bcrypt with cost factor 12
- **Input Validation** — Email format, username rules
- **Parameterized Queries** — SQL injection protection
- **CORS Whitelist** — Origin-based access control
- **JWT Authentication** — Secure token-based auth

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or free [Supabase](https://supabase.com) account)

### Local Development

```bash
# Clone the repository
git clone https://github.com/abmbodj/Riven.git
cd Riven

# Backend (Terminal 1)
cd server
npm install
DATABASE_URL="your-postgres-url" JWT_SECRET="dev-secret" npm run dev

# Frontend (Terminal 2)
cd client
npm install
npm run dev
```

### Environment Variables

**Server** (required):
```
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-random-secret-key
ALLOWED_ORIGINS=http://localhost:5173
```

**Client** (`client/.env`):
```
VITE_API_URL=http://localhost:3000/api
```

## 🚢 Deployment

### Database (Supabase)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to **Settings → Database → Connection Pooling**
4. Copy the **Transaction** mode URI

### Backend (Render)

1. Create Web Service on [render.com](https://render.com)
2. Connect GitHub repo, set root: `server`
3. Build: `npm install` | Start: `npm start`
4. Add environment variables:
   - `DATABASE_URL` — Supabase connection string
   - `JWT_SECRET` — Random secure string
   - `ALLOWED_ORIGINS` — Your Vercel URL

### Frontend (Vercel)

1. Import project on [vercel.com](https://vercel.com)
2. Set root directory: `client`
3. Add: `VITE_API_URL` = Your Render URL + `/api`

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
│   ├── index.js            # Express API routes (async PostgreSQL)
│   └── db.js               # PostgreSQL connection pool
└── README.md
```

## 🔑 Key Features Explained

### Hybrid Storage
- **Logged in**: Data syncs with PostgreSQL backend
- **Guest mode**: Data stored locally in IndexedDB
- **On signup**: Guest data automatically migrates to your account

### PWA Installation
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome menu → Install app

## 📝 License

MIT — Feel free to use, modify, and share!

---

<p align="center">
  Made with ⚡ and AI
</p>
