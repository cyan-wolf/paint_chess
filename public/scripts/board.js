
// Converts a chess coordinate string into a row/column pair.
function chessCoordToRowCol(chessCoord) {
    const [file, rank] = chessCoord;

    const row = 8 - parseInt(rank);
    const col = file.charCodeAt(0) - "a".charCodeAt(0);

    return [row, col];
}

// Converts a row/column pair into a chess coordinate string.
function rowColToChessCoord(pos) {
    const [row, col] = pos;

    const file = String.fromCharCode(col + "a".charCodeAt(0));
    const rank = 8 - row;

    return `${file}${rank}`;
}

// Fills in a board slot at the specified index.
// Fills in the `boardPositions` object.
function fillBoardSlot(boardElem, index, boardPositions) {
    const slot = document.createElement("div");
    slot.classList.add("slot");

    // Calculate the row and column using the index.
    const row = Math.floor(index / 8);
    const col = index % 8;

    // Create the checkerboard pattern.
    if (row % 2 == 0 && col % 2 == 0 || row % 2 == 1 && col % 2 == 1) {
        slot.style.backgroundColor = "white";
    } else {
        slot.style.backgroundColor = "black";
    }

    // Fill in the `boardPositions` object for easy access to the board 
    // using standard chess coordinates.
    const chessCoord = rowColToChessCoord([row, col]);
    boardPositions[chessCoord] = slot;

    // TODO: Use sockets to let the server know that this coordinate 
    // was clicked.
    slot.addEventListener("click", () => {
        // Placeholder.
        console.log(chessCoord);
    });

    // Span used for rendering pieces.
    const pieceSpan = document.createElement("span");
    slot.appendChild(pieceSpan);

    boardElem.appendChild(slot);
}

// Initializes the given board element.
// Returns an object that provides easy access to the 
// board's slots using standard chess coordinates.
function initBoard(boardElem, isFlipped) {
    const boardPositions = {};

    if (!isFlipped) {
        for (let index = 0; index < 8 * 8; index++) {
            fillBoardSlot(boardElem, index, boardPositions);
        }
    }
    else {
        for (let index = 8 * 8 - 1; index >= 0; index--) {
            fillBoardSlot(boardElem, index, boardPositions);
        }
    }
    return boardPositions;
}

// Generates a sample initial board description object.
function genInitialChessBoardDesc() {
    const boardDesc = {
        // First player's side.
        "a1": {
            piece: "rook",
            color: "red",
        },
        "b1": {
            piece: "knight",
            color: "red",
        },
        "c1": {
            piece: "bishop",
            color: "red",
        },
        "d1": {
            piece: "queen",
            color: "red",
        },
        "e1": {
            piece: "king",
            color: "red",
        },
        "f1": {
            piece: "bishop",
            color: "red",
        },
        "g1": {
            piece: "knight",
            color: "red",
        },
        "h1": {
            piece: "rook",
            color: "red",
        },

        // Second player's side.

        "a8": {
            piece: "rook",
            color: "blue",
        },
        "b8": {
            piece: "knight",
            color: "blue",
        },
        "c8": {
            piece: "bishop",
            color: "blue",
        },
        "d8": {
            piece: "queen",
            color: "blue",
        },
        "e8": {
            piece: "king",
            color: "blue",
        },
        "f8": {
            piece: "bishop",
            color: "blue",
        },
        "g8": {
            piece: "knight",
            color: "blue",
        },
        "h8": {
            piece: "rook",
            color: "blue",
        },
    };

    // Add both player's pawns.
    for (let col = 0; col < 8; col++) {
        const player1PawnCoord = rowColToChessCoord([6, col]);
        const player2PawnCoord = rowColToChessCoord([1, col]);

        boardDesc[player1PawnCoord] = {
            piece: "pawn",
            color: "red",
        };

        boardDesc[player2PawnCoord] = {
            piece: "pawn",
            color: "blue",
        };
    }

    return boardDesc;
}

// Uses `boardPositions` to update the board with `boardDesc`.
// * The board positons object maps chess coordinates to actual slots on the board.
// * The board description object maps chess coordinates to a physical (type/color) 
//   description of the piece that should be at that position.
function updateBoard(boardPositions, boardDesc) {
    for (const coord of Object.keys(boardDesc)) {
        const pieceElem = boardPositions[coord].children[0];
        const { piece, color } = boardDesc[coord];

        pieceElem.classList = `piece ${piece} ${color}`;
    }
}