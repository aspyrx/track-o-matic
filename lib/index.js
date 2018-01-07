#!/usr/bin/env node

'use strict';

/**
 * Library entrypoint.
 *
 * @module track-o-matic
 */

const fs = require('fs');
const BusTimeClient = require('./BusTime/Client');

/**
 * Command-line interface.
 *
 * @param {string[]} argv - Command-line arguments.
 * @returns {Promise} Resolves with an exit code, or rejects with an error.
 */
async function cli(argv) {
    if (argv.length < 3) {
        return -1;
    }

    const cfg = JSON.parse(fs.readFileSync(argv[2]));
    const busTime = new BusTimeClient(cfg);

    const prds = await busTime.getStopPredictions(7117);
    prds.forEach(prd => console.log(prd.toString()));
}

if (module === require.main) {
    cli(process.argv)
        .then(process.exit)
        .catch(err => {
            console.error(err);
            process.exit(-1);   // eslint-disable-line no-process-exit
        });
}

