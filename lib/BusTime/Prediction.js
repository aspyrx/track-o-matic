'use strict';

/**
 * Module for representing BusTime predictions.
 *
 * @module BusTime/Prediction
 */

const BusTime = require('.');

/**
 * Represents a prediction returned from the BusTime API.
 *
 * @alias module:BusTime/Prediction
 */
class Prediction {
    /**
     * Initializes the prediction with data returned from the BusTime API.
     *
     * @param {Object} prd - The prediction data.
     */
    constructor(prd) {
        const {
            tmstmp, typ, stpid, stpnm, vid, dstp, rt, rtdd, rtdir, des, prdtm,
            dly, dyn, tablockid, tatripid, prdctdn, zone, nbus
        } = prd;

        Object.defineProperties(this,
            /** @lends module:BusTime/Prediction.prototype */
            {
                /**
                 * Timestamp of prediction generation.
                 *
                 * @readonly
                 * @type {Date}
                 */
                tmstmp: { value: BusTime.parseTimestamp(tmstmp) },

                /**
                 * Type of prediction. One of:
                 * - `A`: Arrival; prediction when vehicle will arrive at stop.
                 * - `D`: Departure; prediction when vehicle will depart stop.
                 *
                 * @readonly
                 * @type {string}
                 */
                typ: { value: typ },

                /**
                 * Stop ID for which this prediction was generated.
                 *
                 * @readonly
                 * @type {string}
                 */
                stpid: { value: stpid },

                /**
                 * Display name for the stop.
                 *
                 * @readonly
                 * @type {string}
                 */
                stpnm: { value: stpnm },

                /**
                 * Vehicle ID for which this prediction was generated.
                 *
                 * @readonly
                 * @type {string}
                 */
                vid: { value: vid },

                /**
                 * Linear distance in feet between vehicle and stop.
                 *
                 * @readonly
                 * @type {number}
                 */
                dstp: { value: dstp },

                /**
                 * Alphanumeric designator of the vehicle's route.
                 *
                 * @readonly
                 * @type {string}
                 */
                rt: { value: rt },

                /**
                 * Language-specific route designator.
                 *
                 * @readonly
                 * @type {string}
                 */
                rtdd: { value: rtdd },

                /**
                 * Vehicle's direction of travel on route.
                 *
                 * @readonly
                 * @type {string}
                 */
                rtdir: { value: rtdir },

                /**
                 * Name of vehicle's final destination.
                 *
                 * @readonly
                 * @type {string}
                 */
                des: { value: des },

                /**
                 * Predicted time of vehicle's arrival at stop.
                 *
                 * @readonly
                 * @type {Date}
                 */
                prdtm: { value: BusTime.parseTimestamp(prdtm) },

                /**
                 * `true` if the vehicle is delayed; `false` otherwise.
                 *
                 * @readonly
                 * @type {boolean}
                 */
                dly: { value: dly },

                /**
                 * The "dynamic action type" affecting this prediction. One of:
                 * - 0: No change.
                 * - 1: Canceled. The vehicle will not stop for this prediction.
                 * - 3: Shifted. The scheduled arrival time has changed.
                 * - 4: Expressed. The vehicle will only stop here at a rider's
                 *   request (drop-off only, no pickup).
                 *
                 * @readonly
                 * @type {number}
                 */
                dyn: { value: dyn },

                /**
                 * Transit authority internal block identifier for the scheduled
                 * work being performed by the vehicle.
                 *
                 * @readonly
                 * @type {string}
                 */
                tablockid: { value: tablockid },

                /**
                 * Transit authority internal trip identifier for the vehicle.
                 *
                 * @readonly
                 * @type {string}
                 */
                tatripid: { value: tatripid },

                /**
                 * Time left in minutes before vehicle arrives at stop.
                 *
                 * @readonly
                 * @type {number}
                 */
                prdctdn: {
                    value: prdctdn === 'DUE' ? 0 : Number.parseInt(prdctdn, 10)
                },

                /**
                 * The vehicle's zone, or `null` if not specified.
                 *
                 * @readonly
                 * @type {string?}
                 */
                zone: { value: zone || null },

                /**
                 * If this vehicle is the last one before a service gap,
                 * represents the time left in minutes until the next vehicle's
                 * scheduled arrival; otherwise, `null`.
                 *
                 * @readonly
                 * @type {number?}
                 */
                nbus: { value: nbus || null }
            }
        );
    }

    /**
     * Converts the prediction into a human-readable string representation.
     *
     * @returns {string} A string representing the prediction.
     */
    toString() {
        const {
            rtdd, vid, rtdir, des, stpid, stpnm, prdctdn, dstp
        } = this;

        const dstr = (dstp / 5280).toFixed(1);

        return `${rtdd} (#${vid}) - ${rtdir}, ${des}: `
            + `${stpnm} (#${stpid}) - ${prdctdn}min (${dstr}mi)`;
    }
}

Object.freeze(Prediction);
module.exports = Prediction;

