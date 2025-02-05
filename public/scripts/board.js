
class Board {
    // Initializes the given board after being given 
    // an element to fill in with slots.
    constructor(boardConfig) {
        const { element, isFlipped, colorConfig } = boardConfig;

        this.boardElem = element;
        this.boardPositions = {};
        this.colorConfig = colorConfig;

        if (!isFlipped) {
            for (let index = 0; index < 8 * 8; index++) {
                this.fillSlot(index);
            }
        }
        else {
            for (let index = 8 * 8 - 1; index >= 0; index--) {
                this.fillSlot(index);
            }
        }
    }

    // Fills in a board slot at the specified index.
    // Fills in the board element and the board positions object.
    fillSlot(index) {
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
        this.boardPositions[chessCoord] = slot;

        // TODO: Use sockets to let the server know that this coordinate 
        // was clicked.
        slot.addEventListener("click", () => {
            // Placeholder.
            console.log(chessCoord);
        });

        // Span used for rendering pieces.
        const pieceSpan = document.createElement("span");
        slot.appendChild(pieceSpan);

        this.boardElem.appendChild(slot);
    }

    // Updates the board using a board description object.
    // * The board positons object maps chess coordinates to actual slots on the board.
    // * The board description object maps chess coordinates to a physical (type/color) 
    //   description of the piece that should be at that position.
    update(boardDesc) {
        for (const coord of Object.keys(boardDesc)) {
            const pieceElem = this.boardPositions[coord].children[0];
            const { piece, player } = boardDesc[coord];

            const color = this.colorConfig[player]["piece"];

            pieceElem.classList = `piece ${piece} ${color}`;
        }
    }
}

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

// Generates a sample initial board description object.
function genInitialChessBoardDesc() {
    const boardDesc = {
        // First player's side.
        "a1": {
            piece: "rook",
            player: "p1",
        },
        "b1": {
            piece: "knight",
            player: "p1",
        },
        "c1": {
            piece: "bishop",
            player: "p1",
        },
        "d1": {
            piece: "queen",
            player: "p1",
        },
        "e1": {
            piece: "king",
            player: "p1",
        },
        "f1": {
            piece: "bishop",
            player: "p1",
        },
        "g1": {
            piece: "knight",
            player: "p1",
        },
        "h1": {
            piece: "rook",
            player: "p1",
        },

        // Second player's side.

        "a8": {
            piece: "rook",
            player: "p2",
        },
        "b8": {
            piece: "knight",
            player: "p2",
        },
        "c8": {
            piece: "bishop",
            player: "p2",
        },
        "d8": {
            piece: "queen",
            player: "p2",
        },
        "e8": {
            piece: "king",
            player: "p2",
        },
        "f8": {
            piece: "bishop",
            player: "p2",
        },
        "g8": {
            piece: "knight",
            player: "p2",
        },
        "h8": {
            piece: "rook",
            player: "p2",
        },
    };

    // Add both player's pawns.
    for (let col = 0; col < 8; col++) {
        const player1PawnCoord = rowColToChessCoord([6, col]);
        const player2PawnCoord = rowColToChessCoord([1, col]);

        boardDesc[player1PawnCoord] = {
            piece: "pawn",
            player: "p1",
        };

        boardDesc[player2PawnCoord] = {
            piece: "pawn",
            player: "p2",
        };
    }

    return boardDesc;
}
