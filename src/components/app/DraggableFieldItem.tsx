import React, { useState } from 'react';
import type { DragEvent } from 'react';
import { getFieldName } from '../../utils/fieldSystem';
import FieldStyleDropdown from './FieldStyleDropdown';
import LucideIcon from './LucideIcon';
import type { FieldSide, SoftTheme } from '../../types';

/**
 * Per-field inline styling, as carried on a field item and consumed by
 * `FieldStyleDropdown` / the template generator.
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

/**
 * A field as rendered by this item. Front/back items carry `originalIndex`
 * (the field's position in the parent `fields` array); "available" bubbles are
 * virtual and carry `virtualIndex` instead.
 */
interface FieldItem {
  name: string;
  required?: boolean;
  side?: FieldSide | 'available';
  order?: number;
  style?: FieldStyle | null;
  originalIndex?: number;
  virtualIndex?: number;
}

/** Drag-and-drop side identifier used across the field manager. */
type DragSide = 'front' | 'back' | 'available';

interface DraggableFieldItemProps {
  field: FieldItem;
  index: number;
  side: DragSide;
  onToggleRequired: (originalIndex: number) => void;
  onDelete: (originalIndex: number) => void;
  onMove: (originalIndex: number, direction: 'up' | 'down') => void;
  onDragStart: (index: number, side: DragSide) => void;
  onDragOver: (index: number, side: DragSide) => void;
  onDrop: (index: number, side: DragSide) => void;
  onDragEnd: () => void;
  onStyleChange: (originalIndex: number, style: FieldStyle) => void;
  isDragging: boolean;
  theme: SoftTheme;
  readonlyFields?: boolean;
}

/**
 * DraggableFieldItem - Individual field item with drag-and-drop support
 *
 * Features:
 * - Drag handle for reordering
 * - Required/Optional toggle
 * - Delete button
 * - Visual feedback during drag
 */
function DraggableFieldItem({
  field,
  index,
  side,
  onToggleRequired,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onStyleChange,
  isDragging,
  theme,
  readonlyFields = false
}: DraggableFieldItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const fieldName = getFieldName(field);
  const isRequired = field.required !== false;

  // Simple bubble for available side
  if (side === 'available') {
    return (
      <div
        draggable
        onDragStart={(e: DragEvent<HTMLDivElement>) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(index, side);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          background: 'rgba(255, 255, 255, 0.7)',
          border: `1px solid ${isHovered ? theme.primary : theme.cardBorder}`,
          borderRadius: '20px',
          cursor: isDragging ? 'grabbing' : 'grab',
          fontSize: '13px',
          fontWeight: '600',
          color: theme.textPrimary,
          transition: 'all 0.2s',
          boxShadow: isHovered ? `0 4px 12px ${theme.primary}15` : 'none',
          opacity: isDragging ? 0.5 : 1,
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <span>{fieldName}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(field.originalIndex!);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '14px',
            color: '#dc2626',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            opacity: isHovered ? 0.8 : 0.4
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '1'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '0.8'}
        >
          <LucideIcon name="X" size={14} color="#dc2626" />
        </button>
      </div>
    );
  }

  // Full item for front/back sides
  return (
    <div
      draggable
      onDragStart={(e: DragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index, side);
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(index, side);
      }}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        onDrop(index, side);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        background: isDragging ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.8)',
        border: `1px solid ${isDragging ? theme.primary : theme.cardBorder}`,
        borderRadius: '12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'all 0.2s',
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isHovered && !isDragging
          ? `0 4px 12px rgba(0, 0, 0, 0.05)`
          : 'none'
      }}
    >
      {/* Field Name */}
      <div style={{
        flex: 1,
        fontSize: '14px',
        fontWeight: '600',
        color: theme.textPrimary,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {fieldName}
      </div>

      {/* Action Buttons Group */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        opacity: (isHovered || showStyleDropdown) ? 1 : 0.7,
        transition: 'opacity 0.2s'
      }}>
        {/* Up Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove(field.originalIndex!, 'up');
          }}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.6)',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '6px',
            fontSize: '10px',
            cursor: 'pointer',
            color: theme.textSecondary,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'white';
            (e.target as HTMLElement).style.borderColor = theme.primary;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.6)';
            (e.target as HTMLElement).style.borderColor = theme.cardBorder;
          }}
          title="Move up"
        >
          <LucideIcon name="ChevronUp" size={14} color="currentColor" />
        </button>

        {/* Down Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove(field.originalIndex!, 'down');
          }}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.6)',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '6px',
            fontSize: '10px',
            cursor: 'pointer',
            color: theme.textSecondary,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'white';
            (e.target as HTMLElement).style.borderColor = theme.primary;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.6)';
            (e.target as HTMLElement).style.borderColor = theme.cardBorder;
          }}
          title="Move down"
        >
          <LucideIcon name="ChevronDown" size={14} color="currentColor" />
        </button>

        {/* Style Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStyleDropdown(!showStyleDropdown);
            }}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: field.style && Object.keys(field.style).length > 0 ? `${theme.primary}20` : 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${field.style && Object.keys(field.style).length > 0 ? theme.primary : theme.cardBorder}`,
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              color: field.style && Object.keys(field.style).length > 0 ? theme.primary : theme.textSecondary,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = field.style && Object.keys(field.style).length > 0 ? `${theme.primary}30` : 'white';
              (e.target as HTMLElement).style.borderColor = theme.primary;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = field.style && Object.keys(field.style).length > 0 ? `${theme.primary}20` : 'rgba(255, 255, 255, 0.6)';
              (e.target as HTMLElement).style.borderColor = field.style && Object.keys(field.style).length > 0 ? theme.primary : theme.cardBorder;
            }}
            title="Style field"
          >
            <LucideIcon name="Palette" size={14} color="currentColor" />
          </button>

          {/* Style Dropdown */}
          {showStyleDropdown && (
            <FieldStyleDropdown
              field={{ ...field, originalIndex: field.originalIndex! }}
              side={side}
              theme={theme}
              onStyleChange={onStyleChange}
              onClose={() => setShowStyleDropdown(false)}
            />
          )}
        </div>

        {/* Required Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleRequired(field.originalIndex!);
          }}
          title={isRequired ? 'Required' : 'Optional'}
          style={{
            padding: '4px 8px',
            minWidth: '40px',
            height: '28px',
            fontSize: '10px',
            fontWeight: '700',
            background: isRequired ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.6)',
            color: isRequired ? theme.primary : theme.textSecondary,
            border: `1px solid ${isRequired ? `${theme.primary}40` : theme.cardBorder}`,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            userSelect: 'none',
            letterSpacing: '0.2px',
            textTransform: 'uppercase'
          }}
        >
          {isRequired ? 'Req' : 'Opt'}
        </button>

        {/* Delete Button */}
        {!readonlyFields && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(field.originalIndex!);
            }}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.6)',
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: '6px',
              fontSize: '14px',
              color: '#dc2626',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#fef2f2';
              (e.target as HTMLElement).style.borderColor = '#fecaca';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.6)';
              (e.target as HTMLElement).style.borderColor = theme.cardBorder;
            }}
            title="Delete field"
          >
            <LucideIcon name="Trash" size={14} color="#dc2626" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DraggableFieldItem;
