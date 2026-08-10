// --- State Variables ---
let board = null;
let game = new Chess();
let stockfish = null;
let isAiThinking = false;
let soundEnabled = true;
let timers = { w: 600, b: 600 }; 
let clockInterval = null;
let gameActive = false;
let selectedSquare = null;

const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9 };

// --- Web Audio API (Synthesizer) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'move') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'capture') {
        osc.type = 'square'; osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'check') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'gameover') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.8);
        gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now); osc.stop(now + 0.8);
    }
}

// --- Initialization ---
function initStockfish() {
    fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js')
        .then(res => res.text())
        .then(script => {
            const blob = new Blob([script], { type: 'application/javascript' });
            stockfish = new Worker(URL.createObjectURL(blob));
            
            stockfish.onmessage = function(event) {
                if (event.data.includes("bestmove")) {
                    const match = event.data.match(/^bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
                    if (match) {
                        if (isAiThinking) executeAiMove(match[1]);
                        else showHint(match[1]);
                    }
                }
            };
            stockfish.postMessage("uci");
            stockfish.postMessage("ucinewgame");
        })
        .catch(err => console.error("Stockfish load error:", err));
}

// --- Core Logic ---
function makeAiMove() {
    if (!stockfish || game.game_over()) return;
    isAiThinking = true;
    updateUI();
    
    const diff = $('#difficulty').val();
    let depth = 5, movetime = 500;
    if (diff === 'medium') { depth = 10; movetime = 1500; }
    if (diff === 'hard') { depth = 15; movetime = 3000; }

    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage(`go depth ${depth} movetime ${movetime}`);
}

function executeAiMove(moveStr) {
    const move = game.move({ 
        from: moveStr.substring(0, 2), 
        to: moveStr.substring(2, 4), 
        promotion: moveStr.length > 4 ? moveStr.charAt(4) : undefined 
    });
    isAiThinking = false;
    if (move) {
        board.position(game.fen(), true);
        afterMove(move);
    }
}

// --- ระบบ Tap-to-Move ---
function handleSquareClick(square) {
    if (game.game_over() || isAiThinking) return;

    const piece = game.get(square);
    const turn = game.turn();
    const isAiMode = $('#gameMode').val() === 'ai';

    // ถ้าเล่นกับ AI ห้ามเรากดเลือกหมากของ AI (สีดำ)
    if (isAiMode && turn === 'b') return;

    // กรณีที่ 1: มีการเลือกหมากไว้อยู่แล้ว
    if (selectedSquare) {
        // ถ้ากดซ้ำช่องเดิม ให้ยกเลิกการเลือก
        if (selectedSquare === square) {
            clearSelection();
            return;
        }

        // ถ้ากดเปลี่ยนไปเลือกหมากสีเดียวกันตัวอื่น ให้ไฮไลต์ตัวใหม่แทน
        if (piece && piece.color === turn) {
            selectSquare(square);
            return;
        }

        // ลองเดินหมากไปยังช่องที่กด
        const move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // ออโต้โปรโมทเป็นควีน
        });

        if (move) {
            // ถ้าเดินได้สำเร็จ
            board.position(game.fen());
            clearSelection();
            afterMove(move);
        } else {
            // ถ้ากดเดินช่องที่ผิดกติกา ให้ยกเลิกการเลือก
            clearSelection();
        }
    } 
    // กรณีที่ 2: ยังไม่ได้เลือกหมากเลย
    else {
        // ถ้าช่องที่กดมีหมากของเราอยู่ ให้ทำการเลือก (Select)
        if (piece && piece.color === turn) {
            selectSquare(square);
        }
    }
}

function selectSquare(square) {
    selectedSquare = square;
    $('.square-55d63').removeClass('highlight-hint highlight-possible capture-move highlight-selected');
    $('.square-' + square).addClass('highlight-selected');

    // แสดงจุดวงกลมช่องที่สามารถเดินไปได้
    const moves = game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        const squareEl = $('.square-' + move.to);
        squareEl.addClass('highlight-possible');
        if (move.captured) squareEl.addClass('capture-move');
    });
}

function clearSelection() {
    selectedSquare = null;
    $('.square-55d63').removeClass('highlight-possible capture-move highlight-selected');
}

function onDragStart(source, piece) {
    if (game.game_over() || isAiThinking) return false;
    if (piece.search(game.turn()) === -1) return false;
    if ($('#gameMode').val() === 'ai' && game.turn() === 'b') return false;

    clearSelection();
    
    // คำนวณและไฮไลต์ช่องที่เดินได้
    const moves = game.moves({ square: source, verbose: true });
    if (moves.length === 0) return;
    moves.forEach(move => {
        const squareEl = $('.square-' + move.to);
        squareEl.addClass('highlight-possible');
        if (move.captured) squareEl.addClass('capture-move');
    });
}

function onDrop(source, target) {
    $('.square-55d63').removeClass('highlight-hint highlight-possible capture-move');
    let move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    afterMove(move);
}

function onSnapEnd() { board.position(game.fen()); }

function afterMove(move) {
    if (game.in_checkmate() || game.in_draw()) playSound('gameover');
    else if (game.in_check()) playSound('check');
    else if (move.captured) playSound('capture');
    else playSound('move');

    if (!gameActive && !game.game_over()) startClock();
    updateUI();

    if ($('#gameMode').val() === 'pvp') {
        setTimeout(() => { board.orientation(game.turn() === 'w' ? 'white' : 'black'); updateCapturedPieces(); }, 500);
    } else if ($('#gameMode').val() === 'ai' && !game.game_over() && game.turn() === 'b') {
        setTimeout(makeAiMove, 250);
    }
}

// --- UI Updates ---
function updateUI() {
    updateHighlights();
    updateHistory();
    updateCapturedPieces();
    updateStatus();
}

function updateHighlights() {
    $('.square-55d63').removeClass('highlight-last-move highlight-check');
    const history = game.history({ verbose: true });
    if (history.length > 0) {
        const last = history[history.length - 1];
        $('.square-' + last.from).addClass('highlight-last-move');
        $('.square-' + last.to).addClass('highlight-last-move');
    }
    if (game.in_check()) {
        const kingColor = game.turn() === 'w' ? 'w' : 'b';
        for (let r = 1; r <= 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = 'abcdefgh'[c] + r;
                const p = game.get(sq);
                if (p && p.type === 'k' && p.color === kingColor) $('.square-' + sq).addClass('highlight-check');
            }
        }
    }
}

function showHint(moveStr) {
    $('.square-' + moveStr.substring(0, 2)).addClass('highlight-hint');
    $('.square-' + moveStr.substring(2, 4)).addClass('highlight-hint');
}

function updateStatus() {
    let title = game.turn() === 'w' ? "White's Turn" : "Black's Turn";
    let desc = "Make your move.";
    let bannerClass = "bg-slate-800 border-slate-600";
    let iconClass = "fa-circle-info text-slate-400";
    
    let isGameOver = false;
    let modalTitle = "", modalDesc = "", modalIcon = "", modalColor = "";

    if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Black' : 'White';
        title = `Checkmate! ${winner} wins!`; desc = "Game over."; 
        bannerClass = "bg-red-900/40 border-red-500/50"; iconClass = "fa-skull text-red-400";
        stopClock();
        
        isGameOver = true; modalTitle = "Checkmate!"; modalDesc = `${winner} wins the game.`;
        modalIcon = "fa-crown"; modalColor = "text-yellow-400";
    } else if (game.in_draw()) {
        title = "Game Drawn"; desc = game.in_stalemate() ? "Stalemate" : "Repetition/Material/50-move rule";
        bannerClass = "bg-amber-900/30 border-amber-500/50"; iconClass = "fa-handshake text-amber-400";
        stopClock();
        
        isGameOver = true; modalTitle = "Draw!"; modalDesc = "Game ended in a draw. (" + desc + ")";
        modalIcon = "fa-handshake"; modalColor = "text-slate-400";
    } else if (game.in_check()) {
        desc = "Check!"; bannerClass = "bg-orange-900/30 border-orange-500/50"; iconClass = "fa-triangle-exclamation text-orange-400";
    } else if (isAiThinking) {
        title = "AI is thinking..."; desc = "Please wait."; iconClass = "fa-spinner fa-spin text-indigo-400";
    }

    $('#statusTitle').text(title);
    $('#statusDesc').text(desc);
    $('#statusBanner').removeClass().addClass(`border p-4 rounded-xl flex items-start gap-3 transition-colors ${bannerClass}`);
    $('#statusBanner i').removeClass().addClass(`fa-solid mt-1 ${iconClass}`);

    if (isGameOver) showModal(modalTitle, modalDesc, modalIcon, modalColor);
}

function showModal(title, desc, iconClass, colorClass) {
    $('#modalTitle').text(title);
    $('#modalDesc').text(desc);
    $('#modalIcon').removeClass().addClass(`fa-solid ${iconClass} text-6xl mb-4 ${colorClass}`);
    $('#gameOverModal').removeClass('hidden').addClass('flex');
    setTimeout(() => { $('#gameOverModal > div').removeClass('scale-95').addClass('scale-100'); }, 10);
}

function updateHistory() {
    const history = game.history();
    $('#moveCount').text(history.length + ' moves');
    const tbody = $('#historyBody').empty();
    for (let i = 0; i < history.length; i += 2) {
        tbody.append(`<tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
            <td class="py-2 text-slate-500">${(i/2)+1}.</td>
            <td class="py-2">${history[i]}</td>
            <td class="py-2">${history[i+1] || ''}</td>
        </tr>`);
    }
    const container = $('#historyBody').parent().parent()[0];
    container.scrollTop = container.scrollHeight;
}

function updateCapturedPieces() {
    let capW = [], capB = [];
    game.history({ verbose: true }).forEach(m => {
        if (m.captured) m.color === 'w' ? capB.push(m.captured) : capW.push(m.captured);
    });
    const sortP = (a, b) => pieceValues[b] - pieceValues[a];
    capW.sort(sortP); capB.sort(sortP);

    const img = (c, p) => `<img src="https://chessboardjs.com/img/chesspieces/wikipedia/${c}${p.toUpperCase()}.png" class="w-5 h-5 -ml-1 drop-shadow-md">`;
    
    if (board.orientation() === 'white') {
        $('#top-captured').html(capW.map(p => img('w', p)).join(''));
        $('#bottom-captured').html(capB.map(p => img('b', p)).join(''));
    } else {
        $('#top-captured').html(capB.map(p => img('b', p)).join(''));
        $('#bottom-captured').html(capW.map(p => img('w', p)).join(''));
    }
}

// --- Clock ---
function fmtTime(s) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }

function startClock() {
    gameActive = true;
    if(clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        timers[game.turn()]--;
        updateClockUI();
        if(timers[game.turn()] <= 0) {
            stopClock();
            const winner = game.turn() === 'w' ? 'Black' : 'White';
            $('#statusTitle').text("Timeout!"); $('#statusDesc').text(`${winner} wins on time.`);
            showModal("Time's Up!", `${winner} wins on time.`, "fa-hourglass-end", "text-red-500");
            playSound('gameover');
        }
    }, 1000);
}

function stopClock() { gameActive = false; clearInterval(clockInterval); updateClockUI(); }

function updateClockUI() {
    const o = board.orientation();
    $('#top-clock').text(fmtTime(o === 'white' ? timers.b : timers.w));
    $('#bottom-clock').text(fmtTime(o === 'white' ? timers.w : timers.b));
    
    $('#top-clock, #bottom-clock').removeClass('text-emerald-400 text-slate-400');
    if (gameActive) {
        if ((o === 'white' && game.turn() === 'w') || (o === 'black' && game.turn() === 'b')) {
            $('#bottom-clock').addClass('text-emerald-400'); $('#top-clock').addClass('text-slate-400');
        } else {
            $('#top-clock').addClass('text-emerald-400'); $('#bottom-clock').addClass('text-slate-400');
        }
    } else {
        $('#top-clock, #bottom-clock').addClass('text-slate-400');
    }
}

// --- Events ---
$('#newGameBtn').click(() => {
    if(game.history().length > 0 && !game.game_over() && !confirm("Start new game?")) return;
    const selectedTime = parseInt($('#timeControl').val(), 10);
    timers = { w: selectedTime, b: selectedTime }; 
    
    game.reset(); board.start(); board.orientation('white');
    isAiThinking = false; stopClock();
    updateUI(); updateClockUI();
    if($('#gameMode').val() === 'ai') stockfish.postMessage("ucinewgame");
});

$('#timeControl').change((e) => {
    if (game.history().length === 0) {
        const val = parseInt(e.target.value, 10);
        timers = { w: val, b: val };
        updateClockUI();
    }
});

$('#undoBtn').click(() => {
    if(isAiThinking || game.history().length === 0) return;
    game.undo(); if($('#gameMode').val() === 'ai') game.undo();
    board.position(game.fen()); updateUI();
    if(game.history().length === 0) stopClock();
});

$('#hintBtn').click(() => {
    if(isAiThinking || game.game_over()) return;
    $('.square-55d63').removeClass('highlight-hint');
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage(`go depth 10`);
});

$('#gameMode').change(e => {
    $('#difficultyContainer').toggle(e.target.value === 'ai');
    if (e.target.value === 'pvp') {
        $('#topPlayerName').text('Player 2 (Black)');
        $('#topPlayerName').siblings('.w-10').html('<i class="fa-regular fa-user"></i>');
    } else {
        const text = $('#difficulty option:selected').text();
        $('#topPlayerName').text(`AI (${text.split(' ')[0]})`);
        $('#topPlayerName').siblings('.w-10').html('<i class="fa-solid fa-robot text-slate-300"></i>');
    }
});

$('#difficulty').change(e => {
    const text = e.target.options[e.target.selectedIndex].text;
    $('#topPlayerName').text(`AI (${text.split(' ')[0]})`);
});

$('#soundBtn').click(() => {
    soundEnabled = !soundEnabled;
    const i = $('#soundIcon');
    if(soundEnabled) i.removeClass('fa-volume-xmark text-slate-500').addClass('fa-volume-high text-indigo-400');
    else i.removeClass('fa-volume-high text-indigo-400').addClass('fa-volume-xmark text-slate-500');
});

$('#pgnBtn').click(() => {
    const pgn = game.pgn(); if(!pgn) return alert("No moves yet.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([pgn], {type: "text/plain"}));
    a.download = "elite_chess.pgn"; a.click();
});

// Modal Events
$('#modalCloseBtn').click(() => {
    $('#gameOverModal').removeClass('flex').addClass('hidden');
    $('#gameOverModal > div').removeClass('scale-100').addClass('scale-95');
});

$('#modalPlayAgainBtn').click(() => {
    $('#modalCloseBtn').click();
    $('#newGameBtn').click();
});

// --- Start App ---
$(document).ready(function() {
    board = Chessboard('board', {
        draggable: true, position: 'start',
        onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    
    $(window).resize(board.resize);
    initStockfish();
    updateUI();
    updateClockUI();

    $('#board').on('click', '.square-55d63', function() {
        const square = $(this).attr('data-square');
        handleSquareClick(square);
    });
});
