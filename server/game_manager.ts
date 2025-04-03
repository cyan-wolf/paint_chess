import { Game } from "./game.ts";

import * as data_access from "./data_access.ts";

type ID = string;

type RawGameSettings = {
    secsPerPlayer?: number,
};

type GameSettings = {
    secsPerPlayer: number,
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

export class GameManager {
    queuedGamesDb: GameQueue;
    activeGamesDb: ActiveGames;
    playerRegistry: PlayerRegistry;

    constructor() {
        this.queuedGamesDb = {};
        this.activeGamesDb = {};
        this.playerRegistry = {};
    }

    // Placeholder ID generator.
    genId(): ID {
        return Math.random().toString().substring(2);
    }

    // Make sure that the game settings are valid.
    validateGameSettings(gameSettings?: RawGameSettings): gameSettings is GameSettings {
        if (gameSettings === undefined) {
            return false;
        }
        if (gameSettings.secsPerPlayer === undefined) {
            return false;
        }
        if (typeof(gameSettings.secsPerPlayer) !== 'number') {
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
    usernameIsActive(username: string): boolean {
        return Object.hasOwn(this.playerRegistry, username) && 
            this.playerRegistry[username].active;
    }

    // Determines whether the given username is in the game 
    // with the given ID.
    usernameInGame(username: string, gameId: ID): boolean {
        return this.gameIdIsActive(gameId) && 
            this.activeGamesDb[gameId].hasUser(username);
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

    // Gets a player from the registry.
    getPlayer(username: string): PlayerInfo {
        if (!this.usernameInRegistry(username)) {
            throw new Error(`invalid player ${username}`);
            
        }
        return this.playerRegistry[username];
    }

    // Creates a new queued game.
    createQueuedGame(gameSettings: GameSettings): ID {
        const gameId = this.genId();

        this.queuedGamesDb[gameId] = {
            waitingPlayers: [],
            gameSettings,
        };
        return gameId;
    }

    // Joins a player to the given game.
    tryJoinPlayerToQueuedGame(username: string, gameId: ID) {
        if (!this.gameIdIsQueued(gameId)) {
            return; // ignore attempt if game ID is invalid
        }
        
        if (this.usernameIsQueueingGame(username)) {
            // Ignore queue attempt since the player is already
            // queuing this game.
            if (this.playerRegistry[username].gameId === gameId) {
                return;
            }

            // Dequeue the player if they were already queuing.
            const playerInfo = this.playerRegistry[username];
            const oldQueuedGame = this.queuedGamesDb[playerInfo.gameId!];

            // Remove the player from the old queued game.
            const idx = oldQueuedGame.waitingPlayers.indexOf(username);
            oldQueuedGame.waitingPlayers.splice(idx, 1);

            // Delete the queued game if it no longer has any players.
            if (oldQueuedGame.waitingPlayers.length === 0) {
                delete this.queuedGamesDb[playerInfo.gameId!];
            }
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
    async getUserELO(username: string): Promise<number | undefined> {
        const user = await data_access.fetchUserData(username, false);
        return user?.elo;
    }

    // Determines and sets new ELO ratings after a game.
    async determineELORatings(usernameP1: string, usernameP2: string, gameResult: GameEndResult): Promise<void> {
        const eloP1 = await this.getUserELO(usernameP1);
        const eloP2 = await this.getUserELO(usernameP2);

        if (eloP1 === undefined || eloP2 === undefined) {
            throw new Error("could not compute player ELO");
        }

        const outcomeValue = this.getOutcomeValue(gameResult);
        const k = 10;

        const [newEloP1, newEloP2] = this.calcNewELORatings(eloP1, eloP2, k, outcomeValue);

        // Set the updated user ratings.
        await data_access.setUserELO(usernameP1, newEloP1);
        await data_access.setUserELO(usernameP2, newEloP2);

        console.log(`LOG: P1 (${newEloP1}), P2 (${newEloP2})`);
    }

    // Generate a slice of some of the game queues to send to the client in a nice format.
    async genClientGameQueueSlice(): Promise<QueuedGameClientView[]> {
        // TODO: randomly shuffle these
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

    // Makes the user queue a new game using the given settings.
    userWantsQueueNewGame(username: string, gameSettings: GameSettings) {
        // Game settings must be valid.
        if (!this.validateGameSettings(gameSettings)) {
            return;
        }
        // Prevent a player that's already queuing from queuing more games.
        if (this.usernameIsQueueingGame(username)) {
            return;
        }
        const gameId = this.createQueuedGame(gameSettings);

        // Auto-join the user to the game.
        this.tryJoinPlayerToQueuedGame(username, gameId);

        // Update the game queue for all users.
        // TODO: ...
        //this.emitGameManagerEventToAll({ kind: "current-game-queue", payload: await this.genClientGameQueueSlice() });
    }

    userWantsToStartGame(username: string) {
        if (!this.usernameIsActive(username)) {
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
        else if (game.getUsers().includes(username)) {
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

            for (const usernameInGame of game.getUsers()) {
                const gameData = game.asClientView(usernameInGame);
                this.emitEvent(usernameInGame, { kind: "game-start", payload: gameData });
            }
        }
    }

    userWantsToPerformMove(username: string, move: RawMove) {
        if (!this.usernameIsActive(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        if (typeof move !== "object") {
            return; // do not accept strange input
        }
        move.username = username;

        const couldMove = game.processMove(move);

        if (!couldMove) {
            return;
        }

        // Send the result of the move to the users in the game.
        for (const usernameInGame of game.getUsers()) {
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

    userWantsToPublishMessage(username: string, content: unknown) {
        if (!this.usernameIsActive(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }

        if (typeof content !== 'string') {
            return; // do not accept strange input
        }

        if (content.trim().length === 0) {
            return; // only accept valid messages
        }

        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        game.publishMessage({
            by: username,
            content,
        });

        // Send the chat to the users in the game.
        for (const usernameInGame of game.getUsers()) {
            this.emitEvent(usernameInGame, {
                kind: "current-chat-history",
                payload: {
                    history: game.getMessageHistory(9),
                }
            });
        }
    }

    userWantsChatHistory(username: string) {
        if (!this.usernameIsActive(username)) {
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
        if (!this.usernameIsActive(username)) {
            // Ignore socket if the player is not in a game.
            return; 
        }
        const gameId = this.playerRegistry[username].gameId!;
        const game = this.activeGamesDb[gameId];

        game.finish({
            // The other player wins.
            winner: Game.togglePlayerRole(game.userToRole(username)),
            method: "resign",
        });
    }

    // Turns a queued game into an active game.
    createGame(gameId: ID) {
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

        const game = new Game({
            gameId,
            p1: queuedGame.waitingPlayers[0], 
            p2: queuedGame.waitingPlayers[1], 
            joinedPlayers: 0,
            secsPerPlayer: queuedGame.gameSettings.secsPerPlayer,
            hasStarted: false,
        });
        this.activeGamesDb[gameId] = game;

        game.addOnGameEndEventHandler((result) => {
            console.log(`LOG: game ended: ${JSON.stringify(result)}`);

            const users = game.getUsers();

            // Determine the new ELO of each player.
            this.determineELORatings(users[0], users[1], result);

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
                    payload: { result },
                });

                // Tell the user to play a "game-end" sound.
                this.emitEvent(usernameInGame, {
                    kind: "play-sound",
                    payload: { sound: "game-end" },
                });

                // TODO: add a record of the results of the game to the database
                // ...

                // Reset the player's registry.
                const playerInfo = this.playerRegistry[usernameInGame];
                playerInfo.gameId = undefined;
                playerInfo.active = false;
                playerInfo.joined = false;
                playerInfo.queueing = false;
            }

            // Make the game no longer active.
            delete this.activeGamesDb[gameId];
        });

        // Redirects the user to "/game/:id" on the client.
        for (const usernameInGame of game.getUsers()) {
            this.emitEvent(usernameInGame, {
                kind: "found-game",
                payload: { gameId },
            });
        }
    }
}

