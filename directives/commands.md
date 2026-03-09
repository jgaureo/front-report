# Project Startup Commands

This directive outlines the steps to start the local development environment for the Front Report project.

## Development Stack
- **Frontend**: Vite (Running on port 5173)
- **Backend**: Express (Node.js)

## Startup Instructions

### 1. Start the Frontend Client
The client should be started from the `webapp/client` directory. This will host the dashboard at `http://localhost:5173/`.

```powershell
cd "c:\AI Projects\Front Report\webapp\client"
npm run dev
```

### 2. Start the Backend Server
The server should be started in a separate terminal from the `webapp/server` directory.

```powershell
cd "c:\AI Projects\Front Report\webapp\server"
npm run dev
```

## Summary of Scripts
- `npm run dev` (client): Starts the Vite development server.
- `npm run dev` (server): Starts the Node.js server with watch mode enabled.
