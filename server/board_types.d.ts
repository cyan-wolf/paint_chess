/**
 * Represents a position on the board. The first element 
 * represents the row and the second element the column.
 */
type Pos = [number, number];

/**
 * Represents a chess coordinate.
 */
type Coord = string;

/**
 * Represents a role that a player can have in a game.
 * `p1` is the player that moves first.
 */
type PlayerRole = "p1" | "p2";

/**
 * Represents the name of a piece.
 */
type Piece = 
    | "pawn"
    | "knight"
    | "bishop"
    | "rook"
    | "queen"
    | "king";

type PromotionPiece = 
    | "knight"
    | "bishop"
    | "rook"
    | "queen";

/**
 * Represents a slot on the board.
 * `piece` is the name of the piece, 
 * `player` is the player that the piece belongs to,
 * and `turf` is the player that painted the ground.
 */
type Slot = {
    piece: Piece | null,
    player: PlayerRole | null,
    turf: PlayerRole | null
};

// TODO: Remove the need to use this. The only reason this is used 
// is because of the way the client-side API works.
// This should be replaced with `Slot`.
type SlotDescription = {
    piece?: Piece,
    player?: PlayerRole,
    turf?: PlayerRole,
};

type Grid = Slot[][];

type KingCoords = {
    [player in PlayerRole]: Coord
};

type CastlingData = {
    [player in PlayerRole]: {
        kingHasMoved: boolean,
        leftRookMoved: boolean,
        rightRookMoved: boolean,
    }
};

type GridData = {
    grid: Grid,
    kingCoords: KingCoords,
    castlingData: CastlingData,
};

/**
 * Represents a map of chess coordinates to their contents.
 */
type BoardDescription = {
    [chessCoord: Coord]: SlotDescription,
};

/**
 * Represents a move from a player.
 */
type Move = { 
    from: Coord, 
    to: Coord, 
    player: PlayerRole
    promotion?: PromotionPiece,
};

type BoardRundown = {
    [player in PlayerRole]: {
        [coord: Coord]: {
            attacking: Set<Coord>
        }
    }
};

type LegalMovesRundown = {
    [player in PlayerRole]: {
        [coord: Coord]: Coord[],
    }
};

/**
 * Used for telling the client whether a player is in check or not.
 */
type CheckStatus = 
    | { who: PlayerRole, kingCoord: Coord } 
    | null;

type BoardEvent = 
    | { kind: "stalemate" }
    | { kind: "checkmate", by: PlayerRole };

type BoardEventListener = (e: BoardEvent) => void;
