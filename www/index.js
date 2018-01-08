'use strict';

/**
 * Initializes an event target.
 *
 * @class
 * @classdesc Represents an event target.
 */
function EventTarget() {
    Object.defineProperties(this,
        /** @lends EventTarget.prototype */
        {
            listeners: { value: {}}
        }
    );
}

/**
 * Adds an event listener.
 *
 * @param {string} type - The event to listen for.
 * @param {Function} callback - The listener.
 */
EventTarget.prototype.addEventListener = function(type, callback) {
    if (!(type in this.listeners)) {
        this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
};

/**
 * Removes an event listener.
 *
 * @param {string} type - The event to remove.
 * @param {Function} callback - The listener to remove.
 */
EventTarget.prototype.removeEventListener = function(type, callback) {
    if (!(type in this.listeners)) {
        return;
    }
    var stack = this.listeners[type];
    for (var i = 0, l = stack.length; i < l; i++) {
        if (stack[i] === callback){
            stack.splice(i, 1);
            return;
        }
    }
};

/**
 * Dispatches an event.
 *
 * @param {Event} event - The event to dispatch.
 * @returns {boolean} `false` if the event was cancelled; `true` otherwise.
 */
EventTarget.prototype.dispatchEvent = function(event) {
    if (!(event.type in this.listeners)) {
        return true;
    }
    var stack = this.listeners[event.type];

    for (var i = 0, l = stack.length; i < l; i++) {
        stack[i].call(this, event);
    }
    return !event.defaultPrevented;
};

/**
 * Initializes the motor display.
 *
 * @class
 * @classdesc Represents the motor display.
 *
 * @param {NodeList} elems - The motor elements.
 */
function Motors(elems) {
    var length = elems.length;
    if (length !== 4) {
        throw new Error('Expected 4 elements, got ' + length);
    }

    var angles = new Array(length);

    /** @lends Motors.prototype */
    var props = {
        /**
         * The number of motor elements.
         *
         * @readonly
         * @type {NodeList}
         */
        length: { value: length }
    };

    elems.forEach(function(elem, i) {
        angles[i] = 0;

        props[i] = {
            get: function() { return angles[i]; },

            set: function(value) {
                angles[i] = value;
                elem.style.transform = 'rotate(' + value / 2048 * 360 + 'deg)';
            }
        };
    });

    Object.defineProperties(this, props);
}

/**
 * Initializes the status stream.
 *
 * @class
 * @classdesc Represents a status stream.
 * @extends EventTarget
 *
 * @param {string} url - The URL of the stream.
 */
function StatusStream(url) {
    EventTarget.call(this);

    Object.defineProperties(this,
        /** @lends StatusStream.prototype */
        {
            /**
             * The URL of the stream.
             *
             * @readonly
             * @type {string}
             */
            url: { value: url },

            /**
             * The associated request, or `null` if no request is active.
             *
             * @private
             * @type {XMLHttpRequest?}
             */
            req: { value: null, writable: true },

            /**
             * Restart timer, or `null` if no timer is active.
             *
             * @private
             * @type {number?}
             */
            restartTimer: { value: null, writable: true },

            /**
             * The number of characters consumed so far.
             *
             * @private
             * @type {number}
             */
            consumed: { value: 0, writable: true }
        }
    );

    this.start = this.start.bind(this);
    this.abort = this.abort.bind(this);
    this.reqStateChange = this.reqStateChange.bind(this);
}

StatusStream.prototype = Object.create(EventTarget.prototype);

/**
 * Request state change handler.
 *
 * @private
 * @param {Event} evt - The state change event.
 */
StatusStream.prototype.reqStateChange = function(evt) {
    var req = evt.target;
    if (req.readyState !== req.LOADING) {
        return;
    }

    var body = req.responseText;
    var start = this.consumed;
    while (start < body.length) {
        var end = body.indexOf('\0', start);
        if (end < 0) {
            // Incomplete packet.
            break;
        }

        // Consume packet.
        var packet = body.substring(start, end);
        this.consumed = start = end + 1;

        var dataEvt = new Event('data');
        dataEvt.data = packet;
        this.dispatchEvent(dataEvt);
    }
};

/**
 * Starts a new request, aborting the current one if it exists.
 *
 * @private
 */
StatusStream.prototype.start = function() {
    var req = new XMLHttpRequest();

    var startReq = function() {
        req.open('GET', this.url);
        req.addEventListener('readystatechange', this.reqStateChange);
        req.send();
        this.restartTimer = window.setTimeout(this.start, 1.5 * 60 * 1000);
    }.bind(this);

    if (this.req) {
        // Request in progress; we must wait for it to abort.
        this.req.addEventListener('abort', startReq);
        this.abort();
    } else {
        startReq();
    }

    this.req = req;
};

/**
 * Aborts the currently-active request.
 *
 * @returns {void}
 */
StatusStream.prototype.abort = function() {
    var req = this.req;
    if (!req) {
        return;
    }

    if (this.restartTimer) {
        window.clearTimeout(this.restartTimer);
        this.restartTimer = null;
    }

    this.req = null;
    this.consumed = 0;

    // This must happen last to ensure that anybody waiting for the request to
    // abort sees that no request is in progress.
    req.abort();
};

StatusStream.prototype.constructor = StatusStream;

window.addEventListener('load', function() {
    var motorElems =
        document.querySelectorAll('.motors .motor > *:first-child');
    var motors = new Motors(motorElems);
    void motors;
    var statusStream = new StatusStream('/status');

    statusStream.addEventListener('data', function(evt) {
        var matches = evt.data.match(/^(.+?) (.+)$/);
        if (!matches){
            return;
        }

        motors[matches[1]] = matches[2];
    });
    statusStream.start();
});

