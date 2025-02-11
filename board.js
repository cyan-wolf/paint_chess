
// Server-side board class.
export class Board {
    constructor() {
        this.grid = [];
        this.turn = "p1";

        for (let r = 0; r < 8; r++) {
            const row = [];
            for (let c = 0; c < 8; c++) {
                row.push(newEmptySlot());
            }
            this.grid.push(row);
        }

        this.loadBoardDesc(genInitialChessBoardDesc());
    }

    // Processes a move given by the game itself.
    processMove(move) {
        const { from, to, player } = move;

        if (from === undefined || to === undefined) {
            return { couldMove: false };
        }

        const fromPos = chessCoordToRowCol(from);
        const toPos = chessCoordToRowCol(to);

        if (!posInBounds(fromPos) || !posInBounds(toPos)) {
            return { couldMove: false };
        }

        const newGrid = structuredClone(this.grid);

        const slotToMove = newGrid[fromPos[0]][fromPos[1]];

        if (slotToMove.piece === null) {
            // Player should only be able to move pieces.
            return { couldMove: false };
        }
        else if (slotToMove.player !== player) {
            // Player should only be able to move their own pieces.
            return { couldMove: false };
        }
        else if (slotToMove.player !== this.turn) {
            // Player should only be able to move on their turn.
            return { couldMove: false };
        }

        const dr = Math.abs(toPos[0] - fromPos[0]);
        const dc = Math.abs(toPos[1] - fromPos[1]);

        if (slotToMove.piece === "rook") {
            if (fromPos[0] !== toPos[0] || fromPos[1] !== toPos[1]) {
                // Disallow diagonal rook moves.
                return { couldMove: false };
            }
            // TODO
        }
        else if (slotToMove.piece === "bishop") {
            if (dr != dc) {
                // Only allow diagonal moves.
                return { couldMove: false };
            }
            // TODO
        }
        else if (slotToMove.piece === "queen") {
            // TODO: only allow rook or bishop moves
        }
        else if (slotToMove.piece === "king") {
            if (dr > 1 || dc > 1) {
                // Only allow king moves.
                return { couldMove: false };
            }
            // TODO
        }
        else if (slotToMove.piece === "knight") {
            if (!((dr == 2 && dc == 1) || (dr == 1 && dc == 2))) {
                // Only allow knight moves.
                return { couldMove: false };
            }
        }

        // Placeholder: Accept any move for now.
        movePiece(newGrid, fromPos, toPos, [fromPos]);

        // Toggle the turn.
        this.turn = (this.turn === "p1") ? "p2" : "p1";

        this.grid = newGrid;
        return { couldMove: true };
    }

    // Clears the board's grid.
    clearGrid() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                this.grid[r][c] = newEmptySlot();
            }
        }
    }

    // Turns the board's grid into a board description object.
    toBoardDesc() {
        const boardDesc = {};

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const gridSlot = this.grid[r][c];
                const slot = {};

                if (gridSlot.piece != null) {
                    slot.piece = gridSlot.piece;
                }
                if (gridSlot.player != null) {
                    slot.player = gridSlot.player;
                }
                if (gridSlot.turf != null) {
                    slot.turf = gridSlot.turf;
                }

                if (Object.keys(slot).length != 0) {
                    const chessCoord = rowColToChessCoord([r, c]);
                    boardDesc[chessCoord] = slot;
                }
            }
        }
        return boardDesc;
    }

    // Loads a board description object into the board's grid.
    loadBoardDesc(boardDesc) {
        this.clearGrid();

        for (const chessCoord of Object.keys(boardDesc)) {
            const [row, col] = chessCoordToRowCol(chessCoord);
            this.grid[row][col] = boardDesc[chessCoord];
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

function posInBounds(pos) {
    const [row, col] = pos;
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Moves a piece (without validation) and colors the piece's path.
function movePiece(grid, fromPos, toPos, piecePosPath) {
    const slotToMove = grid[fromPos[0]][fromPos[1]];

    // Fills in the piece's path with the same color turf.
    for (const pathPos of piecePosPath) {
        const pathSlot = newEmptySlot();
        pathSlot.turf = slotToMove.turf;

        const [row, col] = pathPos;
        grid[row][col] = pathSlot;
    }

    grid[toPos[0]][toPos[1]] = slotToMove;
}

function newEmptySlot() {
    return {
        piece: null,
        player: null,
        turf: null,
    };
}

// Generates a sample initial board description object.
function genInitialChessBoardDesc() {
    const boardDesc = {
        // First player's side.
        "a1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        "b1": {
            piece: "knight",
            player: "p1",
            turf: "p1",
        },
        "c1": {
            piece: "bishop",
            player: "p1",
            turf: "p1",
        },
        "d1": {
            piece: "queen",
            player: "p1",
            turf: "p1",
        },
        "e1": {
            piece: "king",
            player: "p1",
            turf: "p1",
        },
        "f1": {
            piece: "bishop",
            player: "p1",
            turf: "p1",
        },
        "g1": {
            piece: "knight",
            player: "p1",
            turf: "p1",
        },
        "h1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        // Second player's side.
        "a8": {
            piece: "rook",
            player: "p2",
            turf: "p2",
        },
        "b8": {
            piece: "knight",
            player: "p2",
            turf: "p2",
        },
        "c8": {
            piece: "bishop",
            player: "p2",
            turf: "p2",
        },
        "d8": {
            piece: "queen",
            player: "p2",
            turf: "p2",
        },
        "e8": {
            piece: "king",
            player: "p2",
            turf: "p2",
        },
        "f8": {
            piece: "bishop",
            player: "p2",
            turf: "p2",
        },
        "g8": {
            piece: "knight",
            player: "p2",
            turf: "p2",
        },
        "h8": {
            piece: "rook",
            player: "p2",
            turf: "p2",
        },
    };

    // Add both player's pawns.
    for (let col = 0; col < 8; col++) {
        const player1PawnCoord = rowColToChessCoord([6, col]);
        const player2PawnCoord = rowColToChessCoord([1, col]);

        boardDesc[player1PawnCoord] = {
            piece: "pawn",
            player: "p1",
            turf: "p1",
        };

        boardDesc[player2PawnCoord] = {
            piece: "pawn",
            player: "p2",
            turf: "p2",
        };
    }

    return boardDesc;
}