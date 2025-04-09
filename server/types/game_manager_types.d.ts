import { Game } from "../game.ts";
import { GameEndResult, GameViewForClient, Message } from "./game_types.d.ts";

type ID = string;

type GameSettings = {
    secsPerPlayer: number,
    vsAI: boolean,
};

type GameQueue = {
    [gameId: ID]: {
        waitingPlayers: string[],
        gameSettings: GameSettings,
    }
};

type QueuedGameClientView = {
    gameId: ID,
    waitingUsername: string,
    waitingDisplayname: string,
    waitingELO: number,
    gameMins: number,
};

type PlayerInfo = {
    gameId?: ID,
    joined: boolean,
    active: boolean,
    queueing: boolean,
    eventHandler: GameManagerEventHandler,
};

type PlayerRegistry = {
    [username: string]: PlayerInfo,
};

type ActiveGames = {
    [gameId: ID]: Game
};

type GameManagerEvent = 
    | { kind: "game-start", payload: GameViewForClient }
    | { kind: "move-performed-response", payload: GameViewForClient }
    | { kind: "play-sound", payload: { sound: "move" | "game-end" } }
    | { kind: "current-chat-history", payload: { history: Message[] } }
    | { kind: "game-ended", payload: { result: GameEndResult } }
    | { kind: "found-game", payload: { gameId: ID } }
    | { kind: "current-game-queue", payload: QueuedGameClientView[] };

type GameManagerEventHandler = (event: GameManagerEvent) => void;