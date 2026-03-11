import { Page, Locator } from 'playwright';
import { Business } from '../types/business';

/**
 * Extracts business details from a Google Maps result card.
 * Selectors are based on current Google Maps DOM structure.
 * They are made as generic as possible using aria-labels and generic classes,
 * but might need updates if layout changes significantly.
 */
export const parseBusinessCard = async (
    page: Page,
    cardLocator: Locator
): Promise<Omit<Business, 'name'> & { name?: string }> => {
    // Extract data within the browser context for speed
    const data = await cardLocator.evaluate((el: HTMLElement) => {
        // Helper to extract text by querying
        const getText = (selector: string): string | null => {
            const node = el.querySelector(selector);
            return node ? (node.textContent || '').trim() : null;
        };

        // Helper to extract attribute
        const getAttr = (selector: string, attr: string): string | null => {
            const node = el.querySelector(selector);
            return node ? node.getAttribute(attr) : null;
        };

        // Google highly obfuscates classes. Aria-labels are generally more stable.
        const nameNode = el.querySelector('.fontHeadlineSmall') || el.querySelector('div[role="heading"]');
        const name = nameNode ? nameNode.textContent?.trim() : undefined;

        // Rating and reviews often share the same container
        let rating: number | null = null;
        let reviews: number | null = null;

        // Look for aria-label starting with a number and containing "stars" and "Reviews"
        const ratingElement = el.querySelector('[aria-label*="stars"]');
        if (ratingElement) {
            const label = ratingElement.getAttribute('aria-label');
            if (label) {
                const ratingMatch = label.match(/([\d.]+)\s+stars?/);
                if (ratingMatch) rating = parseFloat(ratingMatch[1]);

                const reviewMatch = label.replace(/,/g, '').match(/([\d]+)\s+Reviews?/i);
                if (reviewMatch) reviews = parseInt(reviewMatch[1], 10);
            }
        }

        // Attempt to parse out category, address, phone from the text lines below the title.
        // Commonly they are inside divs with generic classes. 
        // We can extract all text blocks and try a heuristic mapping or use specific structure if available.

        // As a heuristic for the list block:
        const textBlocks = Array.from(el.querySelectorAll('.W4Efsd')).map(d => d.textContent?.trim() || '');

        let category: string | null = null;
        let address: string | null = null;
        let phone: string | null = null;

        // Category is often the first specific textual element after rating or in a specific line.
        // Address often follows category in a dot-separated list.
        // Phone often contains digits and '+'.

        // Detailed extraction usually requires clicking the card, but basic data can be found in the preview card text blocks.
        // Detail text blocks
        textBlocks.forEach(block => {
            // Split by middle dot Google uses '·' (U+00B7) or similar separators
            const parts = block.split('·').map(p => p.trim());

            parts.forEach(part => {
                if (/^\+?\d{1,4}[-\s\d]{5,}$/.test(part) && !part.includes('stars')) {
                    phone = part;
                } else if ((part.includes('St') || part.includes('Ave') || part.includes('Rd') || part.includes(',')) && !part.match(/\d+[\.,]?\d*\([^)]+\)/)) {
                    let cleanAddress = part.replace(/Open.*/, '').replace(/Closed.*/, '').replace(/Closes.*/, '').trim();
                    address = address || cleanAddress;
                } else if (!category && rating === null && part.length > 2 && part.length < 40 && !part.match(/[\d]/)) {
                    // If rating not parsed yet, or part is short, might be category
                    if (part !== 'Closed' && part !== 'Open 24 hours' && !part.includes('Open') && !part.includes('Closes')) {
                        category = category || part;
                    }
                }
            });
        });

        // Extracting website. Website buttons usually have specific hrefs or aria-labels.
        const websiteNode = el.querySelector('a[href^="http"]:not([href*="google.com"])');
        const website = websiteNode ? websiteNode.getAttribute('href') : null;

        return {
            name,
            rating,
            reviews,
            website,
            phone,
            address,
            category
        };
    });

    return data;
};
