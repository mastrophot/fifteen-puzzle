// Ініціалізація Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBZCUbC50uz3wtF27Oad2OIceODcVa5cyk",
    authDomain: "fifteen-puzzle-3227b.firebaseapp.com",
    projectId: "fifteen-puzzle-3227b",
    storageBucket: "fifteen-puzzle-3227b.firebasestorage.app",
    messagingSenderId: "560464007874",
    appId: "1:560464007874:web:ba6230a27faa4e1d8fe15b",
    databaseURL: "https://fifteen-puzzle-3227b-default-rtdb.europe-west1.firebasedatabase.app" // Додаємо URL бази даних
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
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
        const numbers = Array.from({length: 15}, (_, i) => i + 1);
        numbers.push(0); // 0 представляє пусту клітинку
        
        // Перемішуємо дошку
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        // Перевіряємо чи можливо розв'язати головоломку
        if (!this.isSolvable(numbers)) {
            // Якщо ні, міняємо місцями дві перші клітинки
            [numbers[0], numbers[1]] = [numbers[1], numbers[0]];
        }
        
        return numbers;
    }

    isSolvable(puzzle) {
        let inversions = 0;
        const emptyTileRow = Math.floor(puzzle.indexOf(0) / 4) + 1;
        
        for (let i = 0; i < puzzle.length - 1; i++) {
            if (puzzle[i] === 0) continue;
            for (let j = i + 1; j < puzzle.length; j++) {
                if (puzzle[j] === 0) continue;
                if (puzzle[i] > puzzle[j]) inversions++;
            }
        }
        
        // Головоломка розв'язується, якщо:
        // 1. Ширина дошки парна (в нашому випадку 4)
        // 2. Пуста клітинка знаходиться на парному рядку знизу і кількість інверсій непарна
        // АБО пуста клітинка знаходиться на непарному рядку знизу і кількість інверсій парна
        return (emptyTileRow % 2 === 0) === (inversions % 2 === 0);
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
        
        const index = parseInt(tile.dataset.index);
        if (this.canMoveTile(index)) {
            this.moveTile(index);
            this.moves++;
            this.updateMoves();
            
            if (this.checkWin()) {
                this.gameWon();
            }
        }
    }

    canMoveTile(index) {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const emptyIndex = this.board.indexOf(0);
        const emptyRow = Math.floor(emptyIndex / 4);
        const emptyCol = emptyIndex % 4;
        
        return (
            (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
            (Math.abs(col - emptyCol) === 1 && row === emptyRow)
        );
    }

    moveTile(index) {
        const emptyIndex = this.board.indexOf(0);
        [this.board[index], this.board[emptyIndex]] = [this.board[emptyIndex], this.board[index]];
        this.renderBoard();
    }

    checkWin() {
        return this.board.every((number, index) => 
            (index === 15 && number === 0) || (number === index + 1)
        );
    }

    gameWon() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
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

    async saveScore() {
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

        try {
            await database.ref('leaderboard').push(score);
            this.modal.style.display = 'none';
            this.loadLeaderboard();
        } catch (error) {
            console.error('Помилка збереження результату:', error);
            alert('Помилка збереження результату. Спробуйте ще раз.');
        }
    }

    loadLeaderboard() {
        database.ref('leaderboard')
            .orderByChild('moves')
            .limitToFirst(10)
            .on('value', (snapshot) => {
                this.leaderboardList.innerHTML = '';
                const scores = [];
                
                snapshot.forEach((childSnapshot) => {
                    scores.push(childSnapshot.val());
                });
                
                scores.sort((a, b) => {
                    if (a.moves === b.moves) {
                        return a.time - b.time;
                    }
                    return a.moves - b.moves;
                });
                
                scores.forEach((score, index) => {
                    const minutes = Math.floor(score.time / 60);
                    const seconds = score.time % 60;
                    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    item.innerHTML = `
                        <span>${index + 1}. ${score.name}</span>
                        <span>Ходів: ${score.moves} | Час: ${timeStr}</span>
                    `;
                    this.leaderboardList.appendChild(item);
                });
            });
    }
}

// Створюємо екземпляр гри після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
    new FifteenPuzzle();
});
