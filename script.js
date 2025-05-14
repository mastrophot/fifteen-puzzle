const firebaseConfig = {
    apiKey: "AIzaSyBZCUbC50uz3wtF27Oad2OIceODcVa5cyk",
    authDomain: "fifteen-puzzle-3227b.firebaseapp.com",
    projectId: "fifteen-puzzle-3227b",
    storageBucket: "fifteen-puzzle-3227b.firebasestorage.app",
    messagingSenderId: "560464007874",
    appId: "1:560464007874:web:ba6230a27faa4e1d8fe15b",
    databaseURL: "https://fifteen-puzzle-3227b-default-rtdb.firebaseio.com"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
class FifteenPuzzle {
    constructor() {
        this.board = [];
        this.moves = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.isPlaying = false;
        this.initializeElements();
        this.initializeEventListeners();
    }
    initializeElements() {
        this.boardElement = document.querySelector('.game-board');
        this.movesElement = document.getElementById('moves');
        this.timerElement = document.getElementById('timer');
        this.startButton = document.getElementById('startGame');
        this.modal = document.querySelector('.modal');
        this.saveScoreButton = document.getElementById('saveScore');
        this.playerNameInput = document.getElementById('playerName');
        this.leaderboardList = document.getElementById('leaderboardList');
    }
    initializeEventListeners() {
        this.startButton.addEventListener('click', () => this.startNewGame());
        this.boardElement.addEventListener('click', (e) => this.handleTileClick(e));
        this.saveScoreButton.addEventListener('click', () => this.saveScore());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.loadLeaderboard();
    }
    startNewGame() {
        this.isPlaying = true;
        this.moves = 0;
        this.timer = 0;
        this.updateMoves();
        this.updateTimer();
        this.board = this.createShuffledBoard();
        this.renderBoard();
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateTimer();
        }, 1000);
    }
    createShuffledBoard() {
        let numbers;
        do {
            numbers = Array.from({length: 15}, (_, i) => i + 1);
            numbers.push(0); 
            for (let i = numbers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
            }
        } while (!this.isSolvable(numbers));
        return numbers;
    }
    isSolvable(puzzle) {
        let inversions = 0;
        for (let i = 0; i < puzzle.length - 1; i++) {
            if (puzzle[i] === 0) continue;
            for (let j = i + 1; j < puzzle.length; j++) {
                if (puzzle[j] === 0) continue;
                if (puzzle[i] > puzzle[j]) {
                    inversions++;
                }
            }
        }
        const emptyIndex = puzzle.indexOf(0);
        const emptyRow = Math.floor(emptyIndex / 4);
        const rowFromBottom = 3 - emptyRow;
        return (rowFromBottom % 2 === 0) === (inversions % 2 === 0);
    }
    renderBoard() {
        this.boardElement.innerHTML = '';
        this.board.forEach((number, index) => {
            const tile = document.createElement('div');
            tile.className = `tile${number === 0 ? ' empty' : ''}`;
            tile.dataset.index = index;
            if (number !== 0) tile.textContent = number;
            this.boardElement.appendChild(tile);
        });
    }
    handleTileClick(e) {
        if (!this.isPlaying) return;
        const tile = e.target.closest('.tile');
        if (!tile || tile.classList.contains('empty')) return;
        const clickedIndex = parseInt(tile.dataset.index);
        const emptyIndex = this.board.indexOf(0);
        const clickedRow = Math.floor(clickedIndex / 4);
        const clickedCol = clickedIndex % 4;
        const emptyRow = Math.floor(emptyIndex / 4);
        const emptyCol = emptyIndex % 4;
        if (clickedRow === emptyRow || clickedCol === emptyCol) {
            if (clickedRow === emptyRow) {
                const start = Math.min(clickedCol, emptyCol);
                const end = Math.max(clickedCol, emptyCol);
                if (clickedCol < emptyCol) {
                    for (let col = emptyCol - 1; col >= clickedCol; col--) {
                        const currentIndex = clickedRow * 4 + col;
                        const nextIndex = currentIndex + 1;
                        [this.board[currentIndex], this.board[nextIndex]] = 
                        [this.board[nextIndex], this.board[currentIndex]];
                    }
                } else {
                    for (let col = emptyCol + 1; col <= clickedCol; col++) {
                        const currentIndex = clickedRow * 4 + col;
                        const prevIndex = currentIndex - 1;
                        [this.board[currentIndex], this.board[prevIndex]] = 
                        [this.board[prevIndex], this.board[currentIndex]];
                    }
                }
            } else {
                const start = Math.min(clickedRow, emptyRow);
                const end = Math.max(clickedRow, emptyRow);
                if (clickedRow < emptyRow) {
                    for (let row = emptyRow - 1; row >= clickedRow; row--) {
                        const currentIndex = row * 4 + clickedCol;
                        const nextIndex = currentIndex + 4;
                        [this.board[currentIndex], this.board[nextIndex]] = 
                        [this.board[nextIndex], this.board[currentIndex]];
                    }
                } else {
                    for (let row = emptyRow + 1; row <= clickedRow; row++) {
                        const currentIndex = row * 4 + clickedCol;
                        const prevIndex = currentIndex - 4;
                        [this.board[currentIndex], this.board[prevIndex]] = 
                        [this.board[prevIndex], this.board[currentIndex]];
                    }
                }
            }
            this.renderBoard();
            this.moves++;
            this.updateMoves();
            if (this.checkWin()) {
                this.gameWon();
            }
        }
    }
    checkWin() {
        return this.board.every((number, index) => 
            (index === 15 && number === 0) || (number === index + 1)
        );
    }
    gameWon() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        const finalTimeStr = this.timerElement.textContent;
        const finalMovesStr = this.moves.toString();
        document.getElementById('finalTime').textContent = finalTimeStr;
        document.getElementById('finalMoves').textContent = finalMovesStr;
        this.modal.style.display = 'block';
    }
    updateMoves() {
        this.movesElement.textContent = this.moves;
    }
    updateTimer() {
        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        this.timerElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    handleKeyPress(e) {
        if (!this.isPlaying) return;
        const emptyIndex = this.board.indexOf(0);
        const row = Math.floor(emptyIndex / 4);
        const col = emptyIndex % 4;
        let targetIndex = -1;
        switch(e.key) {
            case 'ArrowUp':
                if (row < 3) {
                    targetIndex = emptyIndex + 4;
                }
                break;
            case 'ArrowDown':
                if (row > 0) {
                    targetIndex = emptyIndex - 4;
                }
                break;
            case 'ArrowLeft':
                if (col < 3) {
                    targetIndex = emptyIndex + 1;
                }
                break;
            case 'ArrowRight':
                if (col > 0) {
                    targetIndex = emptyIndex - 1;
                }
                break;
        }
        if (targetIndex !== -1 && targetIndex >= 0 && targetIndex < 16) {
            [this.board[emptyIndex], this.board[targetIndex]] = [this.board[targetIndex], this.board[emptyIndex]];
            this.renderBoard();
            this.moves++;
            this.updateMoves();
            if (this.checkWin()) {
                this.gameWon();
            }
        }
    }
    loadLeaderboard() {
        console.log('Завантаження таблиці рекордів...');
        const leaderboardRef = database.ref('leaderboard');
        return leaderboardRef
            .orderByChild('time')
            .limitToFirst(10)
            .once('value')
            .then(snapshot => {
                this.leaderboardList.innerHTML = '';
                const scores = [];
                snapshot.forEach(childSnapshot => {
                    scores.push({
                        ...childSnapshot.val(),
                        key: childSnapshot.key
                    });
                });
                scores.sort((a, b) => {
                    if (a.time === b.time) {
                        return a.moves - b.moves;
                    }
                    return a.time - b.time;
                });
                scores.forEach((score, index) => {
                    const minutes = Math.floor(score.time / 60);
                    const seconds = score.time % 60;
                    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    item.innerHTML = `
                        <span>${index + 1}. ${score.name}</span>
                        <span>Час: ${timeStr} | Ходів: ${score.moves}</span>
                    `;
                    this.leaderboardList.appendChild(item);
                });
            })
            .catch(error => {
                console.error('Помилка завантаження таблиці рекордів:', error);
                this.leaderboardList.innerHTML = '<div class="error-message">Помилка завантаження рекордів</div>';
            });
    }
    async saveScore() {
        console.log('Спроба зберегти результат...');
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            alert('Будь ласка, введіть ваше ім\'я');
            return;
        }
        const score = {
            name: playerName,
            moves: this.moves,
            time: this.timer,
            timestamp: Date.now()
        };
        console.log('Дані для збереження:', score);
        try {
            const leaderboardRef = database.ref('leaderboard');
            await leaderboardRef.push(score);
            console.log('Результат збережено успішно');
            
            this.modal.style.display = 'none';
            this.playerNameInput.value = '';
            await this.loadLeaderboard();
            
        } catch (error) {
            console.error('Помилка збереження:', error);
            alert('Помилка збереження результату: ' + error.message);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new FifteenPuzzle();
});
