
// Server-side board class.
export class Board {
    constructor() {
        this.grid = [];

        for (let r = 0; r < 8; r++) {
            const row = [];
            for (let c = 0; c < 8; c++) {
                row.push({
                    piece: null,
                    player: null,
                    turf: null,
                });
            }
            this.grid.push(row);
        }
    }

    processMove(move) {
        const { from, to } = move;

        if (from === undefined || to === undefined) {
            return { couldMove: false };
        }

        const fromPos = chessCoordToRowCol(from);
        const toPos = chessCoordToRowCol(to);

        if (!posInBounds(fromPos) || !posInBounds(toPos)) {
            return { couldMove: false };
        }

        // Accept any move for now.
        const grid = structuredClone(this.grid);

        // TODO
        grid[toPos[0]][toPos[1]] = grid[fromPos[0]][fromPos[1]];
        grid[fromPos[0]][fromPos[1]] = {
            piece: null,
            player: null,
            turf: null,
        };
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

// Generates a sample initial board description object.
export function genInitialChessBoardDesc() {
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