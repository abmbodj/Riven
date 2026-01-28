# ⚡ Riven

A beautiful, minimal flashcard app for mastering any subject. Built entirely through **prompt engineering** — no manual coding required.

![Made with AI](https://img.shields.io/badge/Made%20with-AI%20Prompt%20Engineering-blueviolet)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)

## ✨ Features

- **📚 Deck Management** — Create and organize flashcard decks
- **🔄 Study Mode** — Flip through cards with smooth 3D animations
- **🎯 Test Mode** — Challenge yourself with auto-generated multiple-choice quizzes
- **🎨 Custom Themes** — Personalize your experience with dark/light modes and custom color schemes
- **💾 Persistent Storage** — SQLite database keeps your progress safe

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS |
| Backend | Express 5, Node.js |
| Database | SQLite (better-sqlite3) |
| Icons | Lucide React |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone https://github.com/abmbodj/Riven.git
cd Riven

# Install dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Start the app (runs both client & server)
npm start
```

### Access the App

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000

The database auto-seeds with sample decks on first run.

## 📁 Project Structure

```
Riven/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── pages/          # Route pages
│   │   ├── api.js          # API client
│   │   └── ThemeContext.jsx
│   └── ...
├── server/                 # Express backend
│   ├── index.js            # API routes
│   └── db.js               # Database setup
└── package.json            # Root scripts
```

## 🤖 Built with Prompt Engineering

This entire project was created using **AI prompt engineering** — a fun experiment to see how far you can go by simply describing what you want to build.

No manual coding. Just conversations with AI.

From database schema design to 3D card flip animations, every line of code was generated through natural language prompts. It's a testament to how AI tools are changing the way we build software.

## 📸 Screenshots

### Home — Your Library
View all your decks at a glance with card counts and quick navigation.

### Study Mode
Beautiful flip cards with smooth 3D animations and progress tracking.

### Test Mode
Auto-generated quizzes that challenge your knowledge with multiple-choice questions.

### Theme Customization
Create custom color themes or switch between built-in dark and light modes.

## 📝 License

MIT — Feel free to use, modify, and share!

---

<p align="center">
  Made with ⚡ and AI
</p>
