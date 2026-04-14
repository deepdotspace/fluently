import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { validateCardType, normalizeFields, generateTemplateFromFields, getFieldName, renderTemplateWithPlaceholders } from '../../utils/fieldSystem';
import { PROMPTS } from '../../utils/prompts';
import { miyagiAPI } from '../../utils/miyagiCompat';
import CardTypeOptionSelector from './CardTypeOptionSelector';
import FieldManager from './FieldManager';
import RichTextRenderer from './RichTextRenderer';
import GlassCard from './GlassCard';
import LucideIcon from './LucideIcon';

/**
 * CardTypeEditor - Redesigned card type creation/editing dialog
 * 
 * New UX Features:
 * - Split-screen layout: Configuration (left) + Preview (right)
 * - Visual card type selection (Basic, Basic+Reversed, Cloze)
 * - Drag-and-drop field reordering
 * - Collapsible advanced HTML editor
 * - Real-time preview updates
 */
function CardTypeEditor({
  cardType = null,
  cardTypes = {},
  onSave,
  onClose,
  theme
}) {
  const isEditMode = !!cardType;

  // Card type configuration
  const [name, setName] = useState(cardType?.name || '');
  const [reversible, setReversible] = useState(cardType?.reversible || false);
  const [isCloze, setIsCloze] = useState(cardType?.isCloze || false);

  // Fields
  const initialFields = useMemo(() => {
    if (cardType?.fields) {
      let normalized = normalizeFields(cardType.fields);

      // Remove duplicate fields (same name and side) - keep the first occurrence
      const seen = new Map();
      normalized = normalized.filter(field => {
        const fieldName = getFieldName(field);
        const fieldSide = field.side || 'back';
        const key = `${fieldName}:${fieldSide}`;

        if (seen.has(key)) {
          return false; // Duplicate, skip it
        }
        seen.set(key, true);
        return true;
      });

      if (cardType.fieldMetadata) {
        return normalized.map(field => {
          const fieldName = getFieldName(field);
          const metadata = cardType.fieldMetadata[fieldName];
          if (metadata) {
            return {
              ...field,
              required: metadata.required !== false,
              side: metadata.side || field.side,
              order: metadata.order !== undefined ? metadata.order : field.order
            };
          }
          return field;
        });
      }
      return normalized;
    }
    return normalizeFields(['Front', 'Back']);
  }, [cardType?.fields, cardType?.fieldMetadata]);

  const [fields, setFields] = useState(initialFields);

  // Templates
  const [autoGenerateTemplates, setAutoGenerateTemplates] = useState(!isEditMode);
  const [frontTemplate, setFrontTemplate] = useState(() => {
    if (cardType?.frontTemplate) return cardType.frontTemplate;
    const normalized = normalizeFields(['Front', 'Back']);
    return generateTemplateFromFields(normalized).frontTemplate;
  });
  const [backTemplate, setBackTemplate] = useState(() => {
    if (cardType?.backTemplate) return cardType.backTemplate;
    const normalized = normalizeFields(['Front', 'Back']);
    return generateTemplateFromFields(normalized).backTemplate;
  });

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState([]);
  const [previewFlipped, setPreviewFlipped] = useState(false);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Handle field style changes
  const handleStyleChange = (originalIndex, style) => {
    const updated = [...fields];
    updated[originalIndex] = { ...updated[originalIndex], style };
    setFields(updated);
    // Ensure styled fields regenerate templates in edit mode
    setAutoGenerateTemplates(true);
  };

  const handleAIGenerate = async (side) => {
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      const currentHtml = side === 'front' ? frontTemplate : backTemplate;
      const prompt = PROMPTS.MODIFY_TEMPLATE(currentHtml, aiPrompt);

      const response = await miyagiAPI.post('/generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o-mini', // Changed from gpt-5-mini for better reliability
        max_tokens: 1000
      });

      if (response.success && response.data.text) {
        // Clean up markdown code blocks if present
        let newHtml = response.data.text.trim();
        if (newHtml.startsWith('```html')) newHtml = newHtml.replace(/^```html/, '').replace(/```$/, '');
        else if (newHtml.startsWith('```')) newHtml = newHtml.replace(/^```/, '').replace(/```$/, '');

        newHtml = newHtml.trim();

        if (side === 'front') {
          setFrontTemplate(newHtml);
        } else {
          setBackTemplate(newHtml);
        }
        setAutoGenerateTemplates(false);
        setAiPrompt(''); // Clear prompt on success
      }
    } catch (err) {
      console.error('AI Generation error:', err);
      setErrors(['AI generation failed. Please try again.']);
      setTimeout(() => setErrors([]), 3000);
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-generate templates when fields change
  useEffect(() => {
    if (autoGenerateTemplates && fields.length > 0) {
      const templates = generateTemplateFromFields(fields);
      setFrontTemplate(templates.frontTemplate);
      setBackTemplate(templates.backTemplate);
    }
  }, [fields, autoGenerateTemplates]);

  // Generate preview HTML
  const fieldNames = useMemo(() => fields.map(f => getFieldName(f)), [fields]);

  const previewFrontHTML = useMemo(() => {
    return renderTemplateWithPlaceholders(frontTemplate, fieldNames, null);
  }, [frontTemplate, fieldNames]);

  const previewBackHTML = useMemo(() => {
    return renderTemplateWithPlaceholders(backTemplate, fieldNames, frontTemplate);
  }, [backTemplate, fieldNames, frontTemplate]);

  // Handle card type change
  const handleCardTypeChange = useCallback((type) => {
    setReversible(type.reversible);
    setIsCloze(type.isCloze);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    // Save full field objects to support duplicates and custom properties
    // Filter out fields with side='available' as they're just UI state for unplaced fields
    // Map fields to a clean structure
    const cleanFields = fields
      .filter(f => {
        const fieldSide = f.side || 'available';
        return fieldSide !== 'available'; // Don't save unplaced fields
      })
      .map(f => ({
        name: getFieldName(f),
        side: f.side || 'back',
        order: f.order !== undefined ? f.order : 999,
        required: f.required !== false,
        style: f.style || null
      }));

    // Generate basic metadata for backward compatibility (though we'll rely on fields array)
    // We intentionally leave it empty for new saves to prevent it from overriding individual field configurations
    // on reload. The full field objects in 'fields' will carry the correct data.
    const fieldMetadata = {};

    const cardTypeData = {
      id: cardType?.id || `cardtype-${Date.now()}`,
      name: name.trim(),
      fields: cleanFields, // Save full objects
      fieldMetadata: null, // Set to null to avoid metadata overriding field properties on reload
      frontTemplate: frontTemplate.trim(),
      backTemplate: backTemplate.trim(),
      css: '',
      reversible,
      isCloze
    };

    const validation = validateCardType(cardTypeData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setTimeout(() => setErrors([]), 5000);
      return;
    }

    if (!cardType || cardType.name !== name.trim()) {
      const existing = Object.values(cardTypes).find(ct => ct.name === name.trim());
      if (existing) {
        setErrors(['A card type with this name already exists']);
        setTimeout(() => setErrors([]), 3000);
        return;
      }
    }

    onSave(cardTypeData);
  }, [cardType, name, fields, frontTemplate, backTemplate, reversible, isCloze, cardTypes, onSave]);


  if (!theme) return null;

  const hexToRgba = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="anim-fade-slide-down"
        style={{
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          height: '850px',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: theme.gradient,
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.cardBorder}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Consistent with DeckEditorModal */}
        <div style={{
          padding: '24px 32px',
          borderBottom: `1px solid ${theme.cardBorder}`,
          background: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: theme.textPrimary,
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              {isEditMode ? 'Edit Card Type' : 'Create New Card Type'}
            </h2>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: theme.textSecondary,
              fontWeight: '400'
            }}>
              {isEditMode ? 'Modify your card type configuration' : 'Design a custom flashcard template'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: `1px solid ${theme.cardBorder}`,
              background: 'rgba(255, 255, 255, 0.6)',
              color: theme.textSecondary,
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.highlight;
              e.currentTarget.style.color = theme.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
              e.currentTarget.style.color = theme.textSecondary;
            }}
          >
            <LucideIcon name="x" size={20} color="currentColor" />
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div
            style={{
              margin: '16px 32px 0 32px',
              padding: '12px 16px',
              background: 'rgba(254, 242, 242, 0.8)',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              color: '#991b1b',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            {errors.map((error, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LucideIcon name="Dot" size={16} /> {error}
              </div>
            ))}
          </div>
        )}

        {/* Main Content - Split Screen */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {/* Left Panel - Configuration */}
          <div
            className="no-scrollbar"
            style={{
              flex: '1 1 65%',
              padding: '32px',
              overflowY: 'auto',
              borderRight: `1px solid ${theme.cardBorder}`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Card Type Option Selector */}
              {!isEditMode && (
                <div style={{
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '16px',
                  border: `1px solid ${theme.cardBorder}`
                }}>
                  <CardTypeOptionSelector
                    value={{ reversible, isCloze }}
                    onChange={handleCardTypeChange}
                    theme={theme}
                  />
                </div>
              )}

              {/* Card Type Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: '10px',
                    letterSpacing: '0.3px'
                  }}
                >
                  Card Type Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="e.g., Vocabulary, Geography, Q&A"
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontSize: '15px',
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: '12px',
                    outline: 'none',
                    background: 'rgba(255, 255, 255, 0.5)',
                    color: theme.textPrimary,
                    boxSizing: 'border-box',
                    transition: 'all 0.3s',
                    cursor: 'text'
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
              </div>

              {/* Field Manager */}
              <FieldManager
                fields={fields}
                onFieldsChange={setFields}
                onStyleChange={handleStyleChange}
                theme={theme}
                readonlyFields={isEditMode}
              />

              {/* Advanced Customization */}
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAdvanced(!showAdvanced);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: showAdvanced ? `${theme.primary}15` : 'rgba(255, 255, 255, 0.4)',
                    color: theme.primary,
                    border: `1px solid ${showAdvanced ? theme.primary : theme.cardBorder}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    letterSpacing: '0.3px'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LucideIcon name="settings" size={18} color={theme.primary} /> Advanced HTML Customization
                  </span>
                  <LucideIcon
                    name="chevron-down"
                    size={18}
                    className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}
                    color={theme.primary}
                  />
                </button>

                {showAdvanced && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '24px',
                      background: 'rgba(255, 255, 255, 0.3)',
                      border: `1px solid ${theme.cardBorder}`,
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}
                  >
                    {/* Auto-generate toggle */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={autoGenerateTemplates}
                        onChange={(e) => {
                          e.stopPropagation();
                          setAutoGenerateTemplates(e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: theme.primary
                        }}
                      />
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: theme.textPrimary
                        }}
                      >
                        Auto-generate templates from fields
                      </span>
                    </label>

                    {/* Front Template */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: theme.textPrimary,
                          marginBottom: '8px'
                        }}
                      >
                        Front Template HTML
                      </label>
                      <textarea
                        value={frontTemplate}
                        onChange={(e) => {
                          setFrontTemplate(e.target.value);
                          setAutoGenerateTemplates(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter front template HTML..."
                        spellCheck={false}
                        disabled={autoGenerateTemplates}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '14px',
                          fontSize: '13px',
                          fontFamily: '"JetBrains Mono", "Monaco", "Menlo", "Consolas", monospace',
                          border: `1px solid ${theme.cardBorder}`,
                          borderRadius: '12px',
                          outline: 'none',
                          resize: 'vertical',
                          background: autoGenerateTemplates ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                          color: theme.textPrimary,
                          lineHeight: '1.6',
                          boxSizing: 'border-box',
                          cursor: autoGenerateTemplates ? 'not-allowed' : 'text',
                          transition: 'all 0.3s'
                        }}
                        onFocus={(e) => {
                          if (!autoGenerateTemplates) {
                            e.target.style.borderColor = theme.primary;
                            e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = theme.cardBorder;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Back Template */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: theme.textPrimary,
                          marginBottom: '8px'
                        }}
                      >
                        Back Template HTML
                      </label>
                      <textarea
                        value={backTemplate}
                        onChange={(e) => {
                          setBackTemplate(e.target.value);
                          setAutoGenerateTemplates(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter back template HTML..."
                        spellCheck={false}
                        disabled={autoGenerateTemplates}
                        style={{
                          width: '100%',
                          minHeight: '120px',
                          padding: '14px',
                          fontSize: '13px',
                          fontFamily: '"JetBrains Mono", "Monaco", "Menlo", "Consolas", monospace',
                          border: `1px solid ${theme.cardBorder}`,
                          borderRadius: '12px',
                          outline: 'none',
                          resize: 'vertical',
                          background: autoGenerateTemplates ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                          color: theme.textPrimary,
                          lineHeight: '1.6',
                          boxSizing: 'border-box',
                          cursor: autoGenerateTemplates ? 'not-allowed' : 'text',
                          transition: 'all 0.3s'
                        }}
                        onFocus={(e) => {
                          if (!autoGenerateTemplates) {
                            e.target.style.borderColor = theme.primary;
                            e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = theme.cardBorder;
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* AI Generation Section */}
                    <div style={{
                      marginTop: '12px',
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.4)',
                      borderRadius: '12px',
                      border: `1px solid ${theme.cardBorder}`
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: theme.primary,
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <LucideIcon name="Sparkles" size={14} color={theme.primary} />
                        <span>AI Template Designer</span>
                      </div>

                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe how you want to change the style... (e.g., 'Make the front field bold and blue', 'Add a grey background to the hint field')"
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '10px',
                          fontSize: '13px',
                          border: `1px solid ${theme.cardBorder}`,
                          borderRadius: '8px',
                          marginBottom: '10px',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          background: 'rgba(255, 255, 255, 0.6)'
                        }}
                      />

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleAIGenerate('front')}
                          disabled={aiLoading || !aiPrompt.trim()}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: theme.highlight,
                            color: theme.textPrimary,
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                            opacity: aiLoading || !aiPrompt.trim() ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {aiLoading ? 'Generating...' : 'Apply to Front'}
                        </button>
                        <button
                          onClick={() => handleAIGenerate('back')}
                          disabled={aiLoading || !aiPrompt.trim()}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: theme.highlight,
                            color: theme.textPrimary,
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                            opacity: aiLoading || !aiPrompt.trim() ? 0.6 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          {aiLoading ? 'Generating...' : 'Apply to Back'}
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: `1px solid ${theme.cardBorder}`,
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: theme.textSecondary,
                        lineHeight: '1.6'
                      }}
                    >
                      <strong style={{ color: theme.textPrimary }}>Template Syntax:</strong> Use <code>{'{{FieldName}}'}</code> for field values,
                      <code>{' {{#Field}}...{{/Field}}'}</code> for conditionals.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div
            style={{
              flex: '0 0 35%',
              padding: '32px',
              overflowY: 'auto',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              alignItems: 'center'
            }}
          >
            <div style={{ width: '100%' }}>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '18px',
                  fontWeight: '700',
                  color: theme.textPrimary,
                  letterSpacing: '-0.01em'
                }}
              >
                Live Preview
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: theme.textSecondary,
                  fontWeight: '400'
                }}
              >
                Click card to flip
              </p>
            </div>

            {/* Preview Card */}
            <div
              style={{
                width: '100%',
                maxWidth: '320px',
                height: '240px',
                perspective: '1000px',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => setPreviewFlipped(!previewFlipped)}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
                  transform: previewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front Side */}
                <PreviewSide
                  side="front"
                  content={previewFrontHTML}
                  theme={theme}
                  isFlipped={false}
                />

                {/* Back Side */}
                <PreviewSide
                  side="back"
                  content={previewBackHTML}
                  theme={theme}
                  isFlipped={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px 32px',
          borderTop: `1px solid ${theme.cardBorder}`,
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '14px', color: theme.textSecondary, fontWeight: '500' }}>
            {fields.length} field{fields.length !== 1 ? 's' : ''} configured
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 28px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                color: theme.textPrimary,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.7)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '12px 32px',
                background: theme.primary,
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: `0 4px 20px ${theme.primary}40`
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 8px 28px ${theme.primary}50`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = `0 4px 20px ${theme.primary}40`;
              }}
            >
              {isEditMode ? 'Save Changes' : 'Create Card Type'}
            </button>
          </div>
        </div>

        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * PreviewSide - Preview card side component
 */
function PreviewSide({ side, content, theme, isFlipped }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        boxSizing: 'border-box',
        background: 'white',
        border: `1px solid ${theme.cardBorder}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        padding: '20px',
        minHeight: '240px'
      }}
    >
      {/* Side Label */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          fontSize: '10px',
          fontWeight: '700',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          opacity: 0.6
        }}
      >
        {side}
      </div>

      {/* Content */}
      <div
        style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          color: theme.textPrimary,
          textAlign: 'center',
          lineHeight: '1.4'
        }}
      >
        {content ? (
          <RichTextRenderer
            html={content}
            media={{ images: [], audio: [] }}
            theme={theme}
          />
        ) : (
          <div
            style={{
              color: theme.textSecondary,
              fontStyle: 'italic',
              fontSize: '13px'
            }}
          >
            {side === 'front' ? 'Add fields' : 'Back side'}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardTypeEditor;
