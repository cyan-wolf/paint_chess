
// Client-side board class.
class Board {
    // Initializes the given board after being given 
    // an element to fill in with slots.
    constructor(boardConfig, promotionPopupManager) {
        // Used for showing the pawn promotion UI.
        this.promotionPopupManager = promotionPopupManager;

        const { element, isFlipped, clickable, colorConfig } = boardConfig;

        this.boardElem = element;
        this.boardPositions = {};
        this.colorConfig = colorConfig;

        // Properties for handling user clicks.
        this.clickable = clickable;
        this.lastClickedCoord = null;
        this.onMoveDelegates = [];

        if (!isFlipped) {
            for (let index = 0; index < 8 * 8; index++) {
                this.fillSlot(index);
            }
        }
        else {
            for (let index = 8 * 8 - 1; index >= 0; index--) {
                this.fillSlot(index);
            }
        }
    }

    // Fills in a board slot at the specified index.
    // Fills in the board element and the board positions object.
    fillSlot(index) {
        const slot = document.createElement("div");
        slot.classList.add("slot");

        // Calculate the row and column using the index.
        const row = Math.floor(index / 8);
        const col = index % 8;

        // Create the checkerboard pattern.
        if (posShouldBeLight([row, col])) {
            slot.style.backgroundColor = this.getDefaultLightSlotColor();
        } else {
            slot.style.backgroundColor = this.getDefaultLightSlotColor();
        }

        // Fill in the `boardPositions` object for easy access to the board 
        // using standard chess coordinates.
        const chessCoord = rowColToChessCoord([row, col]);
        this.boardPositions[chessCoord] = slot;

        // Handles click events.
        slot.addEventListener("click", async () => {
            if (!this.clickable) {
                return;
            }

            // Remember the coordinate of the last clicked slot.
            if (this.lastClickedCoord === null) {
                // Check if the slot should be selectable.
                if (!this.slotShouldBeSelectable(chessCoord)) {
                    return;
                }

                this.lastClickedCoord = chessCoord;
                this.selectSlot(chessCoord);
                return;
            }

            // If a coordinate was already clicked, then 
            // call all the `onMove` event handlers with the 
            // moved performed by the player.
            for (const onMove of this.onMoveDelegates) {
                const promotionPiece = await this.detectPawnPromotionMove(this.lastClickedCoord, chessCoord);

                // Construct the move.
                const move = {
                    from: this.lastClickedCoord,
                    to: chessCoord,
                };

                // Add pawn promotion data if necessary.
                if (promotionPiece !== undefined) {
                    move.promotion = promotionPiece;
                }

                // Send the move to the event handlers.
                onMove(move);

                // Reset the last clicked coord.
                this.lastClickedCoord = null;
                this.deselectAllSlots();

                this.removeAllSlotMarks();
                // Show the last changed coords along with check info again after a delay.
                setTimeout(() => {
                    if (this.lastClickedCoord === null) {
                        this.displayLastChangedCoords();
                        this.displayCheckStatus();
                    }
                }, 2000);
            }
        });

        // Span used for rendering pieces.
        const pieceSpan = document.createElement("span");
        slot.appendChild(pieceSpan);

        this.boardElem.appendChild(slot);
    }

    // Clears the board.
    clear() {
        // Deselect slots.
        this.deselectAllSlots();

        // Remove extra marks from slots.
        this.removeAllSlotMarks();

        for (let index = 0; index < 8 * 8; index++) {
            // Calculate the row and column using the index.
            const row = Math.floor(index / 8);
            const col = index % 8;

            const slotElem = this.boardElem.children[index];

            // Reset the checkerboard pattern.
            if (posShouldBeLight([row, col])) {
                slotElem.style.backgroundColor = this.getDefaultLightSlotColor();
            } else {
                slotElem.style.backgroundColor = this.getDefaultDarkSlotColor();
            }

            // Clear piece style.
            const pieceElem = slotElem.children[0];
            pieceElem.classList = "";
            pieceElem.innerHTML = "";
        }
    }

    async detectPawnPromotionMove(fromCoord, toCoord) {
        if (this.ownRole !== this.turn) {
            // No reason to show promotion UI if it's not 
            // the player's turn.
            return;
        }
        const slotData = this.boardDesc[fromCoord];

        if (slotData !== undefined && slotData.piece === "pawn") {
            const fromPos = chessCoordToRowCol(fromCoord);
            const toPos = chessCoordToRowCol(toCoord);

            const prevRank = fromPos[0];
            const reachedRank = toPos[0];
            
            const wasInSecondToLastRank = (this.ownRole === "p1") ? 
                (prevRank === 1) : (prevRank === 6);

            const reachedLastRank = (this.ownRole === "p1") ?  
                (reachedRank === 0) : (reachedRank === 7);

            const pawnLegalMoves = this.legalMovesRundown[this.ownRole][fromCoord];
            const wouldBeALegalMove = pawnLegalMoves.includes(toCoord);

            if (wasInSecondToLastRank && reachedLastRank && wouldBeALegalMove) {
                const piece = await this.showPawnPromotionPopup();
                return piece;
            }
        }
    }

    deselectAllSlots() {
        for (let index = 0; index < 8 * 8; index++) {
            const slotElem = this.boardElem.children[index];
            slotElem.classList.remove("selected");
        }
    }

    selectSlot(chessCoord) {
        this.deselectAllSlots();
        this.boardPositions[chessCoord].classList.add("selected");

        this.removeAllSlotMarks();

        const legalLandings = this.legalMovesRundown[this.ownRole][chessCoord];
        for (const landingCoord of legalLandings) {
            this.boardPositions[landingCoord].classList.add("isLanding");
        }
    }

    removeAllSlotMarks() {
        for (let index = 0; index < 8 * 8; index++) {
            const slotElem = this.boardElem.children[index];
            slotElem.classList.remove("lastChanged");
            slotElem.classList.remove("isLanding");
            slotElem.classList.remove("checkedKing");
        }
    }

    markSlotAsLastChanged(chessCoord) {
        this.boardPositions[chessCoord].classList.add("lastChanged");
    }

    slotShouldBeSelectable(chessCoord) {
        return this.hasPieceAtCoord(chessCoord) && 
            this.boardDesc[chessCoord].player === this.ownRole;
    }

    update(gameData) {
        this.boardDesc = gameData.boardDesc;
        this.updateBoard();

        // Used for preventing the pawn promotion UI from 
        // appearing when it's not the player's turn.
        this.turn = gameData.turn;

        this.ownRole = gameData.ownRole;

        this.lastChangedCoords = gameData.lastChangedCoords;
        this.displayLastChangedCoords();

        this.legalMovesRundown = gameData.legalMovesRundown;

        this.checkStatus = gameData.checkStatus;
        this.displayCheckStatus();
    }   

    // Updates the board using a board description object.
    // * The board positons object maps chess coordinates to actual slots on the board.
    // * The board description object maps chess coordinates to a physical (type/color) 
    //   description of the piece that should be at that position.
    updateBoard() {
        // Clear the board before updating it.
        this.clear();

        for (const coord of Object.keys(this.boardDesc)) {
            const slotElem = this.boardPositions[coord];
            const pieceElem = slotElem.children[0];

            const { piece, player, turf } = this.boardDesc[coord];
            
            const turfColor = slotAtCoordShouldBeLight(coord) ? 
                this.colorConfig[turf]["bgLight"] 
                : 
                this.colorConfig[turf]["bgDark"];

            slotElem.style.backgroundColor = turfColor;

            if (piece !== undefined) {
                const pieceColor = this.colorConfig[player]["piece"];
                pieceElem.classList = `piece ${piece} ${pieceColor}`;
            }
        }
    }

    displayCheckStatus() {
        if (this.checkStatus === null) {
            return;
        }
        const checkedKingSlot = this.boardPositions[this.checkStatus.kingCoord];
        checkedKingSlot.classList.add("checkedKing");
    }

    displayLastChangedCoords() {
        for (const coord of this.lastChangedCoords) {
            this.markSlotAsLastChanged(coord);
        }
    }

    // Connets an event hander that processes a move performed by the 
    // player on the board.
    addOnMoveEventHandler(onMoveDelegate) {
        this.onMoveDelegates.push(onMoveDelegate);
    }

    // Checks whether a coordinate has a piece.
    hasPieceAtCoord(chessCoord) {
        const slotElem = this.boardPositions[chessCoord];
        const slotContents = slotElem.children[0];

        return slotContents.classList.contains("piece");
    }

    getDefaultLightSlotColor() {
        return "white";
    }

    getDefaultDarkSlotColor() {
        return "#787777";
    }

    // Shows the pawn promotion UI.
    // Returns the piece that the player choose.
    showPawnPromotionPopup() {
        const colorInfo = this.colorConfig[this.ownRole];
        return this.promotionPopupManager.showAndGetPiece(colorInfo);
    }
}

// Converts a chess coordinate string into a row/column pair.
function chessCoordToRowCol(chessCoord) {
    const [file, rank] = chessCoord;

    const row = 8 - parseInt(rank);
    const col = file.charCodeAt(0) - "a".charCodeAt(0);

    return [row, col];
}

// Converts a row/column pair into a chess coordinate string.
function rowColToChessCoord(pos) {
    const [row, col] = pos;

    const file = String.fromCharCode(col + "a".charCodeAt(0));
    const rank = 8 - row;

    return `${file}${rank}`;
}

// Returns true if the slot at the given square should be light.
function posShouldBeLight(pos) {
    const [row, col] = pos;
    return row % 2 == 0 && col % 2 == 0 || row % 2 == 1 && col % 2 == 1;
}

// Same as `posShouldBeLight`, but for chess coordinates.
function slotAtCoordShouldBeLight(chessCoord) {
    return posShouldBeLight(chessCoordToRowCol(chessCoord));
}

// Generates a sample initial board description object.
function genInitialChessBoardDesc() {
    const boardDesc = {
        // First player's side.
        "a1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        "b1": {
            piece: "knight",
            player: "p1",
            turf: "p1",
        },
        "c1": {
            piece: "bishop",
            player: "p1",
            turf: "p1",
        },
        "d1": {
            piece: "queen",
            player: "p1",
            turf: "p1",
        },
        "e1": {
            piece: "king",
            player: "p1",
            turf: "p1",
        },
        "f1": {
            piece: "bishop",
            player: "p1",
            turf: "p1",
        },
        "g1": {
            piece: "knight",
            player: "p1",
            turf: "p1",
        },
        "h1": {
            piece: "rook",
            player: "p1",
            turf: "p1",
        },
        // Second player's side.
        "a8": {
            piece: "rook",
            player: "p2",
            turf: "p2",
        },
        "b8": {
            piece: "knight",
            player: "p2",
            turf: "p2",
        },
        "c8": {
            piece: "bishop",
            player: "p2",
            turf: "p2",
        },
        "d8": {
            piece: "queen",
            player: "p2",
            turf: "p2",
        },
        "e8": {
            piece: "king",
            player: "p2",
            turf: "p2",
        },
        "f8": {
            piece: "bishop",
            player: "p2",
            turf: "p2",
        },
        "g8": {
            piece: "knight",
            player: "p2",
            turf: "p2",
        },
        "h8": {
            piece: "rook",
            player: "p2",
            turf: "p2",
        },
    };

    // Add both player's pawns.
    for (let col = 0; col < 8; col++) {
        const player1PawnCoord = rowColToChessCoord([6, col]);
        const player2PawnCoord = rowColToChessCoord([1, col]);

        boardDesc[player1PawnCoord] = {
            piece: "pawn",
            player: "p1",
            turf: "p1",
        };

        boardDesc[player2PawnCoord] = {
            piece: "pawn",
            player: "p2",
            turf: "p2",
        };
    }

    return boardDesc;
}
