export class TimeDifference {
    constructor() {
        this.start = Date.now();
    }

    logDifference(prefix = "") {
        console.log(prefix, (Date.now() - this.start) + "ms");
        this.start = Date.now();
    }

    /**
     * Get the time difference between now and the start time in milliseconds.
     * @returns {number} The time difference in milliseconds.
     */
    getDifference(reset = false) {
        const difference = Date.now() - this.start;

        if (reset) {
            this.start = Date.now();
        }

        return difference;
    }
}