const overlay = document.getElementById("setup-overlay");
const mainContent = document.getElementById("main-content");
const startBtn = document.getElementById("start-game-btn");
const p1Input = document.getElementById("p1-input");
const p2Input = document.getElementById("p2-input");
const errorMsg = document.getElementById("error-msg");

const cells = document.querySelectorAll(".cell");
const statusDisplay = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const audioBtn = document.getElementById("audio-toggle");

// --- AUDIO CONFIGURATION ---
const sounds = {
  start: new Audio("assets/start.mp3"),
  moveX: new Audio("assets/moveX.mp3"),
  moveO: new Audio("assets/moveO.mp3"),
  win: new Audio("assets/win.mp3"),
  draw: new Audio("assets/draw.mp3"),
};

let isMuted = false;
let player1 = { name: "", score: 0 };
let player2 = { name: "", score: 0 };
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];
let gameActive = true;
let gameMode = "pvp"; // 'pvp' or 'pvc'

const winningConditions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function playSound(name) {
  if (!isMuted && sounds[name]) {
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => console.log("Audio blocked"));
  }
}

audioBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  audioBtn.innerText = isMuted ? "🔇" : "🔊";
});

// --- SETUP LOGIC ---
document.querySelectorAll('input[name="game-mode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    gameMode = e.target.value;
    if (gameMode === "pvc") {
      p2Input.style.display = "none";
      p2Input.value = "Machine";
    } else {
      p2Input.style.display = "block";
      p2Input.value = "";
    }
  });
});

p1Input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (p1Input.value.trim() === "") {
      errorMsg.innerText = "Please enter Player X's name!";
    } else if (gameMode === "pvp") {
      p2Input.focus();
    } else {
      initGame();
    }
  }
});

p2Input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && gameMode === "pvp") {
    e.preventDefault();
    initGame();
  }
});

startBtn.addEventListener("click", initGame);

function initGame() {
  const n1 = p1Input.value.trim();
  const n2 = p2Input.value.trim();

  if (!n1 || !n2) {
    errorMsg.innerText = "Names are required!";
    return;
  }

  playSound("start");
  player1.name = n1;
  player2.name = n2;

  document.getElementById("p1-name-display").innerText = player1.name;
  document.getElementById("p2-name-display").innerText = player2.name;

  overlay.classList.add("hidden");
  mainContent.classList.remove("hidden");
  updateStatusText();
}

// --- GAMEPLAY LOGIC ---
function handleCellClick(e) {
  const index = e.target.getAttribute("data-index");
  if (gameState[index] !== "" || !gameActive) return;

  // Human Move
  executeMove(index);

  // Machine Move logic (Calling the Advanced Minimax Move)
  if (gameActive && gameMode === "pvc" && currentPlayer === "O") {
    setTimeout(advancedCPUMove, 600);
  }
}

function executeMove(index) {
  if (currentPlayer === "X") playSound("moveX");
  else playSound("moveO");

  gameState[index] = currentPlayer;
  const cell = document.querySelector(`[data-index="${index}"]`);
  cell.innerText = currentPlayer;
  cell.classList.add(currentPlayer.toLowerCase());

  checkResult();
}

// --- UNBEATABLE MINIMAX ALGORITHM ---
function advancedCPUMove() {
  let bestScore = -Infinity;
  let move;
  for (let i = 0; i < 9; i++) {
    if (gameState[i] === "") {
      gameState[i] = "O";
      let score = minimax(gameState, 0, false);
      gameState[i] = "";
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  if (move !== undefined) executeMove(move);
}

function minimax(board, depth, isMaximizing) {
  let result = checkWinnerRaw();
  if (result === "O") return 10 - depth;
  if (result === "X") return depth - 10;
  if (!board.includes("")) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = "O";
        let score = minimax(board, depth + 1, false);
        board[i] = "";
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = "X";
        let score = minimax(board, depth + 1, true);
        board[i] = "";
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function checkWinnerRaw() {
  for (let combo of winningConditions) {
    if (
      gameState[combo[0]] &&
      gameState[combo[0]] === gameState[combo[1]] &&
      gameState[combo[0]] === gameState[combo[2]]
    ) {
      return gameState[combo[0]];
    }
  }
  return null;
}

function updateStatusText() {
  const name = currentPlayer === "X" ? player1.name : player2.name;
  statusDisplay.innerText = `${name}'s Turn (${currentPlayer})`;
}

function checkResult() {
  let roundWon = false;
  let winningCombo = [];

  for (let condition of winningConditions) {
    let [a, b, c] = condition;
    if (
      gameState[a] &&
      gameState[a] === gameState[b] &&
      gameState[a] === gameState[c]
    ) {
      roundWon = true;
      winningCombo = condition;
      break;
    }
  }

  if (roundWon) {
    playSound("win");
    const winner = currentPlayer === "X" ? player1 : player2;
    statusDisplay.innerText = `${winner.name} Wins! 🎉`;
    winner.score++;
    document.getElementById(
      `p${currentPlayer === "X" ? 1 : 2}-score`
    ).innerText = winner.score;
    winningCombo.forEach((idx) => cells[idx].classList.add("winner-cell"));
    gameActive = false;
    return;
  }

  if (!gameState.includes("")) {
    playSound("draw");
    statusDisplay.innerText = "It's a Draw! 🤝";
    gameActive = false;
    return;
  }

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  updateStatusText();
}

function resetBoard() {
  currentPlayer = "X";
  gameState = ["", "", "", "", "", "", "", "", ""];
  gameActive = true;
  updateStatusText();
  cells.forEach((cell) => {
    cell.innerText = "";
    cell.className = "cell";
  });
}

cells.forEach((cell) => cell.addEventListener("click", handleCellClick));
restartBtn.addEventListener("click", resetBoard);
