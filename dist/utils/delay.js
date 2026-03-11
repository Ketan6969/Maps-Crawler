"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomDelay = exports.delay = void 0;
/**
 * Resolves after a specific duration in milliseconds.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.delay = delay;
/**
 * Resolves after a random duration between min and max milliseconds to simulate human behavior.
 */
const randomDelay = async (min, max) => {
    const duration = Math.floor(Math.random() * (max - min + 1) + min);
    await (0, exports.delay)(duration);
};
exports.randomDelay = randomDelay;
