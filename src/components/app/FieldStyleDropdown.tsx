import React, { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';
import type { SoftTheme } from '../../types';

/**
 * Per-field inline styling. Mirrors the `FieldStyle` shape consumed by the
 * template generator in `utils/fieldSystem`; keys are added/removed as the
 * user toggles options in this dropdown.
 */
interface FieldStyle {
  special?: 'button' | 'highlight' | string;
  specialColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textAlign?: string;
}

/** Style property keys this dropdown can set/clear. */
type StyleKey = keyof FieldStyle;

/** The field shape this dropdown receives (carries editor styling + list index). */
interface StyleableField {
  name: string;
  style?: FieldStyle | null;
  /** Index of this field in the parent `fields` array (used by `onStyleChange`). */
  originalIndex: number;
}

/** One selectable font option, also satisfying CustomDropdown's option shape. */
interface FontOption {
  label: string;
  value: string | null;
  fontFamily: string | null;
}

interface FieldStyleDropdownProps {
  field: StyleableField;
  side: string;
  theme: SoftTheme;
  onStyleChange: (originalIndex: number, style: FieldStyle) => void;
  onClose: () => void;
}

/**
 * FieldStyleDropdown - Dropdown for applying styles to individual fields
 *
 * Provides preset styling options, font controls, and custom color pickers.
 */
function FieldStyleDropdown({
  field,
  side,
  theme,
  onStyleChange,
  onClose
}: FieldStyleDropdownProps) {
  // Local state for color pickers - initialized once, not synced back
  const [customColor, setCustomColor] = useState(field?.style?.color || '#1e293b');
  const [customSpecialColor, setCustomSpecialColor] = useState(field?.style?.specialColor || '#3b82f6');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  // Calculate dropdown position to prevent overflow
  useEffect(() => {
    if (!dropdownRef.current) return;

    const dropdown = dropdownRef.current;
    const button = dropdown.offsetParent; // The button container

    if (!button) return;

    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const dropdownWidth = 360; // maxWidth from style

    let positionStyle: CSSProperties = {};

    // For back side, always position to the LEFT of the button (where there's space)
    // to avoid the preview card compartment on the right
    if (side === 'back') {
      // Position dropdown to open to the LEFT of the button
      positionStyle = {
        right: 0,
        left: 'auto',
        transform: `translateX(0px)` // Position so right edge aligns with button right edge
      };

      // Check if dropdown would overflow viewport to the left
      const dropdownLeftEdge = buttonRect.right - dropdownWidth;
      if (dropdownLeftEdge < 16) {
        // Adjust to keep within viewport (at least 16px from left edge)
        const adjustment = 16 - dropdownLeftEdge;
        positionStyle.transform = `translateX(${adjustment}px)`;
      }
    } else {
      // For front side, position from left
      positionStyle = {
        left: 0,
        right: 'auto'
      };

      // Check if dropdown would overflow viewport to the right
      const dropdownLeftEdge = buttonRect.left;
      const wouldOverflow = dropdownLeftEdge + dropdownWidth > viewportWidth - 16;

      if (wouldOverflow) {
        // Shift left to keep within viewport
        const overflow = (dropdownLeftEdge + dropdownWidth) - (viewportWidth - 16);
        positionStyle.transform = `translateX(-${overflow}px)`;
      }
    }

    setDropdownStyle(positionStyle);
  }, [side]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleStyleSelect = (styleType: StyleKey, value: string | null) => {
    // CRITICAL: Ensure we preserve existing styles by using || {} fallback
    const oldStyle = field.style || {};
    const newStyle: FieldStyle = { ...oldStyle };

    // Simple rule: if value is falsy or a "reset" value, remove the property; otherwise set it
    const shouldRemove = !value || value === '' || value === 'normal' || value === 'none';

    if (shouldRemove) {
      delete newStyle[styleType];
    } else {
      newStyle[styleType] = value;
    }

    onStyleChange(field.originalIndex, newStyle);
  };

  const handleColorSelect = (color: string) => {
    setCustomColor(color);
    handleStyleSelect('color', color);
  };

  const handleSpecialColorSelect = (color: string) => {
    setCustomSpecialColor(color);
    handleStyleSelect('specialColor', color);
  };

  const handleFontSizeChange = (increment: number) => {
    const currentStyle = field.style || {};
    const currentSize = parseInt(currentStyle.fontSize || '') || 16;
    const newSize = Math.max(8, Math.min(48, currentSize + increment));
    handleStyleSelect('fontSize', `${newSize}px`);
  };

  const handleFontSelect = (fontFamily: string | null) => {
    handleStyleSelect('fontFamily', fontFamily);
  };

  const clearAllStyles = () => {
    onStyleChange(field.originalIndex, {});
  };

  const saveStyles = () => {
    onClose();
  };

  const currentStyle = field.style || {};

  // Font options with more variety - includes fontFamily for preview
  // Using single quotes in JS and escaping double quotes for CSS
  const fontOptions: FontOption[] = [
    { label: 'Default', value: null, fontFamily: null },
    { label: 'System', value: '-apple-system, BlinkMacSystemFont, sans-serif', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' },
    { label: 'Serif', value: 'Georgia, "Times New Roman", Times, serif', fontFamily: 'Georgia, "Times New Roman", Times, serif' },
    { label: 'Mono', value: 'Monaco, Menlo, monospace', fontFamily: 'Monaco, Menlo, monospace' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif', fontFamily: 'Arial, Helvetica, sans-serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif', fontFamily: 'Verdana, Geneva, sans-serif' },
    { label: 'Trebuchet', value: 'Trebuchet MS, sans-serif', fontFamily: 'Trebuchet MS, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif', fontFamily: 'Georgia, serif' },
    { label: 'Palatino', value: 'Palatino, serif', fontFamily: 'Palatino, serif' },
    { label: 'Times', value: 'Times New Roman, Times, serif', fontFamily: 'Times New Roman, Times, serif' },
    { label: 'Courier', value: 'Courier New, Courier, monospace', fontFamily: 'Courier New, Courier, monospace' },
    { label: 'Comic Sans', value: 'Comic Sans MS, cursive', fontFamily: 'Comic Sans MS, cursive' },
    { label: 'Impact', value: 'Impact, sans-serif', fontFamily: 'Impact, sans-serif' }
  ];

  const themeColors = [
    { name: 'Primary', value: theme.primary },
    { name: 'Secondary', value: theme.textSecondary },
    { name: 'Success', value: '#10b981' },
    { name: 'Warning', value: '#f59e0b' },
    { name: 'Error', value: '#ef4444' }
  ];

  // Base style for dropdown
  const baseStyle: CSSProperties = {
    position: 'absolute',
    top: '100%',
    zIndex: 1000,
    background: 'white',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    minWidth: '320px',
    maxWidth: '360px',
    padding: '12px',
    marginTop: '4px',
    ...dropdownStyle
  };

  return (
    <div
      ref={dropdownRef}
      style={baseStyle}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.cardBorder}`,
        marginBottom: '12px',
        fontSize: '12px',
        fontWeight: '600',
        color: theme.textSecondary,
        textAlign: 'center',
        letterSpacing: '0.5px'
      }}>
        STYLE FIELD: {field.name}
      </div>

      {/* Font Size Controls */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          padding: '0 4px'
        }}>
          Text Size
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleFontSizeChange(-2)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.8)',
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              color: theme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'white';
              (e.target as HTMLElement).style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.8)';
              (e.target as HTMLElement).style.borderColor = theme.cardBorder;
            }}
          >
            <LucideIcon name="Minus" size={14} />
          </button>
          <div style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '600',
            color: theme.textPrimary,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '6px'
          }}>
            {currentStyle.fontSize || '16px'}
          </div>
          <button
            onClick={() => handleFontSizeChange(2)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.8)',
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              color: theme.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'white';
              (e.target as HTMLElement).style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.8)';
              (e.target as HTMLElement).style.borderColor = theme.cardBorder;
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Font Family Selector */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          padding: '0 4px'
        }}>
          Font Family
        </div>
        <CustomDropdown
          value={currentStyle.fontFamily || null}
          options={fontOptions}
          onChange={handleFontSelect}
          placeholder="Default"
          theme={theme}
          fontSize="13px"
          padding="8px 12px"
        />

        {/* Font Preview */}
        {currentStyle.fontFamily && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.5)',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: currentStyle.fontFamily,
            color: theme.textPrimary,
            textAlign: 'center'
          }}>
            The quick brown fox jumps over the lazy dog
          </div>
        )}
      </div>

      {/* Text Alignment */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          padding: '0 4px'
        }}>
          Alignment
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px'
        }}>
          <button
            onClick={() => handleStyleSelect('textAlign', currentStyle.textAlign === 'left' ? null : 'left')}
            style={{
              padding: '8px 6px',
              background: currentStyle.textAlign === 'left' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.textAlign === 'left' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              color: currentStyle.textAlign === 'left' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="AlignLeft" size={14} />
            <span>Left</span>
          </button>
          <button
            onClick={() => handleStyleSelect('textAlign', currentStyle.textAlign === 'center' ? null : 'center')}
            style={{
              padding: '8px 6px',
              background: currentStyle.textAlign === 'center' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.textAlign === 'center' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              color: currentStyle.textAlign === 'center' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="AlignCenter" size={14} />
            <span>Center</span>
          </button>
          <button
            onClick={() => handleStyleSelect('textAlign', currentStyle.textAlign === 'right' ? null : 'right')}
            style={{
              padding: '8px 6px',
              background: currentStyle.textAlign === 'right' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.textAlign === 'right' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              color: currentStyle.textAlign === 'right' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="AlignRight" size={14} />
            <span>Right</span>
          </button>
        </div>
      </div>

      {/* Style Options */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          padding: '0 4px'
        }}>
          Style
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          marginBottom: '12px'
        }}>
          {/* Bold */}
          <button
            onClick={() => handleStyleSelect('fontWeight', currentStyle.fontWeight === 'bold' ? 'normal' : 'bold')}
            style={{
              padding: '8px 6px',
              background: currentStyle.fontWeight === 'bold' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.fontWeight === 'bold' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: currentStyle.fontWeight === 'bold' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="Bold" size={14} />
            <span>Bold</span>
          </button>

          {/* Italic */}
          <button
            onClick={() => handleStyleSelect('fontStyle', currentStyle.fontStyle === 'italic' ? 'normal' : 'italic')}
            style={{
              padding: '8px 6px',
              background: currentStyle.fontStyle === 'italic' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.fontStyle === 'italic' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontStyle: 'italic',
              color: currentStyle.fontStyle === 'italic' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="Italic" size={14} />
            <span>Italic</span>
          </button>

          {/* Underline */}
          <button
            onClick={() => handleStyleSelect('textDecoration', currentStyle.textDecoration === 'underline' ? 'none' : 'underline')}
            style={{
              padding: '8px 6px',
              background: currentStyle.textDecoration === 'underline' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.textDecoration === 'underline' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '13px',
              textDecoration: 'underline',
              color: currentStyle.textDecoration === 'underline' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <LucideIcon name="Underline" size={14} />
            <span>Underline</span>
          </button>
        </div>

        {/* Font Color Box */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.5)',
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: '8px'
          }}>
            Font Color
          </div>

          {/* Theme Colors */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '6px',
            marginBottom: '8px'
          }}>
            {themeColors.map((color) => {
              const isSelected = currentStyle.color === color.value;
              return (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color.value)}
                  title={color.name}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: color.value,
                    border: isSelected ? `2px solid ${theme.primary}` : `1px solid ${theme.cardBorder}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'scale(1)';
                  }}
                />
              );
            })}
          </div>

          {/* Custom Color Picker */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="color"
              value={customColor}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomColor(e.target.value)}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: 'none'
              }}
            />
            <button
              onClick={() => handleColorSelect(customColor)}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: currentStyle.color === customColor ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
                border: `1px solid ${currentStyle.color === customColor ? theme.primary : theme.cardBorder}`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                color: currentStyle.color === customColor ? theme.primary : theme.textPrimary,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Apply Custom
            </button>
          </div>
        </div>
      </div>

      {/* Special Options */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          padding: '0 4px'
        }}>
          Special
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '6px',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => handleStyleSelect('special', currentStyle.special === 'button' ? null : 'button')}
            style={{
              padding: '8px 6px',
              background: currentStyle.special === 'button' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.special === 'button' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              color: currentStyle.special === 'button' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              transition: 'all 0.2s',
              minHeight: '44px'
            }}
          >
            <LucideIcon name="Square" size={14} color={currentStyle.special === 'button' ? theme.primary : theme.textPrimary} />
            <span style={{ lineHeight: '1.2', textAlign: 'center' }}>Button Style</span>
          </button>

          <button
            onClick={() => handleStyleSelect('special', currentStyle.special === 'highlight' ? null : 'highlight')}
            style={{
              padding: '8px 6px',
              background: currentStyle.special === 'highlight' ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${currentStyle.special === 'highlight' ? theme.primary : 'transparent'}`,
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              color: currentStyle.special === 'highlight' ? theme.primary : theme.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              transition: 'all 0.2s',
              minHeight: '44px'
            }}
          >
            <LucideIcon name="Box" size={14} color={currentStyle.special === 'highlight' ? theme.primary : theme.textPrimary} />
            <span style={{ lineHeight: '1.2', textAlign: 'center' }}>Highlight Box</span>
          </button>
        </div>

        {/* Special Color Box (only when special style is selected) */}
        {currentStyle.special && (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.5)',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              color: theme.textSecondary,
              marginBottom: '8px'
            }}>
              Special Color
            </div>

            {/* Theme Colors */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
              marginBottom: '8px'
            }}>
              {themeColors.map((color) => {
                const isSelected = currentStyle.specialColor === color.value;
                return (
                  <button
                    key={color.name}
                    onClick={() => handleSpecialColorSelect(color.value)}
                    title={color.name}
                    style={{
                      width: '32px',
                      height: '32px',
                      background: color.value,
                      border: isSelected ? `2px solid ${theme.primary}` : `1px solid ${theme.cardBorder}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.transform = 'scale(1)';
                    }}
                  />
                );
              })}
            </div>

            {/* Custom Color Picker */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="color"
                value={customSpecialColor}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomSpecialColor(e.target.value)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: 'none'
                }}
              />
              <button
                onClick={() => handleSpecialColorSelect(customSpecialColor)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  background: currentStyle.specialColor === customSpecialColor ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
                  border: `1px solid ${currentStyle.specialColor === customSpecialColor ? theme.primary : theme.cardBorder}`,
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: currentStyle.specialColor === customSpecialColor ? theme.primary : theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Apply Custom
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        borderTop: `1px solid ${theme.cardBorder}`,
        paddingTop: '12px',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={clearAllStyles}
          disabled={!Object.keys(currentStyle).length}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#ef4444',
            cursor: Object.keys(currentStyle).length ? 'pointer' : 'not-allowed',
            opacity: Object.keys(currentStyle).length ? 1 : 0.5,
            transition: 'all 0.2s'
          }}
        >
          Clear
        </button>
        <button
          onClick={saveStyles}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: theme.primary,
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
            (e.target as HTMLElement).style.boxShadow = `0 4px 12px ${theme.primary}40`;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = 'none';
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default FieldStyleDropdown;
