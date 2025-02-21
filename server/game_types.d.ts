
/**
 * Represents general information that a running game should have,
 * such as the game ID, the amount of joined players, and the 
 * usernames of both players.
 */
type MetaGameInfo = {
    gameId: string,
    joinedPlayers: number,
    p1: string,
    p2: string,
    secsPerPlayer: number,
    hasStarted: boolean,
};

/**
 * Specifies the colors that a player has in the game.
 * `piece` determines the color that the pieces have, 
 * `bgLight` determines the color of painted light slots,
 * and `bgDark` determines the color of painted dark slots.
 */
type ColorInfo = {
    piece: string;
    bgLight: string;
    bgDark: string;
};

/**
 * Determines the colors for each player.
 */
type ColorConfig = {
    [player in PlayerRole]: ColorInfo
};

/**
 * Used for filling out the "game-info" section on the client.
 */
type PlayerSpecificGameInfo = {
    username: string,
    color: string,
};

/**
 * A representation of a game suitable for sending to the 
 * client.
 */
type GameViewForClient = {
    gameInfo: {
        gameId: string,
        p1: PlayerSpecificGameInfo,
        p2: PlayerSpecificGameInfo,
        turn: PlayerSpecificGameInfo,
    },
    boardConfig: {
        isFlipped: boolean,
        colorConfig: ColorConfig,
    };
    boardDesc: BoardDescription,
    timeDesc: {
        ownSecsLeft: number,
        opponentSecsLeft: number,
    },
};

/**
 * Represents a move sent by the client. Needs to be 
 * verified before being able to be used as a proper `Move`.
 */
type RawMove = { 
    from?: string, 
    to?: string, 
    username?: string,
};

type Message = {
    by: string,
    content: string,
};

type TimeInfo = {
    [player in PlayerRole]: {
        millisLeft: number,
        lastTimestamp: number | null,
    }
};

type GameEndResult = {
    winner: PlayerRole | null,
    method: "timeout" | "resign" | "stalemate" | "checkmate",
};

type GameEndDelegate = (result: GameEndResult) => void;