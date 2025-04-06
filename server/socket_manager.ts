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
            socket.on("queue-game", async ({ gameSettings }) => {
                this.gameManager.userWantsQueueNewGame(username, gameSettings);

                const gameQueueClientView = await this.gameManager.genClientGameQueueSlice();
                this.io.to(socket.id).emit("current-game-queue", gameQueueClientView);
            });

            // When the client wants to see the current game queue.
            socket.on("request-current-game-queue", async () => {
                const gameQueueClientView = await this.gameManager.genClientGameQueueSlice();
                this.io.to(socket.id).emit("current-game-queue", gameQueueClientView);
            });

            // When the client wants to join a game with the given ID.
            socket.on("join-game-request", async ({ gameId }) => {
                this.gameManager.userWantsToJoinQueuedGame(username, gameId);
                
                // It might not be necessary to call this 
                // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
                const gameQueueClientView = await this.gameManager.genClientGameQueueSlice();
                this.io.emit("current-game-queue", gameQueueClientView);
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
}
