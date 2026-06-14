/**
 * Categories mapping - English (for storage) to French (for display)
 */

export const CATEGORIES_EN = [
    'Painting',
    'Drawing',
    'Sculpture',
    'Photography',
    'Print',
    'Design',
    'Furniture',
    'Jewelry',
    'Textile',
    'Ceramics',
    'Glass',
    'Digital Art',
    'Mixed Media',
    'Installation',
    'Video',
    'Other'
] as const;

export type CategoryKey = typeof CATEGORIES_EN[number];

export const CATEGORIES_FR: Record<CategoryKey, string> = {
    'Painting': 'Peinture',
    'Drawing': 'Dessin',
    'Sculpture': 'Sculpture',
    'Photography': 'Photographie',
    'Print': 'Estampe',
    'Design': 'Design',
    'Furniture': 'Mobilier',
    'Jewelry': 'Bijouterie',
    'Textile': 'Textile',
    'Ceramics': 'Céramique',
    'Glass': 'Verre',
    'Digital Art': 'Art numérique',
    'Mixed Media': 'Technique mixte',
    'Installation': 'Installation',
    'Video': 'Vidéo',
    'Other': 'Autre'
};

/**
 * Get French label for a category
 */
export function getCategoryLabel(categoryEn: string): string {
    return CATEGORIES_FR[categoryEn as CategoryKey] || categoryEn;
}

/**
 * Get English key from French label
 */
export function getCategoryKey(categoryFr: string): string {
    const entry = Object.entries(CATEGORIES_FR).find(([_, fr]) => fr === categoryFr);
    return entry ? entry[0] : categoryFr;
}
