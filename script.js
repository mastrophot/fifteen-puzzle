const firebaseConfig = {
  apiKey: "REVOKED_GOOGLE_API_KEY",
  authDomain: "fifteen-puzzle-3227b.firebaseapp.com",
  projectId: "fifteen-puzzle-3227b",
  storageBucket: "fifteen-puzzle-3227b.firebasestorage.app",
  messagingSenderId: "560464007874",
  appId: "1:560464007874:web:ba6230a27faa4e1d8fe15b",
  databaseURL: "https://fifteen-puzzle-3227b-default-rtdb.firebaseio.com",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();

class FifteenPuzzle {
  constructor() {
    this.boardSize = 4;
    this.board = [];
    this.moves = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.isPlaying = false;

    this.initializeElements();
    this.initializeEventListeners();

    // Initial setup
    this.board = Array.from({ length: 15 }, (_, i) => i + 1).concat([0]);
    this.renderBoard(false);
  }

  initializeElements() {
    this.boardElement = document.querySelector(".game-board");
    this.movesElement = document.getElementById("moves");
    this.timerElement = document.getElementById("timer");
    this.startButton = document.getElementById("startGame");

    // Modal elements
    this.winModal = document.getElementById("winModal");
    this.saveScoreButton = document.getElementById("saveScore");
    this.closeModalButton = document.getElementById("closeModal");
    this.playerNameInput = document.getElementById("playerName");

    // Leaderboard
    this.leaderboardList = document.getElementById("leaderboardList");

    // Audio
    this.moveSound = document.getElementById("moveSound");
    this.winSound = document.getElementById("winSound");

    if (this.moveSound) this.moveSound.volume = 0.5;
    if (this.winSound) this.winSound.volume = 0.7;
  }

  initializeEventListeners() {
    this.startButton.addEventListener("click", () => this.startNewGame());
    this.boardElement.addEventListener("click", (e) => this.handleTileClick(e));

    // Modal interactions
    this.saveScoreButton.addEventListener("click", () => this.saveScore());
    this.closeModalButton.addEventListener("click", () =>
      this.winModal.close(),
    );
    this.playerNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.saveScore();
    });

    // Keyboard support
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));

    // Load scores on init
    this.loadLeaderboard();
  }

  startNewGame() {
    // Haptic feedback if supported
    this.vibrate(50);

    this.isPlaying = true;
    this.moves = 0;
    this.timer = 0;

    this.updateMoves();
    this.updateTimer();

    this.board = this.createShuffledBoard();

    // Add a nice shuffle animation effect
    this.boardElement.style.opacity = "0";
    this.boardElement.style.transform = "scale(0.95)";

    setTimeout(() => {
      this.renderBoard(false);
      this.boardElement.style.transition =
        "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      this.boardElement.style.opacity = "1";
      this.boardElement.style.transform = "scale(1)";
    }, 150);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timer++;
      this.updateTimer();
    }, 1000);

    // Reset button glow effect
    const btnText = this.startButton.querySelector(".button-content");
    if (btnText) btnText.textContent = "Перезапустити";
  }

  createShuffledBoard() {
    let numbers;
    do {
      numbers = Array.from({ length: 15 }, (_, i) => i + 1);
      numbers.push(0);
      // Fisher-Yates shuffle
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
    const emptyRow = Math.floor(emptyIndex / this.boardSize);
    // Distance from bottom
    const rowFromBottom = this.boardSize - 1 - emptyRow;

    if (this.boardSize % 2 !== 0) {
      return inversions % 2 === 0;
    } else {
      return rowFromBottom % 2 === 0
        ? inversions % 2 !== 0
        : inversions % 2 === 0;
    }
  }

  renderBoard(animate = false) {
    const tiles = this.boardElement.querySelectorAll(".tile");

    if (tiles.length === 0) {
      // First render
      this.boardElement.innerHTML = "";
      for (let i = 0; i < 16; i++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.index = i;

        // Add 3D hover effect logic natively via JS
        tile.addEventListener("mousemove", (e) =>
          this.handleTileHover(e, tile),
        );
        tile.addEventListener("mouseleave", () => {
          tile.style.transform = "";
        });

        this.boardElement.appendChild(tile);
      }
    }

    const currentTiles = this.boardElement.querySelectorAll(".tile");

    this.board.forEach((number, index) => {
      const tile = currentTiles[index];
      tile.className = `tile${number === 0 ? " empty" : ""}`;

      if (animate && tile.textContent != number && number !== 0) {
        tile.classList.add("moving");
        setTimeout(() => tile.classList.remove("moving"), 250);
      }

      tile.textContent = number === 0 ? "" : number;

      // Set position based on index (CSS Grid handles layout, but we could use absolute for better sliding)
      // Keeping Grid for simplicity but relying on DOM order swap
    });
  }

  handleTileHover(e, tile) {
    if (tile.classList.contains("empty") || tile.classList.contains("moving"))
      return;

    const rect = tile.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate tilt
    const xPct = x / rect.width;
    const yPct = y / rect.height;

    const maxTilt = 15; // deg
    const tiltX = (0.5 - yPct) * maxTilt * 2;
    const tiltY = (xPct - 0.5) * maxTilt * 2;

    tile.style.transform = `translateZ(10px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
  }

  handleTileClick(e) {
    if (!this.isPlaying) return;
    const tile = e.target.closest(".tile");
    if (!tile || tile.classList.contains("empty")) return;

    const clickedIndex = Array.from(this.boardElement.children).indexOf(tile);
    this.attemptMove(clickedIndex);
  }

  handleKeyPress(e) {
    if (!this.isPlaying) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }

    const emptyIndex = this.board.indexOf(0);
    const row = Math.floor(emptyIndex / this.boardSize);
    const col = emptyIndex % this.boardSize;

    let targetIndex = -1;

    // Arrow keys move tiles *into* the empty space.
    // E.g., ArrowUp should push the tile *below* the empty space UP into it.
    switch (e.key) {
      case "ArrowUp":
        if (row < this.boardSize - 1) targetIndex = emptyIndex + this.boardSize;
        break;
      case "ArrowDown":
        if (row > 0) targetIndex = emptyIndex - this.boardSize;
        break;
      case "ArrowLeft":
        if (col < this.boardSize - 1) targetIndex = emptyIndex + 1;
        break;
      case "ArrowRight":
        if (col > 0) targetIndex = emptyIndex - 1;
        break;
    }

    if (targetIndex !== -1) {
      this.attemptMove(targetIndex);
    }
  }

  attemptMove(clickedIndex) {
    const emptyIndex = this.board.indexOf(0);

    const clickedRow = Math.floor(clickedIndex / this.boardSize);
    const clickedCol = clickedIndex % this.boardSize;
    const emptyRow = Math.floor(emptyIndex / this.boardSize);
    const emptyCol = emptyIndex % this.boardSize;

    // Check if movement is valid (same row or same collumn)
    if (clickedRow === emptyRow || clickedCol === emptyCol) {
      // Generate intermediate states to allow multi-tile sliding
      let moves = [];

      if (clickedRow === emptyRow) {
        // Horizontal move
        const step = clickedCol < emptyCol ? 1 : -1;
        for (let c = emptyCol; c !== clickedCol; c -= step) {
          moves.push([
            clickedRow * this.boardSize + c,
            clickedRow * this.boardSize + (c - step),
          ]);
        }
      } else {
        // Vertical move
        const step = clickedRow < emptyRow ? 1 : -1;
        for (let r = emptyRow; r !== clickedRow; r -= step) {
          moves.push([
            r * this.boardSize + clickedCol,
            (r - step) * this.boardSize + clickedCol,
          ]);
        }
      }

      // Execute swaps
      for (let [idx1, idx2] of moves) {
        [this.board[idx1], this.board[idx2]] = [
          this.board[idx2],
          this.board[idx1],
        ];
      }

      this.vibrate(15);
      this.playMoveSound();

      this.renderBoard(true);

      this.moves++;
      this.updateMoves();

      if (this.checkWinCondition(this.board)) {
        setTimeout(() => this.gameWon(), 300); // Wait for animation
      }
    }
  }

  playMoveSound() {
    if (this.moveSound) {
      this.moveSound.currentTime = 0;
      // Slightly randomize pitch for better feel
      this.moveSound.playbackRate = 0.9 + Math.random() * 0.2;
      this.moveSound.play().catch((e) => console.log("Audio play failed:", e));
    }
  }

  vibrate(ms) {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  checkWinCondition(board) {
    for (let i = 0; i < 15; i++) {
      if (board[i] !== i + 1) return false;
    }
    return board[15] === 0;
  }

  gameWon() {
    this.isPlaying = false;
    clearInterval(this.timerInterval);

    if (this.winSound) {
      this.winSound.currentTime = 0;
      this.winSound.play().catch((e) => console.log("Audio play failed:", e));
    }

    this.triggerConfetti();
    this.vibrate([100, 50, 100, 50, 200]);

    const finalTimeStr = this.timerElement.textContent;
    const finalMovesStr = this.moves.toString();

    document.getElementById("finalTime").textContent = finalTimeStr;
    document.getElementById("finalMoves").textContent = finalMovesStr;

    // Reset player input
    this.playerNameInput.value = "";

    // Show native `<dialog>`
    if (typeof this.winModal.showModal === "function") {
      this.winModal.showModal();
    } else {
      this.winModal.setAttribute("open", "");
    }
  }

  updateMoves() {
    this.movesElement.textContent = this.moves;
    // Small pop animation
    this.movesElement.style.transform = "scale(1.2)";
    this.movesElement.style.color = "var(--text-color)";
    setTimeout(() => {
      this.movesElement.style.transform = "";
      this.movesElement.style.color = "";
    }, 150);
  }

  updateTimer() {
    const minutes = Math.floor(this.timer / 60);
    const seconds = this.timer % 60;
    this.timerElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // Confetti implementation embedded (no external libraries needed)
  triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f472b6"];

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 5 + 5,
        c: colors[Math.floor(Math.random() * colors.length)],
        dy: Math.random() * 3 + 2,
        dx: Math.random() * 2 - 1,
        rot: Math.random() * 360,
        dRot: Math.random() * 5 - 2.5,
      });
    }

    let animationId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      pieces.forEach((p) => {
        p.y += p.dy;
        p.x += p.dx;
        p.rot += p.dRot;
        p.dy += 0.05; // gravity

        if (p.y < canvas.height) active = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (active) {
        animationId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    draw();

    // Stop animation after 5 seconds to clear memory
    setTimeout(() => cancelAnimationFrame(animationId), 5000);
  }

  loadLeaderboard() {
    const leaderboardRef = database.ref("leaderboard");

    return leaderboardRef
      .orderByChild("time")
      .limitToFirst(10)
      .once("value")
      .then((snapshot) => {
        this.leaderboardList.innerHTML = "";
        const scores = [];
        snapshot.forEach((childSnapshot) => {
          scores.push({
            ...childSnapshot.val(),
            key: childSnapshot.key,
          });
        });

        scores.sort((a, b) => {
          if (a.time === b.time) return a.moves - b.moves;
          return a.time - b.time;
        });

        if (scores.length === 0) {
          this.leaderboardList.innerHTML =
            '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Ще немає рекордів. Будьте першим!</div>';
          return;
        }

        // Staggered animation reveal
        scores.forEach((score, index) => {
          const minutes = Math.floor(score.time / 60);
          const seconds = score.time % 60;
          const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

          const item = document.createElement("div");
          item.className = "leaderboard-item";
          item.style.animationDelay = `${index * 0.05}s`;

          item.innerHTML = `
                        <div class="player-info">
                            <span class="rank">#${index + 1}</span>
                            <span class="player-name">${this.escapeHTML(score.name)}</span>
                        </div>
                        <div class="player-stats">
                            <span class="time">${timeStr}</span>
                            <span>${score.moves} ходів</span>
                        </div>
                    `;
          this.leaderboardList.appendChild(item);
        });
      })
      .catch((error) => {
        console.error("Помилка завантаження таблиці рекордів:", error);
        this.leaderboardList.innerHTML =
          '<div style="color: #ef4444; padding: 20px; text-align:center;">Помилка завантаження. Спробуйте оновити сторінку.</div>';
      });
  }

  async saveScore() {
    const playerNameStr = this.playerNameInput.value.trim();
    if (!playerNameStr) {
      // Shake animation for input
      this.playerNameInput.style.animation = "shake 0.5s";
      setTimeout(() => (this.playerNameInput.style.animation = ""), 500);
      return;
    }

    const scoreBtnPrevText = this.saveScoreButton.textContent;
    this.saveScoreButton.textContent = "Збереження...";
    this.saveScoreButton.disabled = true;

    const score = {
      name: playerNameStr,
      moves: this.moves,
      time: this.timer,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    try {
      const leaderboardRef = database.ref("leaderboard");
      await leaderboardRef.push(score);

      if (typeof this.winModal.close === "function") {
        this.winModal.close();
      } else {
        this.winModal.removeAttribute("open");
      }

      // Reload with animation
      this.leaderboardList.innerHTML = `
                <div class="loading-skeleton"></div>
                <div class="loading-skeleton"></div>
                <div class="loading-skeleton"></div>
            `;
      await this.loadLeaderboard();
    } catch (error) {
      console.error("Помилка збереження:", error);
      alert("Помилка збереження. Перевірте з'єднання.");
    } finally {
      this.saveScoreButton.textContent = scoreBtnPrevText;
      this.saveScoreButton.disabled = false;
    }
  }

  escapeHTML(str) {
    return str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[tag] || tag,
    );
  }
}

// Add a quick keyframe for the shake error dynamically or rely on CSS. Let's add it via DOM.
const style = document.createElement("style");
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", () => {
  window.game = new FifteenPuzzle();
});
