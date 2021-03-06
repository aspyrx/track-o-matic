'use strict';

/**
 * Library for interacting with the BusTime API.
 *
 * @module BusTime
 */

const http = require('http');

/**
 * The BusTime interface.
 *
 * @alias module:BusTime
 */
class BusTime {
    /**
     * Requests the given URL and parses the JSON response according to the
     * BusTime API.
     *
     * @param {URL} url - The URL to request.
     * @returns {Promise} Resolves with an `Object` representing the parsed
     * response, or rejects with an error.
     */
    static async request(url) {
        const data = await new Promise((resolve, reject) => {
            http.get(url, res => {
                const { statusCode, headers } = res;
                const contentType = headers['content-type'];

                let err;
                if (statusCode !== 200) {
                    err = new Error(`Bad response status: ${statusCode}`);
                } else if (!/^application\/json/.test(contentType)) {
                    err = new Error(`Bad Content-Type: ${contentType}`);
                }

                if (err) {
                    res.resume();   // avoid memory leaks
                    reject(err);
                }

                res.setEncoding('utf-8');
                let body = '';
                res.on('data', chunk => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        const response = data['bustime-response'];
        if (!response) {
            throw new Error(`Malformed response data: ${data}`);
        }

        const { error } = response;
        if (error) {
            throw new Error(`Response contains error: ${error}`);
        }

        return response;
    }

    /**
     * Parses a timestamp generated by the BusTime API.
     *
     * @param {string} ts - The timestamp generated by the API.
     * @throws {Error} The timestamp must be of the form `YYYYMMDD HH:MM` or
     * `YYYYMMDD HH:MM:SS`.
     * @returns {Date} A `Date` representing the timestamp.
     */
    static parseTimestamp(ts) {
        const matches =
            // `YYYYMMDD HH:MM`, followed by optional `:SS`
            ts.match(/^(\d{4})(\d{2})(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);

        if (!matches) {
            throw new Error(`Malformed timestamp: ${ts}`);
        }

        return new Date(
            matches[1],
            matches[2],
            matches[3],
            matches[4],
            matches[5],
            matches[6],
            matches[7] || 0,
            0
        );
    }
}

/**
 * Default API base URL.
 *
 * @readonly
 * @type {string}
 */
BusTime.API_URL = 'http://truetime.portauthority.org/bustime/api/v3/';

Object.freeze(BusTime);
module.exports = BusTime;

