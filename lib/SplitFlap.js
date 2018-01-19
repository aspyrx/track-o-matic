'use strict';

/**
 * Library for driving a stepper motor for a split-flap display.
 *
 * @module SplitFlap
 */

/**
 * Represents a split-flap display.
 *
 * @alias module:SplitFlap
 */
class SplitFlap {
    /**
     * Initializes a split-flap display with the given stepper.
     *
     * @param {module:Stepper} stepper - The display's stepper. Will always be
     * stepped in the positive direction.
     * @param {string[]} flaps - Flap identifiers, in display order. The display
     * should start off showing the 0th flap.
     * @param {number} totalFlaps - Total number of flaps in the display.
     * @param {number} period - Time one full rotation should take.
     */
    constructor(stepper, flaps, totalFlaps, period) {
        if (period <= 0) {
            throw new Error('Period must be positive');
        }

        const flapIndices = {};
        flaps.forEach((flap, i) => {
            flapIndices[flap] = i;
        });
        Object.freeze(flapIndices);

        Object.defineProperties(this,
            /** @lends module:SplitFlap.prototype */
            {
                /**
                 * The display's stepper.
                 *
                 * @readonly
                 * @type {module:Stepper}
                 */
                stepper: { value: stepper },

                /**
                 * Flap identifiers, in display order.
                 *
                 * @readonly
                 * @type {string[]}
                 */
                flaps: { value: flaps },

                /**
                 * Maps flap identifiers to indices.
                 *
                 * @readonly
                 * @type {Object<string, number>}
                 */
                flapIndices: { value: flapIndices },

                /**
                 * Total number of flaps.
                 *
                 * @readonly
                 * @type {number}
                 */
                totalFlaps: { value: totalFlaps },

                /**
                 * Time taken for one full rotation.
                 *
                 * @readonly
                 * @type {number}
                 */
                period: { value: period },

                /**
                 * The current flap's index.
                 *
                 * @private
                 * @type {number}
                 */
                _flapIndex: { value: 0, writable: true }
            }
        );
    }

    /**
     * The currently-displayed flap.
     *
     * @readonly
     * @type {string}
     */
    get currentFlap() {
        return this.flaps[this._flapIndex];
    }

    /**
     * Sets the displayed flap.
     *
     * @param {string} flap - The flap to display.
     * @param {boolean} noStep - `true` to not move the stepper, but calibrates
     * it instead.
     * @returns {Promise} Resolves when the flap is displayed.
     */
    async setFlap(flap, noStep) {
        const { totalFlaps, flapIndices, period, stepper } = this;
        const { totalSteps } = stepper;
        if (!(flap in flapIndices)) {
            throw new Error(`Unknown flap "${flap}"`);
        }
        const endIndex = flapIndices[flap];
        const end = endIndex / totalFlaps * totalSteps;

        if (noStep) {
            this.stepper.calibrate(end);
            this._flapIndex = endIndex;
            return;
        }

        const start = stepper.currentStep;

        const steps = end < start
            ? (totalSteps - start + end)
            : (end - start);

        const duration = steps / totalSteps * period;

        await stepper.step(steps, duration);
        this._flapIndex = endIndex;

        return void null;
    }
}

module.exports = SplitFlap;

