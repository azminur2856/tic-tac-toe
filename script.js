// DOM Elements
const overlay = document.getElementById("setup-overlay");
const mainContent = document.getElementById("main-content");
const startBtn = document.getElementById("start-game-btn");
const cells = document.querySelectorAll(".cell");
const statusDisplay = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");

// Game State
let player1 = { name: "Player X", score: 0 };
let player2 = { name: "Player O", score: 0 };
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

// 1. Initial Setup
startBtn.addEventListener("click", () => {
  const n1 = document.getElementById("p1-input").value;
  const n2 = document.getElementById("p2-input").value;

  if (n1) player1.name = n1;
  if (n2) player2.name = n2;

  document.getElementById("p1-name-display").innerText = player1.name;
  document.getElementById("p2-name-display").innerText = player2.name;

  overlay.classList.add("hidden");
  mainContent.classList.remove("hidden");
  updateStatus();
});

// 2. Logic Functions
function handleCellClick(e) {
  const index = e.target.getAttribute("data-index");
  if (gameState[index] !== "" || !gameActive) return;

  gameState[index] = currentPlayer;
  e.target.innerText = currentPlayer;
  e.target.classList.add(currentPlayer.toLowerCase());

  checkResult();
}

function updateStatus() {
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
    const winnerName = currentPlayer === "X" ? player1.name : player2.name;
    statusDisplay.innerText = `${winnerName} Wins! 🎉`;

    // Update Score
    if (currentPlayer === "X") {
      player1.score++;
      document.getElementById("p1-score").innerText = player1.score;
    } else {
      player2.score++;
      document.getElementById("p2-score").innerText = player2.score;
    }

    winningCombo.forEach((idx) => cells[idx].classList.add("winner-cell"));
    gameActive = false;
    return;
  }

  if (!gameState.includes("")) {
    statusDisplay.innerText = "It's a Draw! 🤝";
    gameActive = false;
    return;
  }

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  updateStatus();
}

function restartGame() {
  currentPlayer = "X";
  gameState = ["", "", "", "", "", "", "", "", ""];
  gameActive = true;
  updateStatus();
  cells.forEach((cell) => {
    cell.innerText = "";
    cell.className = "cell";
  });
}

// Event Listeners
cells.forEach((cell) => cell.addEventListener("click", handleCellClick));
restartBtn.addEventListener("click", restartGame);
