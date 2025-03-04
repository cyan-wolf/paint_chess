
class TimeDisplay {
    constructor(ownTimeElem, opponentTimeElem, timeDesc) {
        this.ownTimeElem = ownTimeElem;
        this.opponentTimeElem = opponentTimeElem;

        this.synchronize(timeDesc);

        // Ticks down the timer (if needed) on the client, 
        // to avoid having to ping the server constantly for the 
        // current game time.
        this.intervelCancelID = setInterval(() => {
            for (const perspective of Object.keys(this.localTimeDesc)) {
                const localTimeDesc = this.localTimeDesc[perspective];

                if (localTimeDesc.isTicking) {
                    localTimeDesc.secsLeft = Math.max(localTimeDesc.secsLeft - 1, 0);
                }
            }

            this.updateDisplay();
        }, 1000);
    }

    // Synchronizes the local time display with the server's time.
    synchronize(timeDesc) {
        this.localTimeDesc = structuredClone(timeDesc);
        this.updateDisplay();
    }

    // Updates the game display with the local time.
    updateDisplay() {
        this.ownTimeElem.innerHTML = formatSecs(
            this.localTimeDesc["own"].secsLeft,
        );
        this.opponentTimeElem.innerHTML = formatSecs(
            this.localTimeDesc["opponent"].secsLeft,
        );
    }

    // Force the client-side display to stop ticking.
    stop() {
        for (const perspective of Object.keys(this.localTimeDesc)) {
            this.localTimeDesc[perspective].isTicking = false;
        }
        clearInterval(this.intervelCancelID);
    }
}

function padZeroes(num, desiredLength) {
    const numStr = num.toString();

    if (numStr.length >= desiredLength) {
        return numStr;
    } 
    else {
        const zeroes = '0'.repeat(desiredLength - numStr.length);
        return `${zeroes}${numStr}`;
    }
}

function formatSecs(secAmt) {
    const minutesPerSec = 60;

    const mins = Math.floor(secAmt / minutesPerSec);
    const secs = Math.floor(secAmt % minutesPerSec);

    return `${padZeroes(mins, 2)}:${padZeroes(secs, 2)}`;
}
