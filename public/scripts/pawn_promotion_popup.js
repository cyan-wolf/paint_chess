
// Shows the pawn promotion UI and collects user input from said UI.
class PawnPromotionPopupManager {
    constructor(pieceLoader) {
        // Needed to force-load the piece SVGs after building the UI.
        this.pieceLoader = pieceLoader;

        this.currentlyShowing = false;
    }

    showAndGetPiece(colorInfo) {
        return new Promise((resolve) => {
            if (this.currentlyShowing) {
                resolve(null);
                return;
            }
            this.currentlyShowing = true;

            const bgPopupOverlay = document.createElement("div");
            bgPopupOverlay.classList.add("promotion-popup-bg-overlay");
    
            const popupElem = document.createElement("div");
            popupElem.classList.add("promotion-popup");
    
            // Helper function for making the UI disappear.
            const stopShowing = () => {
                this.currentlyShowing = false;
                document.body.removeChild(popupElem);
                document.body.removeChild(bgPopupOverlay);
            };
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
    
                // Resolves the enclosing Promise with the piece associated with this 
                // element.
                pieceOptionElem.addEventListener("click", () => {
                    stopShowing();
                    resolve(piece);
                });
    
                pieceOptionElem.appendChild(pieceSpan);
                popupElem.appendChild(pieceOptionElem);
            }

            // Resolves the enclosing promise with null if 
            // no option was selected (because the background was clicked instead).
            bgPopupOverlay.addEventListener("click", () => {
                stopShowing();
                resolve(null);
            });
    
            document.body.appendChild(bgPopupOverlay);
            document.body.appendChild(popupElem);

            // Force-load SVG pieces.
            this.pieceLoader();
        });
    }
}

