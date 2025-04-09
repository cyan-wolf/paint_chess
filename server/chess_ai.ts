import { GameManager } from "./game_manager.ts";
import { GameViewForClient } from "./types/game_types.d.ts";

export class ChessAIUser {
    username: string
    gameId: string
    gameManager: GameManager

    ownRole?: PlayerRole
    gameIsOver: boolean = false;

    /**
     * Creates an AI with the given username, with the intent to join the game with the 
     * given ID, with a reference to the game manager.
     */
    constructor(username: string, gameId: string, gameManager: GameManager) {
        [this.username, this.gameId, this.gameManager] = [username, gameId, gameManager];
    }

    /**
     * Registers the AI in the game manager's registry.
     */
    register() {
        this.gameManager.saveUsernameToRegistry(this.username, (event) => {
            // Handle events from the game manager.
            switch (event.kind) {
                case "found-game": {
                    this.gameManager.userWantsToStartGame(this.username);
                    break;
                }
                case "game-start": {
                    const gameData = event.payload;
                    this.ownRole = gameData.ownRole;

                    this.gameManager.userWantsToPublishMessage(this.username, "Hello, this is Paint Chess AI!");

                    this.trySendNextMove(gameData);
                    break;
                }
                case "move-performed-response": {
                    if (this.gameIsOver) {
                        return;
                    }
                    const gameData = event.payload;

                    if (gameData.turn !== this.ownRole) {
                        this.tryGenerateRandomChatResponse();
                    }

                    this.trySendNextMove(gameData);
                    break;
                }
                case "play-sound":
                    break;
                case "current-chat-history":
                    break;
                case "game-ended": {
                    this.gameIsOver = true;
                    break;
                }
                case "current-game-queue":
                    break;
            }
        });

        // Try to join the game.
        this.gameManager.userWantsToJoinQueuedGame(this.username, this.gameId);
    }

    /**
     * Use "heuristics" to determine the next move. 
     */
    async getNextMove(_currBoardDesc: BoardDescription, legalMovesRundown: LegalMovesRundown): Promise<Move> {
        await sleep(1000 * Math.random() * 10);

        const legalMoves = legalMovesRundown[this.ownRole!];
        const chosenPieceCoord = choose(Object.keys(legalMoves));

        const landingCoords = legalMoves[chosenPieceCoord];
        const chosenLandingCoord = choose(landingCoords);

        const move: Move = { from: chosenPieceCoord, to: chosenLandingCoord, player: this.ownRole! };
        return move;
    }

    /**
     * Try to send a move to the game manager.
     */
    async trySendNextMove(gameData: GameViewForClient) {
        if (gameData.turn === this.ownRole) {
            const move = await this.getNextMove(gameData.boardDesc, gameData.legalMovesRundown);
            this.gameManager.userWantsToPerformMove(this.username, move);
        }
    }

    /**
     * Try to generate and send a random chat response.
     */
    tryGenerateRandomChatResponse() {
        const respondChance = 0.05;
        if (Math.random() > respondChance) {
            return;
        }

        const chatResponses = [
            "That was a blunder.",
            "Decent move.",
            "Wow.",
            "You should not have done that.",
            "Blunder.",
            "Pretty good move.",
        ];

        const chosenResponse = choose(chatResponses);
        this.gameManager.userWantsToPublishMessage(this.username, chosenResponse);
    }
}

function choose<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function sleep(milisecs: number) {
    return new Promise(resolve => setTimeout(resolve, milisecs));
}