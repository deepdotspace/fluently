import React, { useState, useMemo } from 'react';
import DraggableFieldItem from './DraggableFieldItem';
import { getFieldName } from '../../utils/fieldSystem';
import LucideIcon from './LucideIcon';

/**
 * FieldManager - Manages field creation and organization
 * 
 * Features:
 * - Add new fields
 * - Drag-and-drop reordering within Front/Back columns
 * - Toggle fields between Front/Back/Both
 * - Visual organization with clear columns
 */
function FieldManager({
  fields,
  onFieldsChange,
  theme,
  readonlyFields = false,
  onStyleChange
}) {
  const [newFieldName, setNewFieldName] = useState('');
  const [errors, setErrors] = useState('');
  const [dragState, setDragState] = useState({
    draggedIndex: null,
    draggedSide: null,
    draggedName: null, // Track name for available fields
    targetIndex: null,
    targetSide: null
  });

  // Separate fields by side and sort by order
  const frontFields = useMemo(() => {
    return fields
      .map((f, idx) => ({ ...f, originalIndex: idx }))
      .filter(f => f.side === 'front' || f.side === 'both')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [fields]);

  const backFields = useMemo(() => {
    return fields
      .map((f, idx) => ({ ...f, originalIndex: idx }))
      .filter(f => f.side === 'back' || f.side === 'both')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [fields]);

  // Available fields: All unique field names + default fields
  // They are virtual items that create copies when dragged
  const availableFields = useMemo(() => {
    const names = new Set(['Front', 'Back']); // Always start with defaults
    
    // Add all existing field names
    fields.forEach(f => {
      names.add(getFieldName(f));
    });

    return Array.from(names)
      .sort()
      .map((name, idx) => ({
        name,
        side: 'available',
        required: false,
        // Virtual index for list mapping
        virtualIndex: idx
      }));
  }, [fields]);

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      setErrors('Field name cannot be empty');
      setTimeout(() => setErrors(''), 3000);
      return;
    }

    const fieldName = newFieldName.trim();
    
    // Check if a field with this name already exists
    const existingField = fields.find(f => {
      const existingName = getFieldName(f);
      return existingName.toLowerCase() === fieldName.toLowerCase();
    });
    
    if (existingField) {
      setErrors(`A field named "${fieldName}" already exists`);
      setTimeout(() => setErrors(''), 3000);
      return;
    }
    
    const newField = {
      name: fieldName,
      side: 'available', // Stored as available until placed
      order: fields.length,
      required: false
    };

    onFieldsChange([...fields, newField]);
    setNewFieldName('');
  };

  const handleToggleRequired = (originalIndex) => {
    const updated = [...fields];
    updated[originalIndex].required = !updated[originalIndex].required;
    onFieldsChange(updated);
  };

  const handleDeleteField = (originalIndex) => {
    if (fields.length <= 1) {
      setErrors('Card type must have at least one field');
      setTimeout(() => setErrors(''), 3000);
      return;
    }
    onFieldsChange(fields.filter((_, i) => i !== originalIndex));
  };

  const handleDeleteByName = (name) => {
    // Delete all fields with this name
    const newFields = fields.filter(f => getFieldName(f) !== name);
    if (newFields.length === 0) {
       // If we are deleting everything, maybe prevent if it leaves empty?
       // But 'Front' and 'Back' are defaults in availableFields, so they re-appear in list even if deleted from fields.
    }
    onFieldsChange(newFields);
  };

  const handleMoveField = (originalIndex, direction) => {
    const updated = [...fields];
    const field = updated[originalIndex];
    const side = field.side || 'available';
    
    const sideFields = updated
      .map((f, idx) => ({ ...f, originalIndex: idx }))
      .filter(f => (f.side || 'available') === side)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const currentIdxInSide = sideFields.findIndex(f => f.originalIndex === originalIndex);
    
    if (direction === 'up' && currentIdxInSide > 0) {
      const prevField = sideFields[currentIdxInSide - 1];
      const tempOrder = field.order;
      updated[originalIndex].order = prevField.order;
      updated[prevField.originalIndex].order = tempOrder;
    } else if (direction === 'down' && currentIdxInSide < sideFields.length - 1) {
      const nextField = sideFields[currentIdxInSide + 1];
      const tempOrder = field.order;
      updated[originalIndex].order = nextField.order;
      updated[nextField.originalIndex].order = tempOrder;
    }
    
    onFieldsChange(updated);
  };

  const handleDragStart = (index, side) => {
    if (side === 'available') {
      // For available fields, index is the index in availableFields array
      const field = availableFields[index];
      setDragState({
        draggedIndex: null, // Not a real field index
        draggedSide: 'available',
        draggedName: field.name,
        targetIndex: null,
        targetSide: null
      });
    } else {
      let fieldList = side === 'front' ? frontFields : backFields;
      const field = fieldList[index];
      setDragState({
        draggedIndex: field.originalIndex,
        draggedSide: side,
        draggedName: getFieldName(field),
        targetIndex: null,
        targetSide: null
      });
    }
  };

  const handleDragOver = (index, side) => {
    setDragState(prev => ({
      ...prev,
      targetSide: side
    }));
  };

  const handleDrop = (index, side) => {
    const { draggedIndex, draggedSide, draggedName } = dragState;
    if (!draggedSide) return;

    if (draggedSide === 'available') {
        // PLACING FIELD FROM AVAILABLE POOL
        if (side === 'available') return; // Dropped back to available, do nothing

        // Check if there's already a field with this name and side='available'
        // If so, update its side instead of creating a duplicate
        const existingAvailableFieldIndex = fields.findIndex(f => {
          const fieldName = getFieldName(f);
          return fieldName === draggedName && (f.side === 'available' || !f.side);
        });

        if (existingAvailableFieldIndex !== -1) {
          // Update existing field's side
          const updated = [...fields];
          const existingField = updated[existingAvailableFieldIndex];
          
          // Calculate order for the target side
          const targetSideFields = updated.filter(f => {
            const fSide = f.side || 'available';
            return fSide === side && f !== existingField;
          });
          const maxOrder = targetSideFields.length > 0 
            ? Math.max(...targetSideFields.map(f => f.order || 0)) 
            : -1;
          
          existingField.side = side;
          existingField.order = maxOrder + 1;
          
          onFieldsChange(updated);
        } else {
          // No existing 'available' field, create new instance
          // This allows the same field name to appear on multiple sides
          const newField = {
            name: draggedName,
            side: side,
            required: false,
            order: 9999 
          };
          
          // Recalculate orders to be safe
          const sideFields = fields.filter(f => f.side === side);
          const maxOrder = sideFields.length > 0 ? Math.max(...sideFields.map(f => f.order || 0)) : 0;
          newField.order = maxOrder + 1;

          onFieldsChange([...fields, newField]);
        }

    } else {
        // MOVING EXISTING FIELD
        if (draggedIndex === null) return;
        
        const updated = [...fields];
        const draggedField = updated[draggedIndex];
        
        // Change side
        draggedField.side = side;
        
        // Assign new order
        const targetSideFields = updated.filter(f => (f.side || 'available') === side && f !== draggedField);
        draggedField.order = targetSideFields.length > 0 
          ? Math.max(...targetSideFields.map(f => f.order || 0)) + 1 
          : 0;

        onFieldsChange(updated);
    }
    
    setDragState({ draggedIndex: null, draggedSide: null, draggedName: null, targetIndex: null, targetSide: null });
  };

  const handleDragEnd = () => {
    setDragState({ draggedIndex: null, draggedSide: null, draggedName: null, targetIndex: null, targetSide: null });
  };

  return (
    <div>
      {/* Add Field Section */}
      {!readonlyFields && (
        <div style={{ marginBottom: '32px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.textPrimary,
            marginBottom: '10px',
            letterSpacing: '0.3px'
          }}>
            Add New Field
          </label>
          
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddField();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="e.g., Audio, Context, Source"
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '15px',
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '12px',
                outline: 'none',
                background: 'rgba(255, 255, 255, 0.5)',
                color: theme.textPrimary,
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.primary;
                e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.cardBorder;
                e.target.style.boxShadow = 'none';
              }}
            />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddField();
              }}
              disabled={!newFieldName.trim()}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                background: newFieldName.trim() ? theme.primary : theme.cardBorder,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: newFieldName.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s',
                opacity: newFieldName.trim() ? 1 : 0.6
              }}
            >
              Add
            </button>
          </div>

          {errors && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              background: 'rgba(254, 242, 242, 0.8)',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {errors}
            </div>
          )}
        </div>
      )}

      {/* Field Organization */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Available Fields Pool - Horizontal Layout */}
        {!readonlyFields && (
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.textPrimary,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Available Fields
            </h3>
            <div 
              onDragOver={(e) => {
                e.preventDefault();
                handleDragOver(0, 'available');
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(0, 'available');
              }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                border: `2px dashed ${dragState.targetSide === 'available' ? theme.primary : theme.cardBorder}`,
                minHeight: '60px',
                transition: 'all 0.3s'
              }}
            >
              {availableFields.length === 0 ? (
                <div style={{ fontSize: '13px', color: theme.textSecondary, fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                  New fields appear here. Drag them to Front or Back.
                </div>
              ) : (
                availableFields.map((field, index) => (
                  <DraggableFieldItem
                    key={`available-${field.name}-${index}`}
                    field={field}
                    index={index}
                    side="available"
                    onToggleRequired={() => {}} // No op for available
                    onDelete={() => handleDeleteByName(field.name)}
                    onMove={() => {}} // No op
                    onStyleChange={() => {}} // No op for available
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    isDragging={dragState.draggedSide === 'available' && dragState.draggedName === field.name}
                    theme={theme}
                    readonlyFields={readonlyFields}
                  />
                ))
              )}
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textSecondary, fontStyle: 'italic' }}>
              Drag fields from here to add them to Front or Back. You can add the same field multiple times.
            </div>
          </div>
        )}

        {/* Two Columns Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px'
        }}>
          {/* Front Side Column */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              handleDragOver(0, 'front');
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(0, 'front');
            }}
          >
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: '12px 12px 0 0',
              border: `1px solid ${theme.cardBorder}`,
              borderBottom: 'none',
              fontSize: '12px',
              fontWeight: '800',
              color: theme.primary,
              textAlign: 'center',
              letterSpacing: '1px'
            }}>
              FRONT SIDE
            </div>
            
            <div style={{
              minHeight: '250px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: `1px solid ${theme.cardBorder}`,
              borderStyle: dragState.targetSide === 'front' ? 'dashed' : 'solid',
              borderColor: dragState.targetSide === 'front' ? theme.primary : theme.cardBorder,
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.3s'
            }}>
              {frontFields.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  No fields on front side
                </div>
              ) : (
                frontFields.map((field, index) => (
                  <DraggableFieldItem
                    key={`front-${field.originalIndex}`}
                    field={field}
                    index={index}
                    side="front"
                    onToggleRequired={handleToggleRequired}
                    onDelete={handleDeleteField}
                    onMove={handleMoveField}
                    onStyleChange={onStyleChange}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    isDragging={dragState.draggedIndex === field.originalIndex}
                    theme={theme}
                    readonlyFields={readonlyFields}
                  />
                ))
              )}
            </div>
          </div>

          {/* Back Side Column */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              handleDragOver(0, 'back');
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(0, 'back');
            }}
          >
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: '12px 12px 0 0',
              border: `1px solid ${theme.cardBorder}`,
              borderBottom: 'none',
              fontSize: '12px',
              fontWeight: '800',
              color: theme.textSecondary,
              textAlign: 'center',
              letterSpacing: '1px'
            }}>
              BACK SIDE
            </div>
            
            <div style={{
              minHeight: '250px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: `1px solid ${theme.cardBorder}`,
              borderStyle: dragState.targetSide === 'back' ? 'dashed' : 'solid',
              borderColor: dragState.targetSide === 'back' ? theme.primary : theme.cardBorder,
              borderRadius: '0 0 12px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.3s'
            }}>
              {backFields.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  No fields on back side
                </div>
              ) : (
                backFields.map((field, index) => (
                  <DraggableFieldItem
                    key={`back-${field.originalIndex}`}
                    field={field}
                    index={index}
                    side="back"
                    onToggleRequired={handleToggleRequired}
                    onDelete={handleDeleteField}
                    onMove={handleMoveField}
                    onStyleChange={onStyleChange}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    isDragging={dragState.draggedIndex === field.originalIndex}
                    theme={theme}
                    readonlyFields={readonlyFields}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.3)',
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: '16px',
          fontSize: '13px',
          color: theme.textSecondary,
          lineHeight: '1.6',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start'
        }}>
          <div style={{ color: theme.primary, marginTop: '2px' }}>
            <LucideIcon name="Lightbulb" size={16} />
          </div>
          <div>
            <strong style={{ color: theme.textPrimary }}>Tip:</strong> {readonlyFields ? 'Use ▲ ▼ to reorder fields within a side. You can also drag fields between Front and Back.' : 'Drag fields from "Available" to either side of the card. Use ▲ ▼ to reorder fields within a side.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FieldManager;
