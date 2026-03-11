/**
 * Resolves after a specific duration in milliseconds.
 */
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resolves after a random duration between min and max milliseconds to simulate human behavior.
 */
export const randomDelay = async (min: number, max: number): Promise<void> => {
    const duration = Math.floor(Math.random() * (max - min + 1) + min);
    await delay(duration);
};
