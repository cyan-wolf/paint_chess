import { Game } from "./game.ts";

// Server-side board class.
export class Board {
    gridData: GridData
    turn: PlayerRole

    constructor() {
        this.gridData = {
            kingCoords: {
                // Placeholder initial values.
                p1: "",
                p2: "",
            },
            grid: [],
        };
        this.turn = "p1";

        for (let r = 0; r < 8; r++) {
            const row = [];
            for (let c = 0; c < 8; c++) {
                row.push(newEmptySlot());
            }
            this.getGrid().push(row);
        }

        this.loadBoardDesc(genInitialChessBoardDesc());
    }

    getGrid(): Grid {
        return this.gridData.grid;
    }

    // Processes a move given by the game itself.
    processMove(move: Move): boolean {
        const { from, to, player } = move;

        const fromPos = chessCoordToRowCol(from);
        const toPos = chessCoordToRowCol(to);

        if (!posInBounds(fromPos) || !posInBounds(toPos)) {
            return false;
        }

        const newGridData = structuredClone(this.gridData);

        const slotToMove = newGridData.grid[fromPos[0]][fromPos[1]];

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
        if (!prelimVerifyMove(fromPos, toPos, newGridData.grid)) {
            return false;
        }

        // Stops pieces from the same player from capturing each other.
        if (isFriendlyCapture(fromPos, toPos, newGridData.grid)) {
            return false;
        }

        const path = getInBetweenPositions(fromPos, toPos);

        if (!pathIsValid(newGridData.grid, path)) {
            return false;
        }

        // Actually moves the piece and fills in the path it "traversed".
        // Updates the cached king position if one moved.
        movePiece(newGridData, fromPos, toPos, path);

        // Look for check.
        if (inCheck(newGridData, this.turn)) {
            console.log(`${this.turn} is in check!`);
            return false;
        }

        // Toggle the turn.
        this.turn = Game.togglePlayerRole(this.turn);

        // Update the actual grid data.
        this.gridData = newGridData;

        return true;
    }

    // Clears the board's grid.
    clearGrid() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                this.getGrid()[r][c] = newEmptySlot();
            }
        }
    }

    // Turns the board's grid into a board description object.
    toBoardDesc(): BoardDescription {
        const boardDesc: BoardDescription = {};

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const gridSlot = this.getGrid()[r][c];
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

            const slot = this.getGrid()[row][col];
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

            // Save the king positions.
            if (slot.piece === "king") {
                this.gridData.kingCoords[slot.player!] = chessCoord;
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

// Generates the positions "between" two positions.
// Always includes the starting position, never includes the 
// final position.
// Only returns the starting position if the path is 
// too short or it involves knight movement.
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
    else {
        inBetween.push(fromPos);
    }

    return inBetween;
}

// Moves a piece (without validation) and colors the piece's path.
// The piece's path includes all the slots that the piece "traversed",
// excluding the final position.
// Updates the cached king position if one moved.
function movePiece(gridData: GridData, fromPos: Pos, toPos: Pos, piecePosPath: Pos[]) {
    const grid = gridData.grid;
    const slotToMove = grid[fromPos[0]][fromPos[1]];

    // Fills in the piece's path with the same color turf.
    for (const pathPos of piecePosPath) {
        const pathSlot = newEmptySlot();
        pathSlot.turf = slotToMove.turf;

        const [row, col] = pathPos;
        grid[row][col] = pathSlot;
    }

    grid[toPos[0]][toPos[1]] = slotToMove;

    // Updates the cached king position (if one moved).
    if (slotToMove.piece === "king") {
        gridData.kingCoords[slotToMove.player!] = rowColToChessCoord(toPos);
    }
}

// Does basic (preliminary) validation for pieces.
function prelimVerifyMove(fromPos: Pos, toPos: Pos, grid: Grid): boolean {
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
function isFriendlyCapture(fromPos: Pos, toPos: Pos, grid: Grid): boolean {
    return getSlot(grid, fromPos).player === getSlot(grid, toPos).player;
}

function pathIsValid(grid: Grid, path: Pos[]): boolean {
    const slotToMove = getSlot(grid, path[0]);

    for (const pos of path.slice(1)) {
        const slot = getSlot(grid, pos);

        // Cannot override pieces with path.
        if (slot.piece !== null) {
            return false;
        }
        // Cannot move across enemy turf.
        if (slot.turf !== null && slot.turf !== slotToMove.player) {
            return false;
        }
    }
    return true;
}

// Fills in the "attacking coords" hash set with the coordinates 
// attacked by the long range piece at `slotPos`.
// Uses the `movements` list to know what directions to go in 
// when calculating long-distance attacks.
function longRangeFillInAttackingCoords(
    movements: Pos[],
    slotPos: Pos,
    attacking: Set<Coord>,
    grid: Grid,
) {
    const slot = getSlot(grid, slotPos);

    for (const [dr, dc] of movements) {
        let nbrPos = structuredClone(slotPos);
        let foundEnemyTurf = false;

        while (true) {
            nbrPos = [nbrPos[0] + dr, nbrPos[1] + dc];

            // Stop the long-range attack (in the current direction) if: 
            // - would reach out of bounds
            // - would traverse more than 1 enemy turf slot
            // - would capture a friendly piece
            if (!posInBounds(nbrPos) || foundEnemyTurf || isFriendlyCapture(slotPos, nbrPos, grid)) {
                break;
            }

            attacking.add(rowColToChessCoord(nbrPos));

            if (nbrSlotHasEnemyTurf(slot, nbrPos, grid)) {
                // Prevents the piece from moving past this slot 
                // (it still can move *into* this slot).
                foundEnemyTurf = true;
            }
        }
    }
}

function getAttackingCoords(grid: Grid, slotPos: Pos): Set<Coord> {    
    const slot = getSlot(grid, slotPos);
    const attacking = new Set<Coord>();

    switch (slot.piece!) {
        case "pawn": {
            // Moves forward in the "row" direction.
            const sDr = (slot.player === "p1") ? -1 : 1;
            
            const nbrs: Pos[] = [
                [slotPos[0] + sDr, slotPos[1] + 1],
                [slotPos[0] + sDr, slotPos[1] - 1],
            ];

            for (const nbrPos of nbrs) {
                if (posInBounds(nbrPos) && !isFriendlyCapture(slotPos, nbrPos, grid)) {
                    attacking.add(rowColToChessCoord(nbrPos));
                }
            }
            break;
        }

        case "knight": {
            for (const magnitudes of [[1, 2], [2, 1]]) {
                for (const directionR of [1, -1]) {
                    for (const directionC of [1, -1]) {
                        const dr = magnitudes[0] * directionR;
                        const dc = magnitudes[1] * directionC;

                        const nbrPos: Pos = [slotPos[0] + dr, slotPos[1] + dc];

                        if (posInBounds(nbrPos) && !isFriendlyCapture(slotPos, nbrPos, grid)) {
                            attacking.add(rowColToChessCoord(nbrPos));
                        }
                    }
                }
            }
            break;
        }

        case "bishop": {
            // Diagonal directions.
            const movements: Pos[] = [
                [1, 1],
                [-1, -1],
                [1, -1],
                [-1, 1],
            ];

            longRangeFillInAttackingCoords(movements, slotPos, attacking, grid);
            break;
        }

        case "rook": {
            // Cardinal directions.
            const movements: Pos[] = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ];
            longRangeFillInAttackingCoords(movements, slotPos, attacking, grid);
            break;
        }

        case "queen": {
            // Cardinal and diagonal directions.
            const movements: Pos[] = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [-1, -1],
                [1, -1],
                [-1, 1],
            ];

            longRangeFillInAttackingCoords(movements, slotPos, attacking, grid);
            break;
        }

        case "king": {
            const nbrs: Pos[] = [
                [slotPos[0] + 1, slotPos[1]],
                [slotPos[0] - 1, slotPos[1]],
                [slotPos[0], slotPos[1] + 1],
                [slotPos[0], slotPos[1] - 1],

                [slotPos[0] + 1, slotPos[1] + 1],
                [slotPos[0] + 1, slotPos[1] - 1],
                [slotPos[0] - 1, slotPos[1] + 1],
                [slotPos[0] - 1, slotPos[1] - 1],
            ];
            for (const nbrPos of nbrs) {
                if (posInBounds(nbrPos) && !isFriendlyCapture(slotPos, nbrPos, grid)) {
                    attacking.add(rowColToChessCoord(nbrPos));
                }
            }
            break;
        }
    }

    return attacking;
}

function toBoardRundown(grid: Grid): BoardRundown {
    const rundown: BoardRundown = {
        p1: {},
        p2: {},
    };
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const slot = grid[r][c];

            if (slot.piece === null) {
                continue;
            }
            const chessCoord = rowColToChessCoord([r, c]);

            rundown[slot.player!][chessCoord] = {
                attacking: getAttackingCoords(grid, [r, c]),
            };
        }
    }
    return rundown;
}

// Determines if the given player is in check.
function inCheck(gridData: GridData, player: PlayerRole) {
    const rundown = toBoardRundown(gridData.grid);

    // DEBUG:
    for (const role of Object.keys(rundown)) {
        console.log(`${role} RUNDOWN: `);
        for (const coord of Object.keys(rundown[role as PlayerRole])) {
            console.log(`${coord}: ${getSlot(gridData.grid, chessCoordToRowCol(coord)).piece}`);
            console.log(rundown[role as PlayerRole][coord].attacking);
        }
    }

    //console.log(JSON.stringify(rundown, null, 2));

    const otherPlayer = Game.togglePlayerRole(player);

    for (const pieceCoord of Object.keys(rundown[otherPlayer])) {
        const kingCoord = gridData.kingCoords[player];

        if (rundown[otherPlayer][pieceCoord].attacking.has(kingCoord)) {
            return true; // in check
        }
    }
    return false; // not in check
}

// Gets a slot from the grid at the given position (without validation).
function getSlot(grid: Grid, pos: Pos): Slot {
    return grid[pos[0]][pos[1]];
}

// Determines whether the slot at `nbrPos` has turf different from the piece in `slot`.
function nbrSlotHasEnemyTurf(slot: Slot, nbrPos: Pos, grid: Grid) {
    return getSlot(grid, nbrPos).turf === Game.togglePlayerRole(slot.player!);
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