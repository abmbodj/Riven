# Riven

Riven is a feature-rich, full-stack flashcard and study application designed to help users learn efficiently. It combines powerful study tools like spaced repetition and deck organization with social features, gamification (streaks, pets), and a highly customizable UI.

## Key Features

- **Advanced Card Management**: Create decks, folders, and tags. Support for image-based cards (front/back).
- **Smart Study Modes**: Track study sessions, duration, and accuracy.
- **Social Learning**: Friend system, direct messaging, and ability to share decks via unique codes.
- **Gamification**: Maintain daily streaks and customize a virtual pet with accessories.
- **Customizable UI**: Fully themable interface with user-defined colors and "Botanical Journal" aesthetic.
- **Role-Based Access**: Granular permissions including User, Admin, and Owner roles.
- **Security**: 2FA support using authenticator apps.

## Tech Stack

- **Language**: JavaScript (Node.js)
- **Frontend**: React 19 (Vite), Tailwind CSS, Framer Motion, Lucide React
- **Backend**: Express.js
- **Database**: PostgreSQL (via `pg` driver)
- **Authentication**: JWT (JSON Web Tokens) + Bcrypt
- **Testing**: Vitest (Unit & Integration)
- **Deployment**: Vercel (Monorepo structure)

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 20 or higher
- **PostgreSQL** 15 or higher (or a cloud provider like Supabase/Railway)
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/riven.git
cd riven
```

### 2. Install Dependencies

You need to install dependencies for both the root, server, and client.

```bash
# Install root dependencies (concurrently)
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 3. Environment Setup

#### Server Configuration
Create a `.env` file in the `server/` directory:

```bash
cp server/.env.example server/.env
```

Update `server/.env` with your credentials:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/riven` |
| `JWT_SECRET` | Secret key for signing tokens | `openssl rand -base64 32` output |
| `PORT` | API Server port | `3000` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173,http://localhost:3000` |

#### Client Configuration
Create a `.env` file in the `client/` directory:

```bash
cp client/.env.example client/.env
```

Update `client/.env`:

| Variable | Description | Default (Dev) |
|----------|-------------|---------------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000/api` |

### 4. Database Setup

Riven handles database initialization automatically. When the server starts, it checks for the existence of tables and creates them if missing (including seeding initial roles).

Ensure your PostgreSQL server is running and the database (e.g., `riven`) exists:

```bash
createdb riven
```

### 5. Start Development Server

From the project root, run:

```bash
npm start
```

This uses `concurrently` to launch:
- **Server**: `http://localhost:3000`
- **Client**: `http://localhost:5173` (Vite)

## Architecture

### Directory Structure

```
riven/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   └── ...
│   ├── public/             # Static assets
│   ├── vite.config.js      # Vite configuration
│   └── tailwind.config.js  # Tailwind configuration
├── server/                 # Express Backend
│   ├── db.js               # Database connection & schema init
│   ├── index.js            # Main application entry point
│   ├── test/               # Backend tests
│   └── package.json
├── package.json            # Root scripts
└── vercel.json             # Vercel deployment config
```

### Request Lifecycle

1.  **Client**: User interacts with React UI.
2.  **API Call**: Frontend makes request to `VITE_API_URL` (e.g., `/api/login`).
3.  **Server**: Express receives request, parses JSON body/cookies.
4.  **Database**: `db.js` executes SQL query via `pg` pool.
5.  **Response**: Server returns JSON data to Client.

### Database Schema

Key tables include:
- `users`: Stores profile, auth info, and customization settings.
- `decks` / `cards`: Core study content.
- `study_sessions`: Analytics data.
- `messages` / `friendships`: Social features.

Database migrations are currently handled via auto-run SQL checks in `db.js`.

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `JWT_SECRET` | Yes | Key for signing/verifying JWTs. |
| `PORT` | No | Port to listen on (default: `3000`). |
| `NODE_ENV` | No | `development` or `production`. |
| `ALLOWED_ORIGINS`| No | Comma-separated list of allowed CORS origins. |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_API_URL` | Yes | URL of the backend API. |

## Available Scripts

From the root directory:

| Command | Description |
|---------|-------------|
| `npm start` | Runs both client and server in parallel (Development mode). |
| `npm run server` | Runs only the server (dev mode with nodemon). |
| `npm run client` | Runs only the client (dev mode with Vite). |

## Testing

Testing is implemented using **Vitest**.

### Server Tests
```bash
cd server
npm test
```

### Client Tests
```bash
cd client
npm test
```

## Deployment

### Vercel (Recommended)

This repository is configured for monorepo deployment on Vercel.

1.  Push code to GitHub.
2.  Import project into Vercel.
3.  **Root Directory**: Leave as `./`.
4.  **Framework Preset**: Vite (for Client).
5.  **Environment Variables**: Add all variables from `server/.env` and `client/.env` to the Vercel project settings.
    *   Note: For `VITE_API_URL`, use `/api` if deployed on the same domain or the full URL.
6.  `vercel.json` at the root handles routing `/api/*` requests to the server and other requests to the client.

**Configuration (`vercel.json`):**
```json
{
  "builds": [
    { "src": "server/index.js", "use": "@vercel/node" },
    { "src": "client/package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/server/index.js" },
    { "src": "/(.*)", "dest": "/client/$1" }
  ]
}
```

## Troubleshooting

### Connection Refused (PostgreSQL)
**Error**: `connect ECONNREFUSED 127.0.0.1:5432`
**Solution**: Ensure PostgreSQL service is running. If using Docker, check container status.

### JWT Error
**Error**: `JsonWebTokenError: invalid signature`
**Solution**: Ensure `JWT_SECRET` in `.env` matches the one used to generate the token (or just restart auth flow after changing secret).

### Client Build Failures
**Error**: `Command not found: vite`
**Solution**: Ensure you ran `npm install` inside the `client/` directory.
