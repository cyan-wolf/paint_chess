import { Server } from "npm:socket.io@4.8.1";
import { GameManager } from "./game_manager.ts";

// Intermediary class between client-server socket 
// connections and `GameManager` logic.
export class SocketManager {
    io: Server
    gameManager: GameManager

    constructor(io: Server, gameManager: GameManager) {
        [this.io, this.gameManager] = [io, gameManager];
    }

    // Used for wiring up sockets so that clients can send 
    // messages to the `GameManager`.
    wireSockets() {
        this.io.on("connection", (socket) => {
            const session = socket.request.session;

            if (!session.user) {
                return; // ignore events from this socket
            }

            const username = session.user.username;
            // For sending events using only the username.
            socket.join(`user-${username}`);

            this.gameManager.saveUsernameToRegistry(username, (event) => {
                // Sends the events back to the client.
                this.io.to(`user-${username}`).emit(event.kind, event.payload);
            });
            
            // When the client wants to queue a new game.
            socket.on("queue-game", ({ gameSettings }) => {
                const gameId = this.gameManager.userWantsQueueNewGame(username, gameSettings);

                // This is for sending the game ID to the `/find-game` page.
                if (gameId !== null) {
                    this.io.to(socket.id).emit("game-queue-success-response", { gameId });
                }
                this.sendUpdatedGameQeueueToAllSockets();
            });

            // This is for sending the game ID to the `/find-game` page.
            socket.on("request-own-game-queue-status", () => {
                if (this.gameManager.usernameIsQueueingGame(username)) {
                    const gameId = this.gameManager.playerRegistry[username].gameId!;
                    this.io.to(socket.id).emit("game-queue-success-response", { gameId });
                }
            });

            // When the client wants to see the current game queue.
            socket.on("request-current-game-queue", async () => {
                const gameQueueClientView = await this.gameManager.genClientGameQueueSlice();
                this.io.to(socket.id).emit("current-game-queue", gameQueueClientView);
            });

            // When the client wants to join a game with the given ID.
            socket.on("join-game-request", ({ gameId }) => {
                this.gameManager.userWantsToJoinQueuedGame(username, gameId);
                
                this.sendUpdatedGameQeueueToAllSockets();
            });

            socket.on("ready-to-start-game", () => {
                this.gameManager.userWantsToStartGame(username);
            });

            socket.on("perform-move", (move) => {
                this.gameManager.userWantsToPerformMove(username, move);
            });

            socket.on("chat-publish", ({ content }) => {
                this.gameManager.userWantsToPublishMessage(username, content);
            });

            socket.on("request-current-chat-history", () => {
                this.gameManager.userWantsChatHistory(username);
            });

            socket.on("resign", () => {
                this.gameManager.userWantsToResign(username);
            });
        });
    }

    // Send the updated game queue to all sockets.
    async sendUpdatedGameQeueueToAllSockets() {
        const gameQueueClientView = await this.gameManager.genClientGameQueueSlice();
        this.io.emit("current-game-queue", gameQueueClientView);
    }
}
