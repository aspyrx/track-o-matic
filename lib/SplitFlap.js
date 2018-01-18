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
                 * @readonly
                 * @type {number}
                 */
                _flapIndex: { value: 0 }
            }
        );
    }

    /**
     * The currently-displayed flap.
     *
     * @readonly
     * @type {string}
     */
    get flap() {
        return this.flaps[this._flapIndex];
    }

    /**
     * Sets the displayed flap.
     *
     * @param {string} flap - The flap to display.
     * @returns {Promise} Resolves when the flap is displayed.
     */
    async setFlap(flap) {
        const { totalFlaps, period, stepper } = this;
        const startIndex = this._flapIndex;
        const endIndex = this.flapIndices[flap];
        if (!endIndex) {
            throw new Error(`Unknown flap "${flap}"`);
        }

        const diff = endIndex < startIndex
            ? (totalFlaps - startIndex + endIndex)
            : (endIndex - startIndex);
        const frac = diff / totalFlaps;

        const { totalSteps } = stepper;
        const steps = frac * totalSteps;
        const duration = frac * period;
        await stepper.step(steps, duration);
    }
}

module.exports = SplitFlap;

