'use strict';

/**
 * Module for representing BusTime clients.
 *
 * @module BusTime/Client
 */

const { URL, URLSearchParams } = require('url');
const BusTime = require('.');
const Prediction = require('./Prediction');

/**
 * Represents a BusTime API client.
 *
 * @alias module:BusTime/Client
 */
class Client {
    /**
     * Initializes an API client.
     *
     * @param {Object} cfg - Configuration options.
     * @param {Object} cfg.apiKey - BusTime Developer API access key.
     * @param {Object} [cfg.apiURL=BusTime.API_URL] - BusTime API base URL.
     * @param {Object} [cfg.apiFeed] - API data feed to use, or none if not
     * specified. See BusTime developer guide, section 1.7.
     * when making requests.
     */
    constructor(cfg) {
        const {
            apiKey,
            apiURL = BusTime.API_URL,
            apiFeed
        } = cfg;

        Object.defineProperties(this,
            /** @lends module:BusTime/Client.prototype */
            {
                /**
                 * BusTime Developer API access key.
                 *
                 * @readonly
                 * @type {string}
                 */
                apiKey: { value: apiKey },

                /**
                 * BusTime API base URL.
                 *
                 * @readonly
                 * @type {string}
                 */
                apiURL: { value: apiURL },

                /**
                 * API data feed to use, or `null` if none should be used.
                 *
                 * @see BusTime developer guide, section 1.7.
                 *
                 * @readonly
                 * @type {string?}
                 */
                apiFeed: { value: apiFeed || null }
            }
        );
    }

    /**
     * Formats the API URL for the given method, using the specified options as
     * URL query parameters.
     *
     * **NOTE:**
     * - `key` is forced to `this.apiKey`.
     * - `locale` is forced to `'en'`.
     * - `format` is forced to `'json'`.
     * - If specified, `feed` overrides `opts.rtpidatafeed`.
     *
     * @private
     * @param {string} method - The API method.
     * @param {string?} feed - The API feed to use, or `null` for none.
     * @param {Object<string, string>} [opts] - The URL query parameters.
     * @returns {URL} The formatted URL.
     */
    formatURL(method, feed, opts) {
        const params = new URLSearchParams(opts);
        params.set('key', this.apiKey);
        params.set('locale', 'en');
        params.set('format', 'json');
        if (feed) {
            params.set('rtpidatafeed', feed);
        }

        const url = new URL(method, this.apiURL);
        url.search = params;

        return url;
    }

    /**
     * Gets predictions for the specified stop ID(s).
     *
     * @param {string|string[]} stpid - One or more stop ID(s).
     * @param {number} [top=4] - Maximum number of predictions to fetch.
     * @returns {Promise} Resolves with an array of
     * [`Prediction`s]{@link module:BusTime/Prediction}, or rejects with an
     * error.
     */
    async getStopPredictions(stpid, top = 4) {
        if (stpid instanceof Array) {
            stpid = stpid.join(',');
        }

        if (!stpid) {
            throw new Error('No stop IDs specified.');
        }

        const url = this.formatURL('getpredictions', this.apiFeed, {
            stpid, top
        });

        const response = await BusTime.request(url);
        return response.prd.map(prd => new Prediction(prd));
    }
}

module.exports = Client;

