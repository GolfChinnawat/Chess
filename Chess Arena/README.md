# ♟️ Elite Chess Arena

A modern and fully-featured Chess Web Application built with vanilla JavaScript, HTML, and Tailwind CSS. The game logic is powered by `chess.js`, the board UI by `chessboard.js`, and the AI opponent by `stockfish.js` running in a Web Worker for smooth, lag-free gameplay.

## ✨ Features

- **Game Modes:** 
  - Player vs Player (Local multiplayer with auto-board flipping).
  - Player vs AI (Powered by Stockfish).
- **Advanced AI Opponent:** 3 Difficulty levels.
  - Easy (~1000 ELO)
  - Medium (~1600 ELO)
  - Hard (~2300+ ELO)
- **Time Controls:** Blitz and Rapid options (3 Min, 5 Min, 10 Min, 30 Min).
- **Smart UI/UX:** 
  - Premium Dark Mode design using Tailwind CSS.
  - Legal move highlighting (dots and capture rings).
  - Last move and 'King in check' highlighting.
- **Game Tools:** 
  - Move History & Captured Pieces display.
  - Undo Move & Get Hint (AI suggests the best move).
  - Export game to PGN format.
- **Audio Effects:** Synthesized sound effects using the Web Audio API (Moves, Captures, Checks, Game Over).

## 🛠️ Technologies Used

- **HTML5 / CSS3 / JavaScript** (No complex frameworks required)
- **[Tailwind CSS](https://tailwindcss.com/)** (via CDN for styling)
- **[Chess.js](https://github.com/jhlywa/chess.js)** (Move validation, checkmate/draw detection)
- **[Chessboard.js](https://chessboardjs.com/)** (Interactive drag-and-drop board UI)
- **[Stockfish.js](https://github.com/nmrugg/stockfish.js/)** (World-class chess engine compiled to JS/WebAssembly)

## 🚀 How to Run Locally

Because this project utilizes a Web Worker for the Stockfish AI, it **cannot** be run by simply double-clicking the `index.html` file (`file://` protocol will block the worker due to CORS/security policies). You must run it through a local web server.

### Option 1: Using VS Code (Recommended)
1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
2. Open the project folder in VS Code.
3. Right-click `index.html` and select **"Open with Live Server"**.

### Option 2: Using Python (Terminal)
Open your terminal in the project directory and run:
```bash
python -m http.server 8000