# Jelajah Nusantara - AI Travel Planner

Jelajah Nusantara is a web platform that utilizes AI to help travelers plan their trips across Indonesia. It provides intelligent itinerary planning, interactive map visualization, and budget management.

## Tech Stack

### Frontend
- Vanilla ES6 JavaScript
- Vite
- Firebase SDK v10 (Authentication & Realtime Database)
- Leaflet.js (Interactive mapping)
- Chart.js (Budget visualization)
- marked.js (Markdown parsing)
- CSS3 (Custom styling with CSS variables)

### Backend
- Node.js 18+
- Express.js
- Firebase Admin SDK
- OpenAgentic AI integration (DeepSeek models)
- Multer (File upload handling)

## Project Structure

The project uses a monorepo structure:
- `/backend`: Express.js server, Firebase Admin configuration, and AI integration.
- `/frontend`: Vite-based frontend application.

## Local Setup

### 1. Prerequisites
- Node.js 18+
- npm or yarn

### 2. Installation
Install dependencies for both frontend and backend:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Environment Variables
Create a `.env` file in the `backend/` directory based on the configuration required by the application. Required variables include Firebase Admin credentials and the OpenAgentic API key.

### 4. Running the Development Servers
Start the backend server:
```bash
cd backend
npm run dev
```

Start the frontend development server:
```bash
cd frontend
npm run dev
```

## Deployment

This project is configured to be deployed on Vercel as a single project using `vercel.json`.
- The frontend is built using Vite.
- The backend runs as Vercel Serverless Functions.

To deploy on Vercel:
1. Import the repository into Vercel.
2. Leave the Root Directory configuration empty.
3. Add the required environment variables in the Vercel project settings.
4. Deploy.

## License
MIT License
