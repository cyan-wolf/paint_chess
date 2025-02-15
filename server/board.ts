
// Server-side board class.
export class Board {
    grid: Slot[][]
    turn: PlayerRole

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
    processMove(move: Move): boolean {
        const { from, to, player } = move;

        const fromPos = chessCoordToRowCol(from);
        const toPos = chessCoordToRowCol(to);

        if (!posInBounds(fromPos) || !posInBounds(toPos)) {
            return false;
        }

        const newGrid = structuredClone(this.grid);

        const slotToMove = newGrid[fromPos[0]][fromPos[1]];

        if (slotToMove.piece === null) {
            // Player should only be able to move pieces.
            return false;
        }
        else if (slotToMove.player !== player) {
            // Player should only be able to move their own pieces.
            return false;
        }
        else if (slotToMove.player !== this.turn) {
            // Player should only be able to move on their turn.
            return false;
        }

        // Basic validation for pieces.
        if (!prelimVerifyMove(fromPos, toPos, newGrid)) {
            return false;
        }

        // Stops pieces from the same player from capturing each other.
        if (isFriendlyCapture(fromPos, toPos, newGrid)) {
            return false;
        }

        // Actually moves the piece and fills in the path it "traversed".
        movePieceAndGenPath(newGrid, fromPos, toPos);

        // Toggle the turn.
        this.turn = (this.turn === "p1") ? "p2" : "p1";

        this.grid = newGrid;
        return true;
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
    toBoardDesc(): BoardDescription {
        const boardDesc: BoardDescription = {};

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const gridSlot = this.grid[r][c];
                const slot: SlotDescription = {};

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
    loadBoardDesc(boardDesc: BoardDescription): void {
        this.clearGrid();

        for (const chessCoord of Object.keys(boardDesc)) {
            const [row, col] = chessCoordToRowCol(chessCoord);

            const slot = this.grid[row][col];
            const slotDesc = boardDesc[chessCoord];

            if (slotDesc.piece !== undefined) {
                slot.piece = slotDesc.piece;
            }
            if (slotDesc.player !== undefined) {
                slot.player = slotDesc.player;
            }
            if (slotDesc.turf !== undefined) {
                slot.turf = slotDesc.turf;
            }
        }
    }
}

// Converts a chess coordinate string into a row/column pair.
function chessCoordToRowCol(chessCoord: Coord): Pos {
    const [file, rank] = chessCoord;

    const row = 8 - parseInt(rank);
    const col = file.charCodeAt(0) - "a".charCodeAt(0);

    return [row, col];
}

// Converts a row/column pair into a chess coordinate string.
function rowColToChessCoord(pos: Pos): Coord {
    const [row, col] = pos;

    const file = String.fromCharCode(col + "a".charCodeAt(0));
    const rank = 8 - row;

    return `${file}${rank}`;
}

// Checks that a position is in bounds.
function posInBounds(pos: Pos) {
    const [row, col] = pos;
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getInBetweenPositions(fromPos: Pos, toPos: Pos): Pos[] {
    const inBetween: Pos[] = [];

    const sDr = toPos[0] - fromPos[0];
    const sDc = toPos[1] - fromPos[1];

    const bishopLikeMovement = Math.abs(sDr) === Math.abs(sDc);
    const rookLikeMovement = (sDr !== 0 && sDc === 0) || (sDr === 0 && sDc !== 0);

    const pos = structuredClone(fromPos);

    if (bishopLikeMovement || rookLikeMovement) {
        do {
            inBetween.push(structuredClone(pos));

            pos[0] += Math.sign(sDr);
            pos[1] += Math.sign(sDc);

        } while (pos[0] !== toPos[0] || pos[1] !== toPos[1]);
    }

    return inBetween;
}

// Moves a piece and fills in the path it "traversed".
function movePieceAndGenPath(grid: Slot[][], fromPos: Pos, toPos: Pos) {
    const slotToMove = getSlot(grid, fromPos);

    let path: Pos[] = [];

    const inBetweenPositions = getInBetweenPositions(fromPos, toPos);

    switch (slotToMove.piece) {
        case "pawn": {
            path = inBetweenPositions;
            break;
        }
        case "knight":
            // The knight leaves a trivial path.
            path.push(fromPos);
            break; 
        case "bishop":
            path = inBetweenPositions;
            break;
        case "rook":
            path = inBetweenPositions;
            break;
        case "queen": 
            path = inBetweenPositions;
            break;
        case "king":
             // The king leaves a trivial path.
            path.push(fromPos);
            break;
    }

    //console.log(path);

    movePiece(grid, fromPos, toPos, path);
}

// Moves a piece (without validation) and colors the piece's path.
// The piece's path includes all the slots that the piece "traversed",
// excluding the final position.
function movePiece(grid: Slot[][], fromPos: Pos, toPos: Pos, piecePosPath: Pos[]) {
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

// Does basic (preliminary) validation for pieces.
function prelimVerifyMove(fromPos: Pos, toPos: Pos, grid: Slot[][]): boolean {
    const dr = Math.abs(toPos[0] - fromPos[0]);
    const dc = Math.abs(toPos[1] - fromPos[1]);

    const validForBishop = () => dr == dc;
    const validForRook = () => (dr != 0 && dc == 0) || (dr == 0 && dc != 0);

    const slotToMove = getSlot(grid, fromPos);
    const piece = slotToMove.piece!;

    switch (piece) {
        case "pawn": {
            const sDr = toPos[0] - fromPos[0];
            const movingForward = (slotToMove.player === "p1") ? sDr < 0 : sDr > 0;

            const slotToCapture = getSlot(grid, toPos);
            const wouldCaptureEnemy = 
                slotToCapture.piece !== null 
                && slotToCapture.player !== slotToMove.player;

            const simpleMove = dr === 1 
                && dc === 0
                && !wouldCaptureEnemy;

            const currentRow = fromPos[0];
            const doubleStartingMove = (currentRow === 1 || currentRow === 6) 
                && dr === 2 
                && dc === 0
                && !wouldCaptureEnemy;

            const diagonalCapture = dr === 1
                && dc === 1 
                && wouldCaptureEnemy;

            return movingForward && (simpleMove || doubleStartingMove || diagonalCapture);
        }
        case "knight":
            return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
        case "bishop":
            return validForBishop();
        case "rook":
            return validForRook();
        case "queen": 
            return validForBishop() || validForRook();
        case "king":
            return dr <= 1 && dc <= 1;
    }
}

// Determines whether the specified move would result in a friendly capture.
function isFriendlyCapture(fromPos: Pos, toPos: Pos, grid: Slot[][]): boolean {
    return getSlot(grid, fromPos).player === getSlot(grid, toPos).player;
}

// Gets a slot from the grid at the given position (without validation).
function getSlot(grid: Slot[][], pos: Pos): Slot {
    return grid[pos[0]][pos[1]];
}

function newEmptySlot(): Slot {
    return {
        piece: null,
        player: null,
        turf: null,
    };
}

// Generates a sample initial board description object.
function genInitialChessBoardDesc(): BoardDescription {
    const boardDesc: BoardDescription = {
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