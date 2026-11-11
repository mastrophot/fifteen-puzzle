(() => {
  const STATE_KEY = "fifteen-puzzle-state-v2";
  const RECORDS_KEY = "fifteen-puzzle-records-v1";
  const SOUND_KEY = "fifteen-puzzle-sound";
  const NAME_KEY = "fifteen-puzzle-player";
  const MAX_RECORDS = 10;

  class FifteenPuzzle {
    constructor() {
      this.boardSize = 4;
      this.board = [];
      this.moves = 0;
      this.elapsedMs = 0;
      this.lastTickAt = 0;
      this.timerInterval = null;
      this.isPlaying = false;
      this.hasMoved = false;
      this.canSaveWin = false;
      this.latestRecordId = null;

      this.audioCtx = null;
      this.soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";

      this.swipeState = null;
      this.suppressClickUntil = 0;
      this.confettiFrameId = null;
      this.confettiStopTimer = null;

      this.initializeElements();
      this.syncSoundButton();
      this.initializeEventListeners();
      this.renderLeaderboard();
      this.restoreOrStartGame();
    }

    initializeElements() {
      this.boardElement = document.querySelector(".game-board");
      this.movesElement = document.getElementById("moves");
      this.timerElement = document.getElementById("timer");
      this.startButton = document.getElementById("startGame");
      this.startBtnText = this.startButton.querySelector(".button-content");
      this.soundButton = document.getElementById("toggleSound");
      this.soundOnIcon = document.getElementById("soundOnIcon");
      this.soundOffIcon = document.getElementById("soundOffIcon");
      this.winModal = document.getElementById("winModal");
      this.finalTimeEl = document.getElementById("finalTime");
      this.finalMovesEl = document.getElementById("finalMoves");
      this.saveScoreButton = document.getElementById("saveScore");
      this.closeModalButton = document.getElementById("closeModal");
      this.playerNameInput = document.getElementById("playerName");
      this.leaderboardList = document.getElementById("leaderboardList");
    }

    initializeEventListeners() {
      this.startButton.addEventListener("click", () => {
        this.unlockAudio();
        this.startNewGame(true);
      });

      this.soundButton.addEventListener("click", () => {
        this.soundEnabled = !this.soundEnabled;
        try {
          localStorage.setItem(SOUND_KEY, this.soundEnabled ? "on" : "off");
        } catch {}
        this.syncSoundButton();
        if (this.soundEnabled) {
          this.unlockAudio();
          this.playMoveSound();
        }
      });

      this.boardElement.addEventListener("pointerdown", (e) => this.handlePointerDown(e));
      this.boardElement.addEventListener("pointerup", (e) => this.handlePointerUp(e));
      this.boardElement.addEventListener("pointercancel", () => {
        this.swipeState = null;
      });
      this.boardElement.addEventListener("click", (e) => this.handleTileClick(e));

      this.saveScoreButton.addEventListener("click", () => this.saveScore());
      this.closeModalButton.addEventListener("click", () => {
        this.closeWinModal();
        this.startNewGame(true);
      });

      this.winModal.addEventListener("cancel", () => {
        this.startNewGame(false);
      });

      this.playerNameInput.addEventListener("keydown", (e) => {
        this.playerNameInput.classList.remove("input-error");
        if (e.key === "Enter") {
          e.preventDefault();
          this.saveScore();
        }
      });

      document.addEventListener("keydown", (e) => this.handleKeyPress(e));

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.pauseTimerLoop();
          this.saveToLocalStorage();
        } else if (this.isPlaying && this.hasMoved) {
          this.startTimerLoop();
        }
      });

      window.addEventListener("pagehide", () => {
        this.pauseTimerLoop();
        this.saveToLocalStorage();
      });
    }

    /* --- Audio (Lazy Unlock on First User Gesture) --- */
    unlockAudio() {
      if (!this.soundEnabled) return;
      try {
        if (!this.audioCtx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) this.audioCtx = new Ctx();
        }
        if (this.audioCtx && this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }
      } catch {}
    }

    syncSoundButton() {
      if (!this.soundButton) return;
      this.soundButton.setAttribute("aria-pressed", this.soundEnabled ? "true" : "false");
      this.soundButton.title = this.soundEnabled ? "Звук увімкнено" : "Звук вимкнено";
      this.soundOnIcon.classList.toggle("hidden", !this.soundEnabled);
      this.soundOffIcon.classList.toggle("hidden", this.soundEnabled);
    }

    playMoveSound() {
      if (!this.soundEnabled || !this.audioCtx || this.audioCtx.state !== "running") return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.value = 500 + Math.random() * 70;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.start(now);
        osc.stop(now + 0.065);
      } catch {}
    }

    playWinSound() {
      if (!this.soundEnabled || !this.audioCtx || this.audioCtx.state !== "running") return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          const t = this.audioCtx.currentTime + i * 0.11;
          gain.gain.setValueAtTime(0.13, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
          osc.start(t);
          osc.stop(t + 0.24);
        });
      } catch {}
    }

    /* --- Timer Management (Starts on First Move, Pauses in Background Tab) --- */
    startTimerLoop() {
      if (this.timerInterval || !this.isPlaying || !this.hasMoved || document.hidden) return;
      this.lastTickAt = performance.now();
      this.timerInterval = setInterval(() => {
        const now = performance.now();
        this.elapsedMs += Math.max(0, now - this.lastTickAt);
        this.lastTickAt = now;
        this.updateTimerDisplay();
      }, 250);
    }

    pauseTimerLoop() {
      if (!this.timerInterval) return;
      const now = performance.now();
      this.elapsedMs += Math.max(0, now - this.lastTickAt);
      this.lastTickAt = now;
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.updateTimerDisplay();
    }

    getElapsedSeconds() {
      return Math.max(1, Math.round(this.elapsedMs / 1000));
    }

    formatSeconds(totalSeconds) {
      const sec = Math.max(0, Math.floor(totalSeconds));
      const minutes = Math.floor(sec / 60);
      const seconds = sec % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    updateTimerDisplay() {
      this.timerElement.textContent = this.formatSeconds(Math.floor(this.elapsedMs / 1000));
    }

    updateMovesDisplay() {
      this.movesElement.textContent = String(this.moves);
    }

    /* --- Persistence & Validation --- */
    isValidBoard(arr) {
      if (!Array.isArray(arr) || arr.length !== 16) return false;
      const seen = new Set();
      for (const n of arr) {
        if (!Number.isInteger(n) || n < 0 || n > 15 || seen.has(n)) return false;
        seen.add(n);
      }
      return true;
    }

    restoreOrStartGame() {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          const state = JSON.parse(raw);
          if (
            state &&
            state.isPlaying &&
            this.isValidBoard(state.board) &&
            this.isSolvable(state.board) &&
            !this.checkWinCondition(state.board)
          ) {
            this.board = state.board;
            this.moves = Number.isInteger(state.moves) && state.moves >= 0 ? state.moves : 0;
            this.elapsedMs = Number.isFinite(state.elapsedMs) && state.elapsedMs >= 0 ? state.elapsedMs : 0;
            this.isPlaying = true;
            this.hasMoved = this.moves > 0;
            this.canSaveWin = false;
            this.updateMovesDisplay();
            this.updateTimerDisplay();
            this.renderBoard(null);
            if (this.hasMoved && !document.hidden) {
              this.startTimerLoop();
            }
            return;
          }
        }
      } catch {}

      this.startNewGame(false);
    }

    saveToLocalStorage() {
      try {
        if (!this.isPlaying || !this.hasMoved) return;
        localStorage.setItem(
          STATE_KEY,
          JSON.stringify({
            board: this.board,
            moves: this.moves,
            elapsedMs: Math.round(this.elapsedMs),
            isPlaying: this.isPlaying,
          })
        );
      } catch {}
    }

    clearSavedGame() {
      try {
        localStorage.removeItem(STATE_KEY);
      } catch {}
    }

    startNewGame(vibrateFeedback = false) {
      if (vibrateFeedback) this.vibrate(25);
      this.pauseTimerLoop();
      this.clearSavedGame();

      this.isPlaying = true;
      this.hasMoved = false;
      this.canSaveWin = false;
      this.moves = 0;
      this.elapsedMs = 0;

      this.updateMovesDisplay();
      this.updateTimerDisplay();
      this.board = this.createShuffledBoard();
      this.renderBoard(null);
      if (this.startBtnText) this.startBtnText.textContent = "Перемішати поле";
    }

    /* --- 15-Puzzle Math (Fisher-Yates + Exact Parity Invariant) --- */
    createShuffledBoard() {
      let numbers;
      do {
        numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
        for (let i = numbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
      } while (!this.isSolvable(numbers) || this.checkWinCondition(numbers));
      return numbers;
    }

    isSolvable(puzzle) {
      let inversions = 0;
      for (let i = 0; i < puzzle.length - 1; i++) {
        if (puzzle[i] === 0) continue;
        for (let j = i + 1; j < puzzle.length; j++) {
          if (puzzle[j] === 0) continue;
          if (puzzle[i] > puzzle[j]) inversions++;
        }
      }
      const emptyIndex = puzzle.indexOf(0);
      const emptyRowFromBottom = this.boardSize - Math.floor(emptyIndex / this.boardSize);

      if (this.boardSize % 2 !== 0) {
        return inversions % 2 === 0;
      }
      return emptyRowFromBottom % 2 === 0
        ? inversions % 2 !== 0
        : inversions % 2 === 0;
    }

    checkWinCondition(board) {
      for (let i = 0; i < 15; i++) {
        if (board[i] !== i + 1) return false;
      }
      return board[15] === 0;
    }

    /* --- True 60/120 FPS FLIP Board Rendering --- */
    ensureBoardCells() {
      let tiles = this.boardElement.querySelectorAll(".tile");
      if (tiles.length === 16) return tiles;

      this.boardElement.textContent = "";
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 16; i++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.setAttribute("role", "gridcell");
        tile.dataset.index = String(i);
        frag.appendChild(tile);
      }
      this.boardElement.appendChild(frag);
      return this.boardElement.querySelectorAll(".tile");
    }

    renderBoard(prevBoard = null) {
      const tiles = this.ensureBoardCells();
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let stepX = 0;
      let stepY = 0;
      let prevPos = null;

      if (prevBoard && !prefersReducedMotion) {
        stepX = tiles[1].offsetLeft - tiles[0].offsetLeft;
        stepY = tiles[4].offsetTop - tiles[0].offsetTop;
        prevPos = new Map();
        for (let i = 0; i < 16; i++) {
          if (prevBoard[i] !== 0) prevPos.set(prevBoard[i], i);
        }
      }

      const slidingTiles = [];

      this.board.forEach((number, index) => {
        const tile = tiles[index];
        if (tile._slideTimer) {
          clearTimeout(tile._slideTimer);
          tile._slideTimer = null;
        }
        tile.style.transition = "";
        tile.style.transform = "";
        tile.classList.remove("is-sliding");

        const isEmpty = number === 0;
        const isCorrect = !isEmpty && number === index + 1;
        tile.className = `tile${isEmpty ? " empty" : ""}${isCorrect ? " is-correct" : ""}`;
        tile.textContent = isEmpty ? "" : String(number);
        tile.setAttribute(
          "aria-label",
          isEmpty ? "Порожня клітинка" : `Плитка ${number}`
        );

        if (!isEmpty && prevPos && prevPos.has(number)) {
          const oldIndex = prevPos.get(number);
          if (oldIndex !== index && (stepX > 0 || stepY > 0)) {
            const dx = ((oldIndex % 4) - (index % 4)) * stepX;
            const dy = (Math.floor(oldIndex / 4) - Math.floor(index / 4)) * stepY;
            tile.classList.add("is-sliding");
            tile.style.transition = "none";
            tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
            slidingTiles.push(tile);
          }
        }
      });

      if (slidingTiles.length > 0) {
        void this.boardElement.offsetWidth;
        slidingTiles.forEach((tile) => {
          tile.style.transition = "transform 0.17s cubic-bezier(0.22, 1, 0.36, 1)";
          tile.style.transform = "translate3d(0, 0, 0)";
          tile._slideTimer = setTimeout(() => {
            tile.classList.remove("is-sliding");
            tile.style.transition = "";
            tile.style.transform = "";
            tile._slideTimer = null;
          }, 190);
        });
      }
    }

    /* --- Input: Touch Swipes, Clicks & Keyboard --- */
    handlePointerDown(e) {
      if (!this.isPlaying || (e.pointerType === "mouse" && e.button !== 0)) return;
      this.unlockAudio();
      const startTile = e.target.closest(".tile");
      const startTileIndex = startTile ? parseInt(startTile.dataset.index || "-1", 10) : -1;
      this.swipeState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTileIndex,
      };
    }

    handlePointerUp(e) {
      if (!this.swipeState || this.swipeState.pointerId !== e.pointerId) return;
      const { startX, startY, startTileIndex } = this.swipeState;
      this.swipeState = null;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < 22) return;

      this.suppressClickUntil = performance.now() + 90;

      const emptyIndex = this.board.indexOf(0);
      const emptyRow = Math.floor(emptyIndex / 4);
      const emptyCol = emptyIndex % 4;
      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      // Якщо свайп почався з плитки в одному ряду/колонці з порожньою клітинкою у її напрямку — рухаємо весь сегмент
      if (startTileIndex >= 0 && this.board[startTileIndex] !== 0) {
        const tRow = Math.floor(startTileIndex / 4);
        const tCol = startTileIndex % 4;
        if (
          (isHorizontal && tRow === emptyRow && Math.sign(dx) === Math.sign(emptyCol - tCol)) ||
          (!isHorizontal && tCol === emptyCol && Math.sign(dy) === Math.sign(emptyRow - tRow))
        ) {
          this.attemptMove(startTileIndex);
          return;
        }
      }

      // Загальний свайп по дошці зсуває сусідню плитку в напрямку руху пальця
      let targetIndex = -1;
      if (isHorizontal) {
        if (dx > 0 && emptyCol > 0) targetIndex = emptyIndex - 1;
        else if (dx < 0 && emptyCol < 3) targetIndex = emptyIndex + 1;
      } else {
        if (dy > 0 && emptyRow > 0) targetIndex = emptyIndex - 4;
        else if (dy < 0 && emptyRow < 3) targetIndex = emptyIndex + 4;
      }

      if (targetIndex !== -1) this.attemptMove(targetIndex);
    }

    handleTileClick(e) {
      if (performance.now() < this.suppressClickUntil) return;
      if (!this.isPlaying) return;
      this.unlockAudio();
      const tile = e.target.closest(".tile");
      if (!tile || tile.classList.contains("empty")) return;
      const clickedIndex = parseInt(tile.dataset.index || "-1", 10);
      if (clickedIndex >= 0) this.attemptMove(clickedIndex);
    }

    handleKeyPress(e) {
      if (!this.isPlaying || this.winModal.open) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement ? document.activeElement.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const emptyIndex = this.board.indexOf(0);
      const row = Math.floor(emptyIndex / 4);
      const col = emptyIndex % 4;
      let targetIndex = -1;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (row < 3) targetIndex = emptyIndex + 4;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          if (row > 0) targetIndex = emptyIndex - 4;
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          if (col < 3) targetIndex = emptyIndex + 1;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          if (col > 0) targetIndex = emptyIndex - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      this.unlockAudio();
      if (targetIndex !== -1) this.attemptMove(targetIndex);
    }

    attemptMove(clickedIndex) {
      const emptyIndex = this.board.indexOf(0);
      if (clickedIndex === emptyIndex) return;

      const clickedRow = Math.floor(clickedIndex / 4);
      const clickedCol = clickedIndex % 4;
      const emptyRow = Math.floor(emptyIndex / 4);
      const emptyCol = emptyIndex % 4;

      if (clickedRow !== emptyRow && clickedCol !== emptyCol) return;

      const prevBoard = this.board.slice();

      if (clickedRow === emptyRow) {
        const step = clickedCol < emptyCol ? 1 : -1;
        for (let c = emptyCol; c !== clickedCol; c -= step) {
          const i1 = clickedRow * 4 + c;
          const i2 = clickedRow * 4 + (c - step);
          [this.board[i1], this.board[i2]] = [this.board[i2], this.board[i1]];
        }
      } else {
        const step = clickedRow < emptyRow ? 1 : -1;
        for (let r = emptyRow; r !== clickedRow; r -= step) {
          const i1 = r * 4 + clickedCol;
          const i2 = (r - step) * 4 + clickedCol;
          [this.board[i1], this.board[i2]] = [this.board[i2], this.board[i1]];
        }
      }

      if (!this.hasMoved) {
        this.hasMoved = true;
        this.startTimerLoop();
      }

      this.moves++;
      this.updateMovesDisplay();
      this.vibrate(12);
      this.playMoveSound();
      this.renderBoard(prevBoard);

      if (this.checkWinCondition(this.board)) {
        this.handleWin();
      } else {
        this.saveToLocalStorage();
      }
    }

    vibrate(pattern) {
      if (typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(pattern);
        } catch {}
      }
    }

    /* --- Win Flow & Confetti --- */
    handleWin() {
      this.pauseTimerLoop();
      this.isPlaying = false;
      this.canSaveWin = true;
      this.clearSavedGame();

      const finalSec = this.getElapsedSeconds();
      this.timerElement.textContent = this.formatSeconds(finalSec);
      this.finalTimeEl.textContent = this.formatSeconds(finalSec);
      this.finalMovesEl.textContent = String(this.moves);

      setTimeout(() => {
        this.playWinSound();
        this.triggerConfetti();
        this.vibrate([80, 40, 120]);

        let savedName = "";
        try {
          savedName = localStorage.getItem(NAME_KEY) || "";
        } catch {}
        this.playerNameInput.value = savedName.slice(0, 20);
        this.playerNameInput.classList.remove("input-error");

        if (typeof this.winModal.showModal === "function") {
          this.winModal.showModal();
        } else {
          this.winModal.setAttribute("open", "");
        }
      }, 220);
    }

    closeWinModal() {
      if (typeof this.winModal.close === "function") {
        if (this.winModal.open) this.winModal.close();
      } else {
        this.winModal.removeAttribute("open");
      }
    }

    triggerConfetti() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const canvas = document.getElementById("confetti-canvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (this.confettiFrameId) cancelAnimationFrame(this.confettiFrameId);
      if (this.confettiStopTimer) clearTimeout(this.confettiStopTimer);

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const colors = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6"];
      const pieces = Array.from({ length: 110 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 9 + 5,
        h: Math.random() * 5 + 4,
        c: colors[Math.floor(Math.random() * colors.length)],
        dy: Math.random() * 3 + 2.2,
        dx: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        dRot: Math.random() * 5 - 2.5,
      }));

      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        for (const p of pieces) {
          p.y += p.dy;
          p.x += p.dx;
          p.rot += p.dRot;
          p.dy += 0.045;
          if (p.y < canvas.height + 20) active = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        if (active) {
          this.confettiFrameId = requestAnimationFrame(draw);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          this.confettiFrameId = null;
        }
      };

      draw();
      this.confettiStopTimer = setTimeout(() => {
        if (this.confettiFrameId) {
          cancelAnimationFrame(this.confettiFrameId);
          this.confettiFrameId = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 4500);
    }

    /* --- Validated Local Top-10 Leaderboard (XSS-Safe DOM Construction) --- */
    readRecords() {
      try {
        const raw = localStorage.getItem(RECORDS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter(
            (r) =>
              r &&
              typeof r.name === "string" &&
              r.name.trim().length > 0 &&
              Number.isInteger(r.moves) &&
              r.moves >= 1 &&
              Number.isInteger(r.time) &&
              r.time >= 1
          )
          .map((r) => ({
            id: typeof r.id === "string" ? r.id : `${r.time}-${r.moves}`,
            name: r.name.trim().slice(0, 20),
            moves: r.moves,
            time: r.time,
          }))
          .sort((a, b) => (a.time === b.time ? a.moves - b.moves : a.time - b.time))
          .slice(0, MAX_RECORDS);
      } catch {
        return [];
      }
    }

    renderLeaderboard() {
      const records = this.readRecords();
      this.leaderboardList.textContent = "";

      if (records.length === 0) {
        const empty = document.createElement("div");
        empty.className = "leaderboard-empty";
        empty.textContent = "Рекордів ще немає. Збери поле 1–15, щоб відкрити таблицю.";
        this.leaderboardList.appendChild(empty);
        return;
      }

      const frag = document.createDocumentFragment();
      records.forEach((rec, index) => {
        const item = document.createElement("div");
        item.className = `leaderboard-item${rec.id === this.latestRecordId ? " is-latest" : ""}`;

        const info = document.createElement("div");
        info.className = "player-info";

        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = `#${index + 1}`;

        const name = document.createElement("span");
        name.className = "player-name";
        name.textContent = rec.name;

        info.appendChild(rank);
        info.appendChild(name);

        const stats = document.createElement("div");
        stats.className = "player-stats";

        const timeEl = document.createElement("span");
        timeEl.className = "time";
        timeEl.textContent = this.formatSeconds(rec.time);

        const movesEl = document.createElement("span");
        movesEl.textContent = `${rec.moves} ходів`;

        stats.appendChild(timeEl);
        stats.appendChild(movesEl);

        item.appendChild(info);
        item.appendChild(stats);
        frag.appendChild(item);
      });

      this.leaderboardList.appendChild(frag);
    }

    saveScore() {
      if (!this.canSaveWin || !this.checkWinCondition(this.board) || this.moves < 1) {
        this.closeWinModal();
        return;
      }

      const cleanName = this.playerNameInput.value.trim().slice(0, 20);
      if (!cleanName) {
        this.playerNameInput.classList.remove("input-error");
        void this.playerNameInput.offsetWidth;
        this.playerNameInput.classList.add("input-error");
        this.playerNameInput.focus();
        return;
      }

      this.canSaveWin = false;
      const finalSec = this.getElapsedSeconds();
      const recordId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const updated = this.readRecords();
      updated.push({
        id: recordId,
        name: cleanName,
        moves: this.moves,
        time: finalSec,
      });
      updated.sort((a, b) => (a.time === b.time ? a.moves - b.moves : a.time - b.time));
      const trimmed = updated.slice(0, MAX_RECORDS);

      try {
        localStorage.setItem(NAME_KEY, cleanName);
        localStorage.setItem(RECORDS_KEY, JSON.stringify(trimmed));
      } catch {}

      this.latestRecordId = recordId;
      this.renderLeaderboard();
      this.closeWinModal();
      this.startNewGame(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    new FifteenPuzzle();
  });
})();
