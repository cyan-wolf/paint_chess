import { GameManager } from "./game_manager.ts";

export class ChessAIUser {
    username: string
    gameId: string
    gameManager: GameManager

    ownRole?: PlayerRole

    constructor(username: string, gameId: string, gameManager: GameManager) {
        [this.username, this.gameId, this.gameManager] = [username, gameId, gameManager];
    }

    register() {
        this.gameManager.saveUsernameToRegistry(this.username, (event) => {
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
                case "game-ended":
                    break;
                case "current-game-queue":
                    break;
            }
        });

        this.gameManager.tryJoinPlayerToQueuedGame(this.username, this.gameId);
    }

    async getNextMove(_currBoardDesc: BoardDescription, legalMovesRundown?: LegalMovesRundown): Promise<Move> {
        await sleep(1000 * Math.random() * 10);

        // Currently the game returns `undefined` for `legalMovesRundown` for the first 
        // move. Perform a placeholder move at the start.
        if (legalMovesRundown === undefined) {
            return { from: 'e2', to: 'e4', player: this.ownRole! };
        }
        const legalMoves = legalMovesRundown[this.ownRole!];
        const chosenPieceCoord = choose(Object.keys(legalMoves));

        const landingCoords = legalMoves[chosenPieceCoord];
        const chosenLandingCoord = choose(landingCoords);

        const move: Move = { from: chosenPieceCoord, to: chosenLandingCoord , player: this.ownRole! };
        return move;
    }

    async trySendNextMove(gameData: GameViewForClient) {
        if (gameData.turn === this.ownRole) {
            const move = await this.getNextMove(gameData.boardDesc, gameData.legalMovesRundown);
            this.gameManager.userWantsToPerformMove(this.username, move);
        }
    }

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