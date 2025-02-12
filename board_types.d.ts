type Pos = [number, number];
type Coord = string;

type PlayerRole = "p1" | "p2";

type Piece = 
    | "pawn"
    | "knight"
    | "bishop"
    | "rook"
    | "queen"
    | "king";

type Slot = {
    piece: Piece | null,
    player: PlayerRole | null,
    turf: PlayerRole | null
};

type SlotDescription = {
    piece?: Piece,
    player?: PlayerRole,
    turf?: PlayerRole,
};

type BoardDescription = {
    [chessCoord: string]: SlotDescription,
};

type Move = { 
    from: Coord, 
    to: Coord, 
    player: PlayerRole
};