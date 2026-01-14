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
  start: new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
  ),
  move: new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"
  ),
  win: new Audio(
    "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3"
  ),
  draw: new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3"
  ),
};

let isMuted = false;
let player1 = { name: "", score: 0 };
let player2 = { name: "", score: 0 };
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];
let gameActive = true;

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

// Helper to play sounds
function playSound(name) {
  if (!isMuted && sounds[name]) {
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => {});
  }
}

// Audio Toggle Logic
audioBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  audioBtn.innerText = isMuted ? "🔇" : "🔊";
});

// --- FOCUS & ENTER KEY LOGIC ---
p1Input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (p1Input.value.trim() === "") {
      errorMsg.innerText = "Please enter Player X's name!";
    } else {
      errorMsg.innerText = "";
      p2Input.focus();
    }
  }
});

p2Input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (p2Input.value.trim() === "") {
      errorMsg.innerText = "Please enter Player O's name!";
    } else {
      initGame();
    }
  }
});

startBtn.addEventListener("click", initGame);

function initGame() {
  const n1 = p1Input.value.trim();
  const n2 = p2Input.value.trim();

  if (!n1 || !n2) {
    errorMsg.innerText = "Both names are required!";
    return;
  }
  if (n1.toLowerCase() === n2.toLowerCase()) {
    errorMsg.innerText = "Names must be unique!";
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

  playSound("move");
  gameState[index] = currentPlayer;
  e.target.innerText = currentPlayer;
  e.target.classList.add(currentPlayer.toLowerCase());

  checkResult();
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
