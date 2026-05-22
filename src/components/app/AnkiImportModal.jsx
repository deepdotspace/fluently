import React, { useState, useCallback } from 'react';
import { parseApkgFile, importApkg } from '../../utils/ankiImporter';
import CustomDropdown from './CustomDropdown';
import LucideIcon from './LucideIcon';

const languageOptions = [
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
  { value: 'nl', label: 'Dutch' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ja_kana', label: 'Japanese (Kana)' },
  { value: 'ko', label: 'Korean' },
  { value: 'no', label: 'Norwegian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'pt_br', label: 'Portuguese (Brazilian)' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'th', label: 'Thai' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'vi', label: 'Vietnamese' },
];

function StatPill({ label, value, theme }) {
  return (
    <div style={{
      padding: '10px 16px',
      borderRadius: '14px',
      background: '#f8fafc',
      color: theme?.textPrimary || '#0f172a',
      fontSize: '13px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      border: `1px solid ${theme?.cardBorder || 'rgba(0,0,0,0.08)'}`,
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <span style={{ opacity: 0.6, fontWeight: '500' }}>{label}</span>
      <strong style={{ color: theme?.primary }}>{value}</strong>
    </div>
  );
}

export default function AnkiImportModal({
  open,
  onClose,
  theme,
  cardMutations,
  decks,
  deckMutations,
  cardTypes,
  updateCardTypes,
  mediaRecords,
  mediaMutations,
  settings
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [schedulingMode, setSchedulingMode] = useState('reset');
  const [targetLang, setTargetLang] = useState('en');
  const [nativeLang, setNativeLang] = useState('en');

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setParsing(true);
    setError('');
    try {
      const data = await parseApkgFile(file);
      setParsedData(data);
      setSummary({
        decks: Object.keys(data.decks || {}).length,
        models: Object.keys(data.models || {}).length,
        notes: (data.notes || []).length,
        cards: (data.cards || []).length,
        media: Object.keys(data.mediaLookup || {}).length
      });
    } catch (err) {
      console.error('Failed to parse Anki package', err);
      setError(err?.message || 'Failed to parse .apkg file.');
      setSummary(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!parsedData || !selectedFile) return;
    if (!cardMutations) {
      setError('Storage is not ready yet. Please wait a moment.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const result = await importApkg({
        file: selectedFile,
        cardMutations,
        mediaMutations,
        mediaRecords,
        existingCardTypes: cardTypes,
        decksState: decks,
        deckMutations,
        schedulingMode,
        targetLang,
        nativeLang
      });

      // Merge card types
      if (result.cardTypesToAdd && updateCardTypes) {
        updateCardTypes({
          ...(cardTypes || {}),
          ...result.cardTypesToAdd
        });
      }

      setSummary(prev => ({
        ...(prev || {}),
        importedCards: result.createdCardsCount,
        deckCount: result.deckCount
      }));
      onClose?.();
    } catch (err) {
      console.error('Import failed', err);
      setError(err?.message || 'Failed to import Anki deck.');
    } finally {
      setImporting(false);
    }
  }, [parsedData, selectedFile, cardMutations, mediaMutations, mediaRecords, cardTypes, decks, deckMutations, schedulingMode, targetLang, nativeLang, updateCardTypes, onClose]);

  if (!open) return null;

  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      key="overlay"
    >
      <div
        className="anim-fade-slide-down"
        style={{
          width: 'min(720px, 100%)',
          background: '#ffffff',
          color: theme?.textPrimary || '#0f172a',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          padding: '32px',
          maxHeight: '90vh',
          overflow: 'auto',
          border: `1px solid ${theme?.cardBorder || '#e2e8f0'}`,
          position: 'relative'
        }}
        key="content"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>
              Import from Anki
            </h2>
            <p style={{ margin: '8px 0 0', color: theme?.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>
              Bring your Anki decks into Fluently. We'll automatically handle card types, media, and scheduling progress.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
              color: theme?.textSecondary,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.1)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.05)'}
          >
            <LucideIcon name="x" size={20} color={theme?.textSecondary} />
          </button>
        </div>

        <div
          style={{
            border: `2px dashed ${theme?.cardBorder || '#e2e8f0'}`,
            borderRadius: '16px',
            padding: '32px 24px',
            background: '#f8fafc',
            marginBottom: '24px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = theme?.primary}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = theme?.cardBorder}
        >
          <label style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <LucideIcon name="package" size={48} color={theme?.primary} />
            </div>
            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
              {selectedFile ? selectedFile.name : 'Select Anki Package (.apkg)'}
            </div>
            <div style={{ fontSize: '13px', color: theme?.textSecondary }}>
              {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Drop your file here or click to browse'}
            </div>
            <input
              type="file"
              accept=".apkg"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>
          {parsing && (
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div className="animate-spin" style={{ width: '16px', height: '16px', border: `2px solid ${theme?.primary}33`, borderTopColor: theme?.primary, borderRadius: '50%' }}></div>
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Analyzing package...</span>
            </div>
          )}
        </div>

        {summary && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: theme?.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Package Summary
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <StatPill label="Decks" value={summary.decks} theme={theme} />
              <StatPill label="Note Types" value={summary.models} theme={theme} />
              <StatPill label="Notes" value={summary.notes} theme={theme} />
              <StatPill label="Cards" value={summary.cards} theme={theme} />
              <StatPill label="Media Files" value={summary.media} theme={theme} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', marginBottom: '32px' }}>
          {/* Scheduling Section */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: `1px solid ${theme?.cardBorder || '#e2e8f0'}` }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LucideIcon name="clock" size={18} color={theme?.primary} /> Scheduling
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '10px',
                background: schedulingMode === 'reset' ? '#ffffff' : 'transparent',
                transition: 'all 0.2s',
                border: schedulingMode === 'reset' ? `1px solid ${theme?.primary}40` : '1px solid transparent'
              }}>
                <input
                  type="radio"
                  name="sched"
                  checked={schedulingMode === 'reset'}
                  onChange={() => setSchedulingMode('reset')}
                  style={{ accentColor: theme?.primary }}
                />
                <div style={{ fontWeight: schedulingMode === 'reset' ? '600' : '400' }}>Reset progress</div>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '10px',
                background: schedulingMode === 'preserve' ? '#ffffff' : 'transparent',
                transition: 'all 0.2s',
                border: schedulingMode === 'preserve' ? `1px solid ${theme?.primary}40` : '1px solid transparent'
              }}>
                <input
                  type="radio"
                  name="sched"
                  checked={schedulingMode === 'preserve'}
                  onChange={() => setSchedulingMode('preserve')}
                  style={{ accentColor: theme?.primary }}
                />
                <div style={{ fontWeight: schedulingMode === 'preserve' ? '600' : '400' }}>Keep Anki progress</div>
              </label>
            </div>
          </div>

          {/* Languages Section */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: `1px solid ${theme?.cardBorder || '#e2e8f0'}` }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LucideIcon name="languages" size={18} color={theme?.primary} /> Languages
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme?.textSecondary, marginBottom: '6px', marginLeft: '4px' }}>
                  TARGET LANGUAGE
                </div>
                <CustomDropdown
                  value={targetLang}
                  options={languageOptions}
                  onChange={setTargetLang}
                  placeholder="Select Target Language"
                  theme={theme}
                  fontSize="14px"
                  padding="10px 14px"
                  dropUp
                  searchable
                />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme?.textSecondary, marginBottom: '6px', marginLeft: '4px' }}>
                  NATIVE LANGUAGE
                </div>
                <CustomDropdown
                  value={nativeLang}
                  options={languageOptions}
                  onChange={setNativeLang}
                  placeholder="Select Native Language"
                  theme={theme}
                  fontSize="14px"
                  padding="10px 14px"
                  dropUp
                  searchable
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(239,68,68,0.1)',
            color: '#b91c1c',
            marginBottom: '24px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(239,68,68,0.2)'
          }}>
            <LucideIcon name="alert-triangle" size={18} color="#b91c1c" />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: `1px solid ${theme?.cardBorder}`,
              background: 'transparent',
              color: theme?.textPrimary,
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.03)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            disabled={importing}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!parsedData || importing}
            style={{
              padding: '12px 32px',
              borderRadius: '12px',
              border: 'none',
              background: theme?.primary || '#2563eb',
              color: '#fff',
              fontWeight: '700',
              fontSize: '15px',
              cursor: parsedData && !importing ? 'pointer' : 'not-allowed',
              opacity: parsedData && !importing ? 1 : 0.6,
              boxShadow: parsedData && !importing ? `0 10px 15px -3px ${theme?.primary}40` : 'none',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (parsedData && !importing) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 15px 20px -3px ${theme?.primary}60`;
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = parsedData && !importing ? `0 10px 15px -3px ${theme?.primary}40` : 'none';
            }}
          >
            {importing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}></div>
                <span>Importing...</span>
              </div>
            ) : 'Import Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

