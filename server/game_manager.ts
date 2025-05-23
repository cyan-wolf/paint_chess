import { Game } from "./game.ts";

import * as data_access from "./data_access.ts";
import { ChessAIUser } from "./chess_ai.ts";
import { ActiveGames, GameManagerEvent, GameManagerEventHandler, GameQueue, GameSettings, PlayerInfo, PlayerRegistry, QueuedGameClientView } from "./types/game_manager_types.d.ts";
import { GameEndResult, RawMove } from "./types/game_types.d.ts";
import { PublicUserData } from "./types/db_conn_types.d.ts";

import * as utils from "../utils.ts";
import { ID } from "../utils.ts";

export class GameManager {
    queuedGamesDb: GameQueue;
    activeGamesDb: ActiveGames;
    playerRegistry: PlayerRegistry;

    constructor() {
        this.queuedGamesDb = {};
        this.activeGamesDb = {};
        this.playerRegistry = {};
    }

    // Make sure that the game settings are valid.
    validateGameSettings(gameSettings: unknown): gameSettings is GameSettings {
        if (typeof(gameSettings) !== 'object' || gameSettings === null) {
            return false;
        }
        if (! ('secsPerPlayer' in gameSettings)) {
            return false;
        }
        if (! ('vsAI' in gameSettings)) {
            return false;
        }
        if (typeof(gameSettings.secsPerPlayer) !== 'number') {
            return false;
        }
        if (typeof(gameSettings.vsAI) !== 'boolean') {
            return false;
        }
        // Only accept times between 1 and 90 minutes.
        if (gameSettings.secsPerPlayer < 1 * 60 || gameSettings.secsPerPlayer > 90 * 60) {
            return false;
        }
        return true;
    }

    // Determines whether the given game ID is being queued.
    gameIdIsQueued(gameId: ID): boolean {
        return Object.hasOwn(this.queuedGamesDb, gameId);
    }

    // Determines whether the given game ID is being used by an active game.
    gameIdIsActive(gameId: ID): boolean {
        return Object.hasOwn(this.activeGamesDb, gameId);
    }

    // Determines whether the given player is already in queue.
    usernameIsQueueingGame(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username) && 
            this.playerRegistry[username].queueing;
    }

    // Determines whether the given user is in an active game.
    usernameIsInActiveGame(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username) && 
            this.playerRegistry[username].active;
    }

    // Determines whether the given username is in the (active) game 
    // with the given ID.
    usernameInGivenActiveGame(username: string, gameId: ID): boolean {
        return this.gameIdIsActive(gameId) && 
            this.activeGamesDb[gameId].hasUser(username);
    }

    // Determines whether the given username is in the (queued) game 
    // with the given ID.
    usernameInGivenQueuedGame(username: string, gameId: ID): boolean {
        return this.gameIdIsQueued(gameId) && 
            this.queuedGamesDb[gameId].waitingPlayers.includes(username);
    }

    usernameInRegistry(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username);
    }

    // Saves a player to the registry if it wasn't in it already.
    saveUsernameToRegistry(username: string, eventHandler: GameManagerEventHandler) {
        if (!this.usernameInRegistry(username)) {
            this.playerRegistry[username] = {
                joined: false,
                active: false,
                queueing: false,
                eventHandler,
            };
        }
    }

    removeUsernameFromRegistry(username: string) {
        if (this.usernameInRegistry(username)) {
            delete this.playerRegistry[username];
        }
        else {
            console.error(`ERROR: user (${username}) could not be removed from registry`);
        }
    }

    resetRegistryData(username: string) {
        const playerInfo = this.playerRegistry[username];
        playerInfo.gameId = undefined;
        playerInfo.active = false;
        playerInfo.joined = false;
        playerInfo.queueing = false;
    }

    // Gets a player from the registry.
    getPlayer(username: string): PlayerInfo {
        if (!this.usernameInRegistry(username)) {
            throw new Error(`invalid player ${username}`);
            
        }
        return this.playerRegistry[username];
    }

    createAiUser(generatedUsername: string, gameIdToJoin: ID): string {
        data_access.addTemporaryUser(generatedUsername, {
            displayname: "Paint Chess AI",
            elo: 400,
        });
        
        const ai = new ChessAIUser(generatedUsername, gameIdToJoin, this);
        ai.register();

        return generatedUsername;
    }

    // Creates a new queued game.
    createQueuedGame(gameSettings: GameSettings): ID {
        const gameId = utils.genId();

        this.queuedGamesDb[gameId] = {
            waitingPlayers: [],
            gameSettings,
        };

        console.log(`LOG: queued new game ${gameId}`);

        if (gameSettings.vsAI) {
            const generatedUsername = data_access.generateTemporaryUsername("ai");
            //waitingPlayers.push(generatedUsername);
            this.createAiUser(generatedUsername, gameId);
        }
        return gameId;
    }

    // Dequeues the player from a queued game.
    // Does nothing if the player was not queuing a game.
    userWantsToLeaveQueuedGame(username: string) {
        if (! this.usernameIsQueueingGame(username)) {
            // A user can't leave their queued game if they aren't 
            // even queueing a game in the first place.
            return;
        }

        // Dequeue the player.
        const playerInfo = this.playerRegistry[username];
        const queuedGame = this.queuedGamesDb[playerInfo.gameId!];

        // Remove the player from the queued game.
        const idx = queuedGame.waitingPlayers.indexOf(username);
        queuedGame.waitingPlayers.splice(idx, 1);

        // Delete the queued game if it no longer has any players.
        if (queuedGame.waitingPlayers.length === 0) {
            delete this.queuedGamesDb[playerInfo.gameId!];
        }
    }

    // Joins a player to the given game.
    userWantsToJoinQueuedGame(username: string, gameId: ID) {
        if (!this.usernameInRegistry(username)) {
            // User is not in registry, therefore cannot 
            // receive game manager events.
            console.log(`LOG: user ${username} is not in registry.`);
            return; 
        }

        if (!this.gameIdIsQueued(gameId)) {
            return; // ignore attempt if game ID is invalid
        }

        if (this.usernameIsInActiveGame(username)) {
            return; // ignore attempt if the user is playing currently playing a game
        }
        
        if (this.usernameIsQueueingGame(username)) {
            // Ignore queue attempt since the player is already
            // queuing this game.
            if (this.playerRegistry[username].gameId === gameId) {
                return;
            }

            // Make the player leave their currently queued game 
            // if they are trying to queue to another game.
            this.userWantsToLeaveQueuedGame(username);
        }

        const queuedGame = this.queuedGamesDb[gameId];

        // Mark the current player as queueing the game.
        const playerInfo = this.playerRegistry[username];
        playerInfo.gameId = gameId;
        playerInfo.queueing = true;

        queuedGame.waitingPlayers.push(username);
        
        if (queuedGame.waitingPlayers.length == 2) {
            this.createGame(gameId);
        }
    }

    // Calculates the probability of a `rating2` rated player winning 
    // over a `rating1` rated player.
    calcWinningProbability(rating1: number, rating2: number): number {
        return 1.0 / (1 + Math.pow(10, (rating2 - rating1) / 400.0));
    }

    // Calculate new ELO ratings.
    calcNewELORatings(ratingP1: number, ratingP2: number, k: number, outcomeValue: number): [number, number] {
        const winningProbabilityP1 = this.calcWinningProbability(ratingP2, ratingP1);
        const winningProbabilityP2 = this.calcWinningProbability(ratingP1, ratingP2);

        const updatedRatingP1 = ratingP1 + k * (outcomeValue - winningProbabilityP1);
        const updatedRatingP2 = ratingP2 + k * ((1 - outcomeValue) - winningProbabilityP2);

        return [updatedRatingP1, updatedRatingP2];
    }

    // Determines the associated outcome value based on the game's end result.
    // Used for calculating ELO.
    getOutcomeValue(gameResult: GameEndResult): number {
        if (gameResult.winner === null) {
            return 0.5; // no winner
        }
        else if (gameResult.winner === "p1") {
            return 1;
        }
        else if (gameResult.winner === "p2") {
            return 0;
        }
        else {
            // Unreachable.
            throw new Error("Unknown game outcome.");
        }
    }

    // Gets the given user's ELO rating.
    getUserELO(username: string): number {
        // Get the game ID for this player.
        const userGameId = this.playerRegistry[username].gameId;

        if (userGameId === undefined) {
            throw new Error("could not get player ELO");
        }
        
        const game = this.activeGamesDb[userGameId];
        const role: PlayerRole = game.usernameToRole(username);

        // Get the ELO value cached in the game.
        return game.meta[role].elo;
    }

    // Determines and sets new ELO ratings after a game.
    async determineELORatings(usernameP1: string, usernameP2: string, gameResult: GameEndResult): Promise<void> {
        const eloP1 = this.getUserELO(usernameP1);
        const eloP2 = this.getUserELO(usernameP2);

        const outcomeValue = this.getOutcomeValue(gameResult);
        const k = 10;

        const [newEloP1, newEloP2] = this.calcNewELORatings(eloP1, eloP2, k, outcomeValue);

        // Set the updated user ratings.
        await data_access.setUserELO(usernameP1, newEloP1);
        await data_access.setUserELO(usernameP2, newEloP2);
    }

    // Generate a slice of some of the game queues to send to the client in a nice format.
    async genClientGameQueueSlice(): Promise<QueuedGameClientView[]> {
        const queuedGameIds = Object.keys(this.queuedGamesDb).slice(0, 10);

        const clientViews = [];

        for (const gameId of queuedGameIds) {
            const queuedGame = this.queuedGamesDb[gameId];

            // A queued game has at least 1 waiting player.
            const waitingUsername = queuedGame.waitingPlayers[0];

            const user = await data_access.fetchUserData(waitingUsername);
            if (user === null) {
                throw new Error(`user ${waitingUsername} not found`);
            }

            const clientView: QueuedGameClientView = {
                gameId,
                waitingUsername, 
                waitingDisplayname: user.displayname,
                waitingELO: user.elo,
                gameMins: queuedGame.gameSettings.secsPerPlayer / 60,
            };
            clientViews.push(clientView);
        }
        return clientViews;
    }

    // Sends the given event to all players in the registry.
    emitGameManagerEventToAll(event: GameManagerEvent) {
        for (const username of Object.keys(this.playerRegistry)) {
            this.emitEvent(username, event);
        }
    }

    // Sends the given event to the specified player.
    emitEvent(toUsername: string, event: GameManagerEvent) {
        if (this.usernameInRegistry(toUsername)) {
            this.playerRegistry[toUsername].eventHandler(event);
        }
    }

    /**
     * Makes the user queue a new game using the given settings.
     * @param username The identifier for the user.
     * @param gameSettings The settings for the game to be queued.
     * @returns The ID of the game if queuing was successfull, `null` otherwise.
     */
    userWantsQueueNewGame(username: string, gameSettings: GameSettings): ID | null {
        // Game settings must be valid.
        if (!this.validateGameSettings(gameSettings)) {
            return null;
        }
        // Prevent players in the middle of games from queuing new ones.
        if (this.usernameIsInActiveGame(username)) {
            return null;
        }
        // Prevent a player that's already queuing from queuing more games.
        if (this.usernameIsQueueingGame(username)) {
            return null;
        }
        const gameId = this.createQueuedGame(gameSettings);

        // Auto-join the user to the game.
        this.userWantsToJoinQueuedGame(username, gameId);

        return gameId;
    }

    userWantsToStartGame(username: string) {
        if (!this.usernameIsInActiveGame(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        
        // Re-join the user to the socket game room, as 
        // the connection was reset when the page reloaded 
        // when getting to "/game/:id".
        //socket.join(`user-${username}`);

        const game = this.activeGamesDb[gameId];

        // Player is joining for the first time.
        if (!this.playerRegistry[username].joined) {
            // Increment the number of joined players.
            game.joinPlayer();

            this.playerRegistry[username].joined = true;
        } 
        // Player is rejoining the game.
        else if (game.getUsernames().includes(username)) {
            const gameData = game.asClientView(username);
            this.emitEvent(username, { kind: "game-start", payload: gameData });

            // Exit event handler here to avoid the 
            // other player from receiving the "game-start" event as well.
            return;
        }

        // Officially start the game.
        if (game.getJoinedPlayerAmt() == 2 && !game.hasStarted()) {
            // Sets up various parts of the game.
            game.start();

            for (const usernameInGame of game.getUsernames()) {
                const gameData = game.asClientView(usernameInGame);
                this.emitEvent(usernameInGame, { kind: "game-start", payload: gameData });
            }
        }
    }

    /**
     * The move payload should conform to the following interface:
     * ```
     * { from: string, to: string, promotion?: string }
     * ```
     * @param username The username of the submitter of the move.
     * @param movePayload Should be an object that conforms to the given interface.
     */
    userWantsToPerformMove(username: string, movePayload: unknown) {
        if (!this.usernameIsInActiveGame(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        if (typeof movePayload !== "object") {
            return; // do not accept strange input
        }
        const rawMove: RawMove = {
            username,
            ...movePayload,
        };
        const couldMove = game.processMove(rawMove);

        if (!couldMove) {
            return;
        }

        // Send the result of the move to the users in the game.
        for (const usernameInGame of game.getUsernames()) {
            const gameData = game.asClientView(usernameInGame);

            this.emitEvent(usernameInGame, {
                kind: "move-performed-response",
                payload: gameData,
            });

            // Tell users to play a movement sound.
            this.emitEvent(usernameInGame, {
                kind: "play-sound",
                payload: { sound: "move" },
            });
        }
    }

    userWantsToPublishMessage(username: string, rawContent: unknown) {
        if (!this.usernameIsInActiveGame(username)) {
            // Ignore if the player is not in a game.
            return; 
        }

        if (typeof rawContent !== 'string') {
            return; // do not accept strange input
        }

        // Remove leading and trailing whitespace from message.
        // Escape any HTML.
        const content = utils.escapeHtml(rawContent.trim());

        if (content.length === 0 || content.length > 40) {
            return; // only accept valid messages
        }

        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        game.publishMessage({
            by: username,
            content,
        });

        // Send the chat to the users in the game.
        for (const usernameInGame of game.getUsernames()) {
            this.emitEvent(usernameInGame, {
                kind: "current-chat-history",
                payload: {
                    history: game.getMessageHistory(9),
                }
            });
        }
    }

    userWantsChatHistory(username: string) {
        if (!this.usernameIsInActiveGame(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        this.emitEvent(username, {
            kind: "current-chat-history",
            payload: {
                history: game.getMessageHistory(9),
            }
        });
    }

    userWantsToResign(username: string) {
        if (!this.usernameIsInActiveGame(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        game.finish({
            // The other player wins.
            winner: Game.togglePlayerRole(game.usernameToRole(username)),
            method: "resign",
        });
    }

    fetchQueuedUserData(queuedUsernames: string[]): Promise<PublicUserData[]> {
        return Promise.all(queuedUsernames.map(async (username) => {
            const userData = await data_access.fetchUserData(username);

            if (userData === null) {
                throw new Error(`could not get data from user ${username}`);
            }
            return userData;
        }));
    }

    // Turns a queued game into an active game.
    async createGame(gameId: ID) {
        if (!this.gameIdIsQueued(gameId)) {
            return; // prevent access to games that aren't being queued
        }

        const queuedGame = this.queuedGamesDb[gameId];

        // Remove game from queue.
        delete this.queuedGamesDb[gameId];

        for (const queuedUsername of queuedGame.waitingPlayers) {
            this.playerRegistry[queuedUsername].queueing = false;
            this.playerRegistry[queuedUsername].active = true;
        }

        // Randomly choose whether [p1Idx, p2Idx] is 
        // [0, 1] or [1, 0]. This makes it so that 
        // the first player in the `waitingPlayers` array
        // isn't always automatically Player 1 in the game.
        const p1Idx = Math.floor(Math.random() * 2);
        const p2Idx = (p1Idx + 1) % 2;
        
        const queuedUserData = await this.fetchQueuedUserData(queuedGame.waitingPlayers);

        const game = new Game({
            gameId,
            p1: queuedUserData[p1Idx], 
            p2: queuedUserData[p2Idx], 
            joinedPlayers: 0,
            secsPerPlayer: queuedGame.gameSettings.secsPerPlayer,
            hasStarted: false,
        });
        this.activeGamesDb[gameId] = game;

        game.addOnGameEndEventHandler((result) => {
            this.finishGame(result, game);
        });

        // Redirects the user to "/game/:id" on the client.
        for (const usernameInGame of game.getUsernames()) {
            this.emitEvent(usernameInGame, {
                kind: "found-game",
                payload: { gameId },
            });
        }
    }

    finishGame(gameEndResult: GameEndResult, game: Game) {
        const users = game.getUsernames();

        // Determine the new ELO of each player, as long 
        // as there were no AI players in the game.
        if (! users.some(data_access.usernameIsAI)) {
            this.determineELORatings(users[0], users[1], gameEndResult);
        }

        for (const usernameInGame of users) {
            const gameData = game.asClientView(usernameInGame);

            // Send the final state of the game to all players before ending the game.
            this.emitEvent(usernameInGame, {
                kind: "move-performed-response",
                payload: gameData,
            });

            // Ends the game for the user..
            this.emitEvent(usernameInGame, {
                kind: "game-ended",
                payload: { result: gameEndResult },
            });

            // Tell the user to play a "game-end" sound.
            this.emitEvent(usernameInGame, {
                kind: "play-sound",
                payload: { sound: "game-end" },
            });
        }

        for (const username of users) {
            // Reset each player's registry.
            this.resetRegistryData(username);

            // Delete any AI users.
            if (data_access.usernameIsAI(username)) {
                data_access.clearLocalUserData(username, this);
            }
        }

        // Make the game no longer active.
        delete this.activeGamesDb[game.meta.gameId];
    }
}
