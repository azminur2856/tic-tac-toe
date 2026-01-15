const overlay = document.getElementById("setup-overlay");
const mainContent = document.getElementById("main-content");
const startBtn = document.getElementById("start-game-btn");
const p1Input = document.getElementById("p1-input");
const p2Input = document.getElementById("p2-input");
const errorMsg = document.getElementById("error-msg");
const joinCheckbox = document.getElementById("join-checkbox");
const roomInput = document.getElementById("room-id-input");
const roomMsg = document.getElementById("generated-room-msg");

const cells = document.querySelectorAll(".cell");
const statusDisplay = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const audioBtn = document.getElementById("audio-toggle");

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbytxEhCxemJgqGBUMdOjwUTi_E2AkssjsqKZ3WU2wmj0itjK4FgCGtFECZ0_pAOULHkeQ/exec";

const sounds = {
  start: new Audio("assets/start.mp3"),
  moveX: new Audio("assets/moveX.mp3"),
  moveO: new Audio("assets/moveO.mp3"),
  win: new Audio("assets/win.mp3"),
  draw: new Audio("assets/draw.mp3"),
};

// --- STATE ---
let isMuted = false;
let player1 = { name: "", score: 0 };
let player2 = { name: "", score: 0 };
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];
let gameActive = true;
let gameMode = "pvc";
let roomID = "";
let playerSymbol = "X";
let isOnline = false;
let pollingInterval = null;
let lastUpdate = 0;

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

// --- AUDIO ---
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

// --- MODE SWITCHING ---
document.querySelectorAll('input[name="game-mode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    gameMode = e.target.value;
    isOnline = gameMode === "online";
    p2Input.style.display = gameMode === "pvp" ? "block" : "none";
    document.getElementById("online-fields").style.display = isOnline
      ? "block"
      : "none";

    if (isOnline) {
      prepareOnlineFields();
    } else {
      if (gameMode === "pvc") p2Input.value = "Machine";
      if (gameMode === "pvp") p2Input.value = "";
      if (pollingInterval) clearInterval(pollingInterval);
    }
  });
});

function prepareOnlineFields() {
  if (joinCheckbox.checked) {
    roomInput.readOnly = false;
    roomInput.value = "";
    roomInput.placeholder = "Enter Room ID";
    roomMsg.innerText = "Enter the ID shared by Player 1";
    playerSymbol = "O";
  } else {
    roomInput.readOnly = true;
    roomID = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomInput.value = roomID;
    roomMsg.innerText = "Share this Room ID with your friend:";
    playerSymbol = "X";
  }
}

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

joinCheckbox.addEventListener("change", prepareOnlineFields);

startBtn.addEventListener("click", initGame);

async function initGame() {
  const n1 = p1Input.value.trim();
  if (!n1) {
    errorMsg.innerText = "Name is required!";
    return;
  }

  if (isOnline) {
    roomID = roomInput.value.trim().toUpperCase();
    if (!roomID) {
      errorMsg.innerText = "Room ID required!";
      return;
    }
    const action = joinCheckbox.checked ? "join" : "create";
    try {
      const resp = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action,
          roomID,
          playerName: n1,
          symbol: playerSymbol,
        }),
      });
      const result = await resp.json();
      if (!result.success) {
        errorMsg.innerText = result.message || "Room Error!";
        return;
      }
      startPolling();
    } catch (e) {
      errorMsg.innerText = "Connection Failed!";
      return;
    }
  }

  playSound("start");
  player1.name = isOnline ? (playerSymbol === "X" ? n1 : "Loading...") : n1;
  player2.name = isOnline
    ? playerSymbol === "O"
      ? n1
      : "Waiting..."
    : p2Input.value;

  document.getElementById("p1-name-display").innerText = player1.name;
  document.getElementById("p2-name-display").innerText = player2.name;

  overlay.classList.add("hidden");
  mainContent.classList.remove("hidden");
  updateStatusText();
}

// --- GAMEPLAY ---
function handleCellClick(e) {
  const index = e.target.getAttribute("data-index");
  if (gameState[index] !== "" || !gameActive) return;
  if (isOnline && currentPlayer !== playerSymbol) return;

  if (isOnline) {
    // Optimistic UI update (optional, but makes it feel faster)
    executeMove(index);
    fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "move",
        roomID,
        index,
        symbol: playerSymbol,
      }),
    });
  } else {
    executeMove(index);
    if (gameActive && gameMode === "pvc" && currentPlayer === "O") {
      setTimeout(advancedCPUMove, 600);
    }
  }
}

function executeMove(index) {
  const symbol = currentPlayer;
  gameState[index] = symbol;
  const cell = cells[index];
  cell.innerText = symbol;
  cell.classList.add(symbol.toLowerCase());
  playSound(symbol === "X" ? "moveX" : "moveO");
  checkResult();
}

// --- ONLINE SYNC ---
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    try {
      // Use cache-busting and faster interval (800ms)
      const resp = await fetch(
        `${SCRIPT_URL}?roomID=${roomID}&t=${Date.now()}`
      );
      const data = await resp.json();

      if (!data || !data.gameState) return;

      // Only update if the server timestamp has changed
      if (data.lastMove > lastUpdate) {
        lastUpdate = data.lastMove;
        syncGame(data);
      }
    } catch (e) {
      console.error("Sync error");
    }
  }, 800);
}

function syncGame(data) {
  // Sync names
  if (player1.name !== data.player1 || player2.name !== data.player2) {
    player1.name = data.player1;
    player2.name = data.player2;
    document.getElementById("p1-name-display").innerText = player1.name;
    document.getElementById("p2-name-display").innerText = player2.name;
  }

  // Sync Board
  data.gameState.forEach((val, idx) => {
    if (val !== gameState[idx]) {
      gameState[idx] = val;
      cells[idx].innerText = val;
      cells[idx].className = `cell ${val.toLowerCase()}`;
      if (val !== "") playSound(val === "X" ? "moveX" : "moveO");
    }
  });

  currentPlayer = data.currentPlayer;
  updateStatusText();

  // SYNC WINNER STATE FROM SERVER
  if (data.gameActive === false) {
    gameActive = false;
    clearInterval(pollingInterval);

    if (data.winner === "Draw") {
      playSound("draw");
      statusDisplay.innerText = "It's a Draw! 🤝";
    } else if (data.winner) {
      playSound("win");
      const winnerName = data.winner === "X" ? data.player1 : data.player2;
      statusDisplay.innerText = `${winnerName} Wins! 🎉`;

      // Update scores
      const scoreId = `p${data.winner === "X" ? 1 : 2}-score`;
      document.getElementById(scoreId).innerText =
        parseInt(document.getElementById(scoreId).innerText) + 1;

      // Highlight cells
      data.winningCombo.forEach((idx) =>
        cells[idx].classList.add("winner-cell")
      );
    }
  }
}

// --- MINIMAX AI ---
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
        bestScore = Math.max(minimax(board, depth + 1, false), bestScore);
        board[i] = "";
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = "X";
        bestScore = Math.min(minimax(board, depth + 1, true), bestScore);
        board[i] = "";
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
  if (isOnline && player2.name === "Waiting...") {
    statusDisplay.innerText = "Waiting for Opponent...";
    return;
  }
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
    gameActive = false;
    if (isOnline) clearInterval(pollingInterval);
    const winner = currentPlayer === "X" ? player1 : player2;
    statusDisplay.innerText = `${winner.name} Wins! 🎉`;
    winner.score++;
    document.getElementById(
      `p${currentPlayer === "X" ? 1 : 2}-score`
    ).innerText = winner.score;
    winningCombo.forEach((idx) => cells[idx].classList.add("winner-cell"));
    return;
  }
  if (!gameState.includes("")) {
    playSound("draw");
    gameActive = false;
    if (isOnline) clearInterval(pollingInterval);
    statusDisplay.innerText = "It's a Draw! 🤝";
    return;
  }
  if (!isOnline) {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateStatusText();
  }
}

function resetBoard() {
  if (isOnline) return;
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
