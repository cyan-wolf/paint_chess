
// Shows the pawn promotion UI and collects user input from said UI.
class PawnPromotionPopupManager {
    constructor(pieceLoader) {
        // Needed to force-load the piece SVGs after building the UI.
        this.pieceLoader = pieceLoader;
    }

    showAndGetPiece(colorInfo) {
        return new Promise((resolve) => {
            const bgPopupOverlay = document.createElement("div");
            bgPopupOverlay.classList.add("promotion-popup-bg-overlay");
    
            const popupElem = document.createElement("div");
            popupElem.classList.add("promotion-popup");
    
            const validPieces = new Set(["queen", "rook", "bishop", "knight"]);
    
            for (const piece of validPieces) {
                const pieceSpan = document.createElement("span");
                pieceSpan.classList.add("piece");
                pieceSpan.classList.add(piece);
                pieceSpan.classList.add(colorInfo.piece);
    
                const pieceOptionElem = document.createElement("div");
                pieceOptionElem.classList.add("promotion-option");

                pieceOptionElem.style.setProperty("--color-light", colorInfo.bgLight);
                pieceOptionElem.style.setProperty("--color-dark", colorInfo.bgDark);
    
                pieceOptionElem.addEventListener("click", () => {
                    document.body.removeChild(popupElem);
                    document.body.removeChild(bgPopupOverlay);
                    resolve(piece);
                })
    
                pieceOptionElem.appendChild(pieceSpan);
                popupElem.appendChild(pieceOptionElem);
            }
    
            document.body.appendChild(bgPopupOverlay);
            document.body.appendChild(popupElem);

            // Force-load SVG pieces.
            this.pieceLoader();
        });
    }
}

