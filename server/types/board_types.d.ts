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

/**
 * A union of the possible pieces a pawn can promote into.
 */
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

/**
 * Represents a "description" of a slot sent by the client.
 */
type SlotDescription = {
    piece?: Piece,
    player?: PlayerRole,
    turf?: PlayerRole,
};

/**
 * Represents a 2D grid of slots.
 */
type Grid = Slot[][];

/**
 * Used for caching the coordinates of the player's kings.
 */
type KingCoords = {
    [player in PlayerRole]: Coord
};

/**
 * Used for caching the associated bookeeping needed for castling.
 */
type CastlingData = {
    [player in PlayerRole]: {
        kingHasMoved: boolean,
        leftRookMoved: boolean,
        rightRookMoved: boolean,
    }
};

/**
 * Represents a grid along with additional bookeeping needed for a 
 * game to work.
 */
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

/**
 * Maps each player's pieces to the set of all coordinates attacked by that piece.
 */
type BoardRundown = {
    [player in PlayerRole]: {
        [coord: Coord]: {
            attacking: Set<Coord>
        }
    }
};

/**
 * Maps each player's pieces to a list of the piece's legal moves.
 */
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

/**
 * Represents an event emitted by the board.
 */
type BoardEvent = 
    | { kind: "stalemate" }
    | { kind: "checkmate", by: PlayerRole };

type BoardEventListener = (e: BoardEvent) => void;
