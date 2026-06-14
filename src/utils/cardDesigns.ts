/**
 * Card Design Templates
 * Background styles for card containers at the deck level
 * Each design defines ONLY background/container styles (no content templates)
 */

import type { CSSProperties } from 'react';

/**
 * Preview rendering hints for a card design.
 * Mostly CSS properties plus a `textColor` convenience field used by previews.
 */
export interface CardDesignPreview {
  background?: string
  backgroundColor?: string
  backgroundSize?: string
  textColor?: string
  border?: string
}

/**
 * A card design template.
 *
 * @remarks
 * - `containerStyles` is a React style object applied to the card container.
 * - `preview` holds preview-only rendering hints.
 */
export interface CardDesign {
  id: string
  name: string
  category: string
  preview: CardDesignPreview
  containerStyles: CSSProperties
}

export const cardDesigns: CardDesign[] = [
  // ============================================================================
  // SOFT GRADIENTS
  // ============================================================================
  {
    id: 'soft-gradient-sky-lavender',
    name: 'Sky to Lavender',
    category: 'Soft Gradients',
    preview: {
      background: 'linear-gradient(135deg, #dbeafe 0%, #e0d4fd 100%)',
      textColor: '#1e40af'
    },
    containerStyles: {
      background: 'linear-gradient(135deg, #dbeafe 0%, #e0d4fd 100%)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  },
  {
    id: 'soft-gradient-peach-pink',
    name: 'Peach to Pink',
    category: 'Soft Gradients',
    preview: {
      background: 'linear-gradient(135deg, #fed7aa 0%, #fce7f3 100%)',
      textColor: '#9f1239'
    },
    containerStyles: {
      background: 'linear-gradient(135deg, #fed7aa 0%, #fce7f3 100%)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  },
  {
    id: 'soft-gradient-mint-cyan',
    name: 'Mint to Cyan',
    category: 'Soft Gradients',
    preview: {
      background: 'linear-gradient(135deg, #d4f8e8 0%, #cffafe 100%)',
      textColor: '#065f46'
    },
    containerStyles: {
      background: 'linear-gradient(135deg, #d4f8e8 0%, #cffafe 100%)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  },
  {
    id: 'soft-gradient-rose-blush',
    name: 'Rose Blush',
    category: 'Soft Gradients',
    preview: {
      background: 'linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)',
      textColor: '#831843'
    },
    containerStyles: {
      background: 'linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }
  },

  // ============================================================================
  // GEOMETRIC PATTERNS
  // ============================================================================
  {
    id: 'geometric-dots',
    name: 'Subtle Dots',
    category: 'Geometric Patterns',
    preview: {
      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
      backgroundColor: '#f8fafc',
      textColor: '#1e293b'
    },
    containerStyles: {
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
      border: '1px solid rgba(59, 130, 246, 0.15)'
    }
  },
  {
    id: 'geometric-diagonal',
    name: 'Diagonal Lines',
    category: 'Geometric Patterns',
    preview: {
      background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(168, 85, 247, 0.08) 10px, rgba(168, 85, 247, 0.08) 20px)',
      backgroundColor: '#faf5ff',
      textColor: '#581c87'
    },
    containerStyles: {
      backgroundColor: '#faf5ff',
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(168, 85, 247, 0.08) 10px, rgba(168, 85, 247, 0.08) 20px)',
      border: '1px solid rgba(168, 85, 247, 0.15)'
    }
  },
  {
    id: 'geometric-grid',
    name: 'Grid Overlay',
    category: 'Geometric Patterns',
    preview: {
      background: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)',
      backgroundSize: '25px 25px',
      backgroundColor: '#f0fdfa',
      textColor: '#0f766e'
    },
    containerStyles: {
      backgroundColor: '#f0fdfa',
      backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)',
      backgroundSize: '25px 25px',
      border: '1px solid rgba(34, 211, 238, 0.15)'
    }
  },

  // ============================================================================
  // WATERCOLOR TEXTURES
  // ============================================================================
  {
    id: 'watercolor-soft',
    name: 'Soft Watercolor',
    category: 'Watercolor Textures',
    preview: {
      background: 'radial-gradient(ellipse at top, rgba(251, 146, 60, 0.15), transparent 50%), radial-gradient(ellipse at bottom right, rgba(236, 72, 153, 0.12), transparent 50%), radial-gradient(ellipse at bottom left, rgba(168, 85, 247, 0.1), transparent 50%)',
      backgroundColor: '#fff7ed',
      textColor: '#9a3412'
    },
    containerStyles: {
      backgroundColor: '#fff7ed',
      backgroundImage: 'radial-gradient(ellipse at top, rgba(251, 146, 60, 0.15), transparent 50%), radial-gradient(ellipse at bottom right, rgba(236, 72, 153, 0.12), transparent 50%), radial-gradient(ellipse at bottom left, rgba(168, 85, 247, 0.1), transparent 50%)',
      border: '1px solid rgba(251, 146, 60, 0.2)'
    }
  },
  {
    id: 'watercolor-organic',
    name: 'Organic Shapes',
    category: 'Watercolor Textures',
    preview: {
      background: 'radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.12), transparent 40%), radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.1), transparent 40%), radial-gradient(circle at 50% 50%, rgba(251, 146, 60, 0.08), transparent 50%)',
      backgroundColor: '#fefce8',
      textColor: '#713f12'
    },
    containerStyles: {
      backgroundColor: '#fefce8',
      backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.12), transparent 40%), radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.1), transparent 40%), radial-gradient(circle at 50% 50%, rgba(251, 146, 60, 0.08), transparent 50%)',
      border: '1px solid rgba(251, 146, 60, 0.15)'
    }
  },

  // ============================================================================
  // MINIMALIST SOLID
  // ============================================================================
  {
    id: 'minimalist-clean',
    name: 'Clean Minimal',
    category: 'Minimalist Solid',
    preview: {
      background: '#ffffff',
      textColor: '#1e293b',
      border: '2px solid #e2e8f0'
    },
    containerStyles: {
      background: '#ffffff',
      border: '2px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    }
  },
  {
    id: 'minimalist-soft-blue',
    name: 'Soft Blue',
    category: 'Minimalist Solid',
    preview: {
      background: '#eff6ff',
      textColor: '#1e40af',
      border: '1px solid #bfdbfe'
    },
    containerStyles: {
      background: '#eff6ff',
      border: '1px solid #bfdbfe'
    }
  },
  {
    id: 'minimalist-soft-lavender',
    name: 'Soft Lavender',
    category: 'Minimalist Solid',
    preview: {
      background: '#f5f3ff',
      textColor: '#5b21b6',
      border: '1px solid #ddd6fe'
    },
    containerStyles: {
      background: '#f5f3ff',
      border: '1px solid #ddd6fe'
    }
  },
  {
    id: 'minimalist-soft-mint',
    name: 'Soft Mint',
    category: 'Minimalist Solid',
    preview: {
      background: '#f0fdf4',
      textColor: '#166534',
      border: '1px solid #bbf7d0'
    },
    containerStyles: {
      background: '#f0fdf4',
      border: '1px solid #bbf7d0'
    }
  },

  // ============================================================================
  // PAPER TEXTURE
  // ============================================================================
  {
    id: 'paper-texture',
    name: 'Paper Texture',
    category: 'Paper Texture',
    preview: {
      background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.03) 0px, transparent 1px, transparent 2px, rgba(0, 0, 0, 0.03) 3px)',
      backgroundColor: '#fefce8',
      textColor: '#713f12'
    },
    containerStyles: {
      backgroundColor: '#fefce8',
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.03) 0px, transparent 1px, transparent 2px, rgba(0, 0, 0, 0.03) 3px), radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.02) 1px, transparent 0)',
      backgroundSize: '100% 4px, 20px 20px',
      border: '1px solid rgba(251, 191, 36, 0.2)',
      boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
    }
  },

  // ============================================================================
  // MARBLE/STONE
  // ============================================================================
  {
    id: 'marble-subtle',
    name: 'Subtle Marble',
    category: 'Marble/Stone',
    preview: {
      background: 'radial-gradient(ellipse at top left, rgba(255, 255, 255, 0.4), transparent 50%), radial-gradient(ellipse at bottom right, rgba(168, 85, 247, 0.08), transparent 50%), linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
      textColor: '#581c87'
    },
    containerStyles: {
      background: 'radial-gradient(ellipse at top left, rgba(255, 255, 255, 0.4), transparent 50%), radial-gradient(ellipse at bottom right, rgba(168, 85, 247, 0.08), transparent 50%), linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
      border: '1px solid rgba(168, 85, 247, 0.15)'
    }
  },

  // ============================================================================
  // ABSTRACT WAVES
  // ============================================================================
  {
    id: 'abstract-waves',
    name: 'Flowing Waves',
    category: 'Abstract Waves',
    preview: {
      background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59, 130, 246, 0.1), transparent), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(168, 85, 247, 0.08), transparent)',
      backgroundColor: '#eff6ff',
      textColor: '#1e40af'
    },
    containerStyles: {
      backgroundColor: '#eff6ff',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59, 130, 246, 0.1), transparent), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(168, 85, 247, 0.08), transparent)',
      border: '1px solid rgba(59, 130, 246, 0.15)'
    }
  },
  {
    id: 'abstract-waves-vertical',
    name: 'Vertical Waves',
    category: 'Abstract Waves',
    preview: {
      background: 'radial-gradient(ellipse 50% 80% at 0% 50%, rgba(34, 211, 238, 0.12), transparent), radial-gradient(ellipse 50% 80% at 100% 50%, rgba(251, 146, 60, 0.1), transparent)',
      backgroundColor: '#f0fdfa',
      textColor: '#0f766e'
    },
    containerStyles: {
      backgroundColor: '#f0fdfa',
      backgroundImage: 'radial-gradient(ellipse 50% 80% at 0% 50%, rgba(34, 211, 238, 0.12), transparent), radial-gradient(ellipse 50% 80% at 100% 50%, rgba(251, 146, 60, 0.1), transparent)',
      border: '1px solid rgba(34, 211, 238, 0.15)'
    }
  },

  // ============================================================================
  // GRADIENT MESH
  // ============================================================================
  {
    id: 'gradient-mesh-multi',
    name: 'Multi-Color Mesh',
    category: 'Gradient Mesh',
    preview: {
      background: 'radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.15), transparent 50%), radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.12), transparent 50%), radial-gradient(circle at 100% 100%, rgba(251, 146, 60, 0.1), transparent 50%), radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.12), transparent 50%)',
      backgroundColor: '#f8fafc',
      textColor: '#1e293b'
    },
    containerStyles: {
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.15), transparent 50%), radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.12), transparent 50%), radial-gradient(circle at 100% 100%, rgba(251, 146, 60, 0.1), transparent 50%), radial-gradient(circle at 0% 100%, rgba(34, 211, 238, 0.12), transparent 50%)',
      border: '1px solid rgba(59, 130, 246, 0.15)'
    }
  }
];

/**
 * Get design by ID
 * @param designId - Design ID
 * @returns Design object or null
 */
export function getDesignById(designId: string): CardDesign | null {
  return cardDesigns.find(design => design.id === designId) || null;
}

/**
 * Get container styles for a design
 * @param designId - Design ID
 * @returns React style object for card container
 */
export function getDesignContainerStyles(designId: string | null | undefined): CSSProperties {
  if (!designId) return {};

  const design = getDesignById(designId);
  return design?.containerStyles || {};
}

/**
 * Get all categories
 * @returns Array of unique category names
 */
export function getDesignCategories(): string[] {
  return [...new Set(cardDesigns.map(design => design.category))];
}
