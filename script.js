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

// Initialize Firebase using only the public URL
const firebaseConfig = {
  databaseURL:
    "https://elite-tic-tac-toe-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// This will now work because you added the tags in index.html
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

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
    roomInput.style.display = "block";
    roomInput.readOnly = false;
    roomInput.value = "";
    roomInput.placeholder = "Enter Room ID";
    roomMsg.innerText = "Enter the ID shared by Player 1";
    playerSymbol = "O";
  } else {
    roomInput.style.display = "none";
    roomInput.readOnly = true;
    roomID = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomInput.value = roomID;
    roomMsg.innerText =
      "Room ID will be auto generated. After start match, share it with your friend.";
    playerSymbol = "X";
  }
}

p1Input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const name = p1Input.value.trim();

    if (name === "") {
      errorMsg.innerText = "Please enter your name!";
      return;
    }

    if (gameMode === "pvp") {
      p2Input.focus();
    } else if (isOnline && joinCheckbox.checked) {
      roomInput.focus();
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

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && isOnline && joinCheckbox.checked) {
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
    document.getElementById("current-room-id").innerText = roomID;
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
      startListening(roomID);
    } catch (e) {
      errorMsg.innerText = "Connection Failed!";
      return;
    }
  } else {
    document.getElementById("active-room-display").style.display = "none";
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

function startListening(roomID) {
  // Clear any old polling intervals
  if (pollingInterval) clearInterval(pollingInterval);

  const roomRef = db.ref("rooms/" + roomID);

  // This replaces the "continuous GET".
  // It only triggers when a change occurs in the database.
  roomRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // Security Check: If the room is marked inactive by the Apps Script
    if (data.status === "inactive") {
      roomRef.off(); // Stop listening
      alert("Room closed.");
      window.location.reload();
      return;
    }

    // Pass data to your existing sync function
    syncGame(data);
  });
}

function syncGame(data) {
  // 1. Sync scores based on history length
  if (data.history) {
    const p1Wins = data.history.filter((h) => h.winner === "X").length;
    const p2Wins = data.history.filter((h) => h.winner === "O").length;
    document.getElementById("p1-score").innerText = p1Wins;
    document.getElementById("p2-score").innerText = p2Wins;
  }

  // 2. Sync Names
  if (player1.name !== data.player1 || player2.name !== data.player2) {
    player1.name = data.player1;
    player2.name = data.player2;
    document.getElementById("p1-name-display").innerText = player1.name;
    document.getElementById("p2-name-display").innerText = player2.name;
  }

  // 3. Sync Board
  data.gameState.forEach((val, idx) => {
    gameState[idx] = val;
    cells[idx].innerText = val;
    // Remove winner-cell class if the board was reset
    if (val === "") {
      cells[idx].className = "cell";
    } else {
      cells[idx].className = `cell ${val.toLowerCase()}`;
    }
  });

  // 4. Update Game State
  gameActive = data.gameActive;
  currentPlayer = data.currentPlayer;

  if (gameActive) {
    updateStatusText();
  } else {
    if (data.winner === "Draw") {
      statusDisplay.innerText = "It's a Draw! 🤝";
    } else if (data.winner) {
      const winnerName = data.winner === "X" ? data.player1 : data.player2;
      statusDisplay.innerText = `${winnerName} Wins! 🏆`;
      if (data.winningCombo) {
        data.winningCombo.forEach((idx) =>
          cells[idx].classList.add("winner-cell")
        );
      }
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
    const winner = currentPlayer === "X" ? player1 : player2;
    statusDisplay.innerText = `${winner.name} Wins! 🎉`;

    if (!isOnline) {
      winner.score++;
      document.getElementById(
        `p${currentPlayer === "X" ? 1 : 2}-score`
      ).innerText = winner.score;
    }

    winningCombo.forEach((idx) => cells[idx].classList.add("winner-cell"));
    return;
  }

  if (!gameState.includes("")) {
    playSound("draw");
    gameActive = false;
    statusDisplay.innerText = "It's a Draw! 🤝";
    return;
  }

  if (!isOnline) {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updateStatusText();
  }
}

async function resetBoard() {
  if (isOnline) {
    // In online mode, tell the server to reset
    await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "reset",
        roomID: roomID,
      }),
    });
  } else {
    // Local mode reset
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    gameActive = true;
    updateStatusText();
    cells.forEach((cell) => {
      cell.innerText = "";
      cell.className = "cell";
    });
  }
}

window.addEventListener("beforeunload", () => {
  if (isOnline && roomID) {
    // Send a final request to mark room as inactive
    fetch(SCRIPT_URL, {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        action: "leave",
        roomID: roomID,
      }),
    });
  }
});

cells.forEach((cell) => cell.addEventListener("click", handleCellClick));
restartBtn.addEventListener("click", resetBoard);
