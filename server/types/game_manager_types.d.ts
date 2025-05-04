import { ID } from "../../utils.ts";
import { Game } from "../game.ts";
import { GameEndResult, GameViewForClient, Message } from "./game_types.d.ts";

/**
 * Represents game settings used to configure a game.
 */
type GameSettings = {
    secsPerPlayer: number,
    vsAI: boolean,
};

/**
 * Represents the game queue.
 */
type GameQueue = {
    [gameId: ID]: {
        waitingPlayers: string[],
        gameSettings: GameSettings,
    }
};

/**
 * Represents a view into a queued game.
 */
type QueuedGameClientView = {
    gameId: ID,
    waitingUsername: string,
    waitingDisplayname: string,
    waitingELO: number,
    gameMins: number,
};

/**
 * Represents player information on the player registry.
 */
type PlayerInfo = {
    gameId?: ID,
    joined: boolean,
    active: boolean,
    queueing: boolean,
    eventHandler: GameManagerEventHandler,
};

/**
 * Maps player usernames to the corresponding registry information.
 */
type PlayerRegistry = {
    [username: string]: PlayerInfo,
};

type ActiveGames = {
    [gameId: ID]: Game
};

/**
 * Union of the different events emitted by the Game Manager.
 */
type GameManagerEvent = 
    | { kind: "game-start", payload: GameViewForClient }
    | { kind: "move-performed-response", payload: GameViewForClient }
    | { kind: "play-sound", payload: { sound: "move" | "game-end" } }
    | { kind: "current-chat-history", payload: { history: Message[] } }
    | { kind: "game-ended", payload: { result: GameEndResult } }
    | { kind: "found-game", payload: { gameId: ID } }
    | { kind: "current-game-queue", payload: QueuedGameClientView[] };

/**
 * A function that handles a Game Manager event.
 */
type GameManagerEventHandler = (event: GameManagerEvent) => void;