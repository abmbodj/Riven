# ⚡ Riven (feat. Gmail the Pug 🐶)

A beautiful, minimal, and "local-first" flashcard app for mastering any subject. Featuring **Gmail the Pug**, your personal study companion who grows as you maintain your streak!

Built entirely through **prompt engineering** — no manual coding required.

![Made with AI](https://img.shields.io/badge/Made%20with-AI%20Prompt%20Engineering-blueviolet)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite)
![IndexedDB](https://img.shields.io/badge/IndexedDB-Local-blue?logo=google-chrome)

## ✨ Features

- **🐶 Gmail the Pug** — Your study companion! Maintain your streak to see Gmail grow from a puppy to a king. Don't forget to study, or he'll fall asleep!
- **🦴 Streak System** — Visual streak tracking with dog-themed rewards and customization.
- **📚 Deck Management** — Create, organize, and tag flashcard decks with ease.
- **🔄 Study Mode** — Flip through cards with smooth 3D animations and progress tracking.
- **🧠 Spaced Repetition** — Built-in spaced repetition logic to help you focus on what you're actually forgetting.
- **🎯 Test Mode** — Challenge yourself with auto-generated multiple-choice quizzes.
- **🎨 Custom Themes** — Personalize your experience with a powerful theme engine. Create your own color schemes!
- **💾 Hybrid Storage** — Works offline with **IndexedDB** and syncs with a **SQLite** backend when available.
- **📤 Export/Import** — Export your decks as JSON or CSV for backup or sharing.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS |
| Local Storage | IndexedDB (idb) |
| Backend | Express 5, Node.js |
| Database | SQLite (better-sqlite3) |
| Icons | Lucide React |

## 🚀 Getting Started

Riven is designed to be flexible. You can run it as a standalone local app or with a backend server.

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone https://github.com/abmbodj/Riven.git
cd Riven

# Install dependencies
npm install
```

### Running the App

#### 1. Local-Only Mode (No server needed)
Just start the client. All data will be saved to your browser's IndexedDB.
```bash
npm run client
```

#### 2. Full Stack Mode (With SQLite sync)
Start both the client and the server.
```bash
npm start
```

### Access the App

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000

## 📁 Project Structure

```
Riven/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components (including Gmail the Pug!)
│   │   ├── pages/          # Route pages
│   │   ├── db/             # IndexedDB logic
│   │   └── api.js          # Hybrid API client
│   └── ...
├── server/                 # Express backend
│   ├── index.js            # API routes
│   └── db.js               # SQLite setup
└── package.json            # Root scripts
```

## 🤖 Built with Prompt Engineering

This entire project was created using **AI prompt engineering** — a fun experiment to see how far you can go by simply describing what you want to build.

No manual coding. Just conversations with AI.

From the complex SVG animations of **Gmail the Pug** to the hybrid storage logic, every line of code was generated through natural language prompts. It's a testament to how AI tools are changing the way we build software.

## 📝 License

MIT — Feel free to use, modify, and share!

---

<p align="center">
  Made with ⚡, AI, and 🦴 for Gmail
</p>
