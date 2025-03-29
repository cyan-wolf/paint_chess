import { Game } from "./game.ts";

// Server-side board class.
export class Board {
    gridData: GridData
    turn: PlayerRole

    // Used for reporting purposes, not for actual logic.
    checkStatus: CheckStatus
    lastChangedCoords: Set<Coord>
    legalMovesRundown?: LegalMovesRundown

    boardEventListeners: BoardEventListener[]

    constructor() {
        this.gridData = {
            grid: [],
            kingCoords: {
                // Placeholder initial values.
                p1: "",
                p2: "",
            },
            castlingData: {
                p1: {
                    kingHasMoved: false,
                    leftRookMoved: false,
                    rightRookMoved: false,
                },
                p2: {
                    kingHasMoved: false,
                    leftRookMoved: false,
                    rightRookMoved: false,
                },
            },
        };
        this.turn = "p1";

        this.checkStatus = null;
        this.lastChangedCoords = new Set();
        this.legalMovesRundown = undefined;

        this.boardEventListeners = [];

        for (let r = 0; r < 8; r++) {
            const row = [];
            for (let c = 0; c < 8; c++) {
                row.push(newEmptySlot());
            }
            this.getGrid().push(row);
        }

        this.loadBoardDesc(genInitialChessBoardDesc());
        //this.loadBoardDesc(genTestBoardDesc());
    }

    getGrid(): Grid {
        return this.gridData.grid;
    }

    // Processes a move given by the game itself.
    processMove(move: Move): boolean {
        const newGridData = structuredClone(this.gridData);

        // Performs a move on a clone of the current grid's data.
        const couldMove = performVirtualMove(move, this.turn, newGridData);

        // If the move couldn't be performed then return.
        if (!couldMove) {
            return false;
        }

        // Toggle the turn.
        this.turn = Game.togglePlayerRole(this.turn);

        // Update the actual grid data.
        this.gridData = newGridData;

        // Reset check status (used for reporting).
        this.checkStatus = null;

        // Reset the last moved coords (used for reporting).
        this.lastChangedCoords.clear();
        this.lastChangedCoords.add(move.from);
        this.lastChangedCoords.add(move.to);

        // Generate the current rundown of each piece's legal moves.
        const currLegalBoardRundown = genLegalMovesRundown(this.gridData);

        // Set the legal moves rundown (used for reporting).
        this.legalMovesRundown = currLegalBoardRundown;

        // Verify if the other player is in check (for alerting the players of the check).
        const otherPlayerChecked = inCheck(this.gridData, this.turn);
        const otherPlayerMoveless = outOfLegalMoves(this.gridData, this.turn, currLegalBoardRundown);

        if (otherPlayerChecked && otherPlayerMoveless) {
            const winningPlayer = Game.togglePlayerRole(this.turn);

            this.emitBoardEvent({
                kind: "checkmate",
                by: winningPlayer,
            });
        }

        if (otherPlayerChecked) {
            const checkedPlayer = this.turn;

            // Used for reporting whether a player is in check.
            this.checkStatus = {
                who: checkedPlayer, 
                kingCoord: this.gridData.kingCoords[checkedPlayer],
            };
        }
        else if (otherPlayerMoveless) {
            this.emitBoardEvent({ kind: "stalemate" });
        }

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

    // Wires a board event listener to the board.
    addBoardEventListener(onBoardEvent: BoardEventListener) {
        this.boardEventListeners.push(onBoardEvent);
    }

    // Emits a board event; used for notifying the game of 
    // check, stalemate, and checkmate.
    emitBoardEvent(event: BoardEvent) {
        for (const onBoardEvent of this.boardEventListeners) {
            onBoardEvent(event);
        }
    }
}

// Performs the specified move on the given grid data object.
function performVirtualMove(move: Move, turn: PlayerRole, gridData: GridData): boolean {
    const { from, to, player } = move;

    const fromPos = chessCoordToRowCol(from);
    const toPos = chessCoordToRowCol(to);

    if (!posInBounds(fromPos) || !posInBounds(toPos)) {
        return false;
    }

    const slotToMove = gridData.grid[fromPos[0]][fromPos[1]];

    if (slotToMove.piece === null) {
        // Player should only be able to move pieces.
        return false;
    }
    else if (slotToMove.player !== player) {
        // Player should only be able to move their own pieces.
        return false;
    }
    else if (slotToMove.player !== turn) {
        // Player should only be able to move on their turn.
        return false;
    }

    const tryingToCastle = detectCastlingAttempt(fromPos, toPos, gridData.grid);

    // Normal movement attempt.
    if (!tryingToCastle) {
        // Basic validation for pieces.
        if (!prelimVerifyMove(fromPos, toPos, gridData.grid)) {
            return false;
        }

        // Stops pieces from the same player from capturing each other.
        if (isFriendlyCapture(fromPos, toPos, gridData.grid)) {
            return false;
        }

        const path = getInBetweenPositions(fromPos, toPos);

        if (!pathIsValid(gridData.grid, path)) {
            return false;
        }

        // Actually moves the piece and fills in the path it "traversed".
        // Updates the cached king position if one moved.
        movePiece(gridData, fromPos, toPos, path);

        // Handle pawn promotion.
        promotePawnIfNeeded(gridData, slotToMove, toPos, move.promotion);
    }
    // Castling.
    else {
        const couldPerformCastling = performCastling(gridData, fromPos, toPos);
        if (!couldPerformCastling) {
            return false;
        }
    }

    // Look for check.
    if (inCheck(gridData, turn)) {
        return false;
    }

    return true;
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

    if (slotToMove.piece === "king") {
        // Updates the cached king position (if one moved).
        gridData.kingCoords[slotToMove.player!] = rowColToChessCoord(toPos);

        // Mark the king as having moved (prevents castling).
        gridData.castlingData[slotToMove.player!].kingHasMoved = true;
    }
    else if (slotToMove.piece === "rook") {
        const [_, col] = fromPos;

        // Mark the respective rook as having moved (prevents castling).
        if (col === 0) {
            gridData.castlingData[slotToMove.player!].leftRookMoved = true;
        } 
        else if (col === 7) {
            gridData.castlingData[slotToMove.player!].rightRookMoved = true;
        }
    }
}

function promotePawnIfNeeded(gridData: GridData, slotToMove: Slot, toPos: Pos, promotion?: PromotionPiece) {
    const promotionPiece: PromotionPiece = promotion ?? "queen";

    if (slotToMove.piece === "pawn") {
        const reachedRank = toPos[0];
        const reachedLastRank = (slotToMove.player === "p1") ?  
            (reachedRank === 0) : (reachedRank === 7);

        if (reachedLastRank) {
            // By this point, the pawn has already reached `toPos`.
            // Promote (mutate) the piece at `toPos` on the spot.
            getSlot(gridData.grid, toPos).piece = promotionPiece;
        }
    }
}

function detectCastlingAttempt(fromPos: Pos, toPos: Pos, grid: Grid): boolean {
    const slotToMove = getSlot(grid, fromPos);
    const selectedSlot = getSlot(grid, toPos);

    return slotToMove.piece === "king" && 
        selectedSlot.piece === "rook" && 
        slotToMove.player === selectedSlot.player;
}

function performCastling(gridData: GridData, fromPos: Pos, toPos: Pos): boolean {
    const kingSlot = getSlot(gridData.grid, fromPos);
    const player = kingSlot.player!;

    if (gridData.castlingData[player].kingHasMoved) {
        return false;
    }

    const [rookRow, rookCol] = toPos;
    
    let kingDestPos: Pos;
    let kingPath: Pos[];
    const rookStartPos = toPos;
    let rookEndPos: Pos;

    if (rookCol === 0) {
        if (gridData.castlingData[player].leftRookMoved) {
            return false;
        }
        kingDestPos = [rookRow, fromPos[1] - 2];
        kingPath = getInBetweenPositions(fromPos, kingDestPos);
        rookEndPos = [rookRow, rookCol + 3];

        //gridData.castlingData[player].leftRookMoved = true;
    }
    else if (rookCol === 7) {
        if (gridData.castlingData[player].rightRookMoved) {
            return false;
        }
        kingDestPos = [rookRow, fromPos[1] + 2];
        kingPath = getInBetweenPositions(fromPos, kingDestPos);
        rookEndPos = [rookRow, rookCol - 2];

        //gridData.castlingData[player].rightRookMoved = true;
    }
    else {
        // Unreachable (?).
        return false;
    }

    // Verify if the king has a safe path to the castling destination 
    // (i.e. isn't in check along the way).
    for (const pos of kingPath) {
        const virtualGridData = structuredClone(gridData);
        const virtualMove: Move = {
            from: rowColToChessCoord(fromPos),
            to: rowColToChessCoord(pos),
            player: kingSlot.player!,
        };
        const couldMove = performVirtualMove(virtualMove, kingSlot.player!, virtualGridData);

        // console.log(pos);
        // console.log(couldMove);

        // TODO: this isn't working because the kingPath
        // includes the king's current position, 
        // which is automatically an illegal move since 
        // the king can't move to it's current position.

        // // Used to detect if the king was in check.
        // if (!couldMove) {
        //     return false;
        // }
    }

    // Stop the king from going through pieces.
    if (!pathIsValid(gridData.grid, kingPath)) {
        return false;
    }

    // Stop the king from accidentally capturing a friendly piece.
    if (isFriendlyCapture(fromPos, kingDestPos, gridData.grid)) {
        return false;
    }

    // Check if the path is open between the rook and the king's future position.
    const verificationRookPath = getInBetweenPositions(rookStartPos, kingDestPos);
    if (!pathIsValid(gridData.grid, verificationRookPath)) {
        return false;
    }

    // Move the rook.
    const actualRookPath = getInBetweenPositions(rookStartPos, rookEndPos);
    
    // Forcefully move the rook without checking the path.
    movePiece(gridData, rookStartPos, rookEndPos, actualRookPath);

    // Forcefully move the king to the correct position.
    // The path is empty since there is no way to observe the king's 
    // path in a normal game when castling.
    movePiece(gridData, fromPos, kingDestPos, []);
    //gridData.castlingData[player].kingHasMoved = true;

    // Delete the old slot's king.
    const emptySlot = newEmptySlot();
    emptySlot.turf = player;
    gridData.grid[fromPos[0]][fromPos[1]] = emptySlot;

    return true;
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

    const otherPlayer = Game.togglePlayerRole(player);

    for (const pieceCoord of Object.keys(rundown[otherPlayer])) {
        const kingCoord = gridData.kingCoords[player];

        if (rundown[otherPlayer][pieceCoord].attacking.has(kingCoord)) {
            return true; // in check
        }
    }
    return false; // not in check
}

function genPossibleLandingCoords(pieceCoord: Coord, player: PlayerRole, grid: Grid, rundown: BoardRundown): Set<Coord> {
    const piecePos = chessCoordToRowCol(pieceCoord);
    const slot = getSlot(grid, piecePos);

    let possibleOwnLandingCoords: Set<Coord>;

    switch (slot.piece!) {
        case "pawn": {
            const sDr = (player === "p1") ? -1 : 1;
            const possibleLandingPositions = [
                // Move forward by 1 or 2 slots.
                [piecePos[0] + sDr, piecePos[1]],
                [piecePos[0] + 2 * sDr, piecePos[1]],

                // Diagonal movement (would only be valid 
                // if it resulted in a capture).
                [piecePos[0] + sDr, piecePos[1] + 1],
                [piecePos[0] + sDr, piecePos[1] - 1],
            ];

            possibleOwnLandingCoords = new Set();

            for (const landingPos of possibleLandingPositions) {
                possibleOwnLandingCoords.add(rowColToChessCoord(landingPos as Pos));
            }  
            break;
        }
        case "king": {
            possibleOwnLandingCoords = rundown[player][pieceCoord].attacking;

            const kingPos = chessCoordToRowCol(pieceCoord);
            const rookCastlingPositions = [
                // Left rook.
                [kingPos[0], kingPos[1] - 4],

                // Right rook.
                [kingPos[0], kingPos[1] + 3],
            ];

            // Add the castling rook coords to the king's possible "landing" coords.
            for (const rookPos of rookCastlingPositions) {
                possibleOwnLandingCoords.add(rowColToChessCoord(rookPos as Pos));
            }
            break;
        }

        default:
            possibleOwnLandingCoords = rundown[player][pieceCoord].attacking;
            break;
    }
    return possibleOwnLandingCoords;
}

function genLegalMovesRundown(gridData: GridData, onlyForPlayer?: PlayerRole): LegalMovesRundown {
    const rundown = toBoardRundown(gridData.grid);

    const legalMovesRundown: LegalMovesRundown = {
        "p1": {},
        "p2": {},
    };

    for (const role of ["p1", "p2"]) {
        const player = role as PlayerRole;

        if (onlyForPlayer !== undefined) {
            if (player !== onlyForPlayer) {
                continue;
            }
        }

        for (const ownPieceCoord of Object.keys(rundown[player as PlayerRole])) {
            const possibleOwnLandingCoords = genPossibleLandingCoords(ownPieceCoord, player, gridData.grid, rundown);
    
            for (const landingCoord of possibleOwnLandingCoords) {
                const move: Move = {
                    from: ownPieceCoord,
                    to: landingCoord,
                    player,
                };
    
                const couldMove = performVirtualMove(move, player, structuredClone(gridData));
                if (couldMove) {
                    if (legalMovesRundown[player][ownPieceCoord] === undefined) {
                        legalMovesRundown[player][ownPieceCoord] = [];
                    }
                    legalMovesRundown[player][ownPieceCoord].push(landingCoord);
                }
            }
        }
    }
    return legalMovesRundown;
}

// Determines whether the given player can perform any moves without being in check.
// If there are no legal moves, then there is a stalemate.
function outOfLegalMoves(gridData: GridData, player: PlayerRole, legalMovesRundown: LegalMovesRundown): boolean {
    for (const coord of Object.keys(legalMovesRundown[player])) {
        const moveAmt = legalMovesRundown[player][coord].length;

        if (moveAmt > 0) {
            return false;
        }
    }
    return true;
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

function genTestBoardDesc(): BoardDescription {
    const boardDesc: BoardDescription = {
        // First player's side.
        "a1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        // "b1": {
        //     piece: "knight",
        //     player: "p1",
        //     turf: "p1",
        // },
        // "c1": {
        //     piece: "bishop",
        //     player: "p1",
        //     turf: "p1",
        // },
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
        // "f1": {
        //     piece: "bishop",
        //     player: "p1",
        //     turf: "p1",
        // },
        // "g1": {
        //     piece: "knight",
        //     player: "p1",
        //     turf: "p1",
        // },
        "h1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        // Second player's side.
        // "a8": {
        //     piece: "rook",
        //     player: "p2",
        //     turf: "p2",
        // },
        // "b8": {
        //     piece: "knight",
        //     player: "p2",
        //     turf: "p2",
        // },
        // "c8": {
        //     piece: "bishop",
        //     player: "p2",
        //     turf: "p2",
        // },
        // "d8": {
        //     piece: "queen",
        //     player: "p2",
        //     turf: "p2",
        // },
        "e8": {
            piece: "king",
            player: "p2",
            turf: "p2",
        },
        // "f8": {
        //     piece: "bishop",
        //     player: "p2",
        //     turf: "p2",
        // },
        // "g8": {
        //     piece: "knight",
        //     player: "p2",
        //     turf: "p2",
        // },
        // "h8": {
        //     piece: "rook",
        //     player: "p2",
        //     turf: "p2",
        // },
    };
    return boardDesc;
}