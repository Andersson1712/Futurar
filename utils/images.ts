/**
 * Shared image utilities
 * Centralizes image mapping for story sceneries
 */

// Scenery image collections
const sceneryImages: Record<string, string[]> = {
    'castillo': [
        'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800&auto=format',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format',
        'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=800&auto=format',
    ],
    'espacio': [
        'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&auto=format',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format',
        'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&auto=format',
    ],
    'selva': [
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format',
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format',
        'https://images.unsplash.com/photo-1552083375-1447ce886485?w=800&auto=format',
    ],
    'mar': [
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format',
        'https://images.unsplash.com/photo-1497290756760-23ac55edf36f?w=800&auto=format',
    ],
    'bosque': [
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format',
        'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&auto=format',
        'https://images.unsplash.com/photo-1476673160081-cf065bc4cf87?w=800&auto=format',
    ],
    'ciudad': [
        'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&auto=format',
        'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format',
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&auto=format',
    ],
};

// Default fallback image
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&auto=format';

/**
 * Finds the matching scenery key from a scenery name
 */
const findSceneryKey = (scenery: string): string | undefined => {
    const normalized = scenery.toLowerCase();
    return Object.keys(sceneryImages).find(key => normalized.includes(key));
};

/**
 * Gets a random image for a scenery
 * @param scenery Scenery name (e.g., "Selva", "Espacio", "Castillo")
 * @returns Image URL
 */
export const getRandomImage = (scenery: string): string => {
    const key = findSceneryKey(scenery);
    if (!key) return DEFAULT_IMAGE;

    const images = sceneryImages[key];
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
};

/**
 * Gets an image for a specific chapter (deterministic based on chapter number)
 * @param scenery Scenery name
 * @param chapterNum Chapter number (0-indexed)
 * @returns Image URL
 */
export const getChapterImage = (scenery: string, chapterNum: number): string => {
    const key = findSceneryKey(scenery);
    const images = sceneryImages[key || 'selva'];
    return images[chapterNum % images.length];
};

/**
 * Gets all images for a scenery
 * @param scenery Scenery name
 * @returns Array of image URLs
 */
export const getSceneryImages = (scenery: string): string[] => {
    const key = findSceneryKey(scenery);
    return key ? sceneryImages[key] : [DEFAULT_IMAGE];
};

export default {
    getRandomImage,
    getChapterImage,
    getSceneryImages,
};
