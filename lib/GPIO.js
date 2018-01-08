'use strict';

/**
 * Library for accessing GPIO via the `/sys/class/gpio` interface.
 *
 * Inspired by the [`onoff library`](https://github.com/fivdi/onoff).
 *
 * @module GPIO
 */

const path = require('path');
const fs = require('fs');

/**
 * Maximum number of tries while waiting for sysfs permissions to catch up.
 *
 * @readonly
 * @type {number}
 */
const MAX_PERMS_TRIES = 10000;

/**
 * Represents a GPIO pin.
 *
 * @alias module:GPIO
 */
class GPIO {
    /**
     * Initializes a GPIO pin to have the given direction.
     *
     * @param {number} pin - The pin number.
     * @param {string} direction - The direction. One of `GPIO.DIRECTIONS`.
     */
    constructor(pin, direction) {
        const pinPath = path.join(GPIO.BASE_PATH, pin);

        /**
         * Paths to sysfs files for the GPIO pin.
         *
         * @private
         * @readonly
         * @enum {string}
         * @alias module:GPIO#paths
         */
        const paths = {
            /** Pin direction. */
            direction: path.join(pinPath, 'value'),
            /** Pin value. */
            value: path.join(pinPath, 'value')
        };
        Object.freeze(paths);

        if (!fs.existsSync(pinPath)) {
            // Pin is not exported yet; export it.
            fs.writeFileSync(path.join(GPIO.BASE_PATH, 'export'), pin);

            // Wait for the sysfs permissions to catch up.
            // See https://github.com/raspberrypi/linux/issues/553
            [
                paths.direction,
                paths.value
            ].forEach(f => {
                let tries = 0;
                while (true) {  // eslint-disable-line no-constant-condition
                    try {
                        const fd = fs.openSync(f, 'r+');
                        fs.closeSync(fd);
                        break;
                    } catch (err) {
                        if (tries >= MAX_PERMS_TRIES) {
                            throw err;
                        }
                    }

                    tries++;
                }
            });
        }

        // Set the direction.
        fs.writeFileSync(paths.direction, direction);

        Object.defineProperties(this,
            /** @lends module:GPIO.prototype */
            {
                /**
                 * The pin number.
                 *
                 * @readonly
                 * @type {number}
                 */
                pin: { value: pin },

                /**
                 * The value file descriptor; cached for performance.
                 *
                 * @readonly
                 * @type {number}
                 */
                valueFD: { value: fs.openSync(paths.value, 'r+') },

                /**
                 * Read buffer; pre-allocated for performance.
                 *
                 * Note: the contents of the array are mutable.
                 *
                 * @readonly
                 * @type {Uint8Array}
                 */
                readBuf: { value: new Uint8Array(1) },

                paths: { value: paths }
            }
        );
    }

    /**
     * Closes this GPIO instance, but does not unexport the pin from sysfs.
     *
     * **WARNING**: This instance should not be used after being closed.
     */
    close() {
        fs.closeSync(this.valueFD);
    }

    /**
     * Unexports this pin from sysfs, closing the instance in the process.
     *
     * **WARNING**: This and **any other instances referring to the same pin**
     * should not be used after being unexported. A new instance for the pin
     * must be created to re-export the pin.
     */
    unexport() {
        fs.closeSync(this.valueFD);
        fs.writeFileSync(path.join(GPIO.BASE_PATH, 'unexport'), this.pin);
    }

    /**
     * Writes the given value to the pin.
     *
     * @param {boolean} value - `true` for high; `false` for low.
     */
    writeSync(value) {
        const buf = value ? GPIO.VALUES.HIGH : GPIO.VALUES.LOW;
        fs.writeSync(this.valueFD, buf, 0, buf.length, 0);
    }

    /**
     * Reads the pin's current value.
     *
     * @returns {boolean} `true` if the pin is high; `false` for low.
     */
    readSync() {
        const buf = this.readBuf;
        fs.readSync(this.valueFD, buf, 0, buf.length, 0);
        return buf[0] === GPIO.VALUES.HIGH[0];
    }
}

/**
 * GPIO pin directions.
 *
 * @readonly
 * @enum {string}
 */
GPIO.DIRECTIONS = {
    /** Input */
    IN: 'in',
    /** Output, initial value unspecified */
    OUT: 'out',
    /** Output, initial value low */
    LOW: 'low',
    /** Output, initial value high */
    HIGH: 'high'
};
Object.freeze(GPIO.DIRECTIONS);

/**
 * GPIO sysfs base path.
 *
 * @readonly
 * @enum {string}
 */
GPIO.BASE_PATH = '/sys/class/gpio';


/**
 * GPIO pin values.
 *
 * @readonly
 * @enum {Uint8Array}
 */
GPIO.VALUES = {
    /** Low (0) */
    LOW: new Uint8Array('0'),
    /** High (1) */
    HIGH: new Uint8Array('1')
};
Object.freeze(GPIO.VALUES);

Object.freeze(GPIO);
module.exports = GPIO;

