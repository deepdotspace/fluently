import React from 'react';
import LucideIcon from './LucideIcon';
import ToggleSwitch from './ToggleSwitch';
import type { SoftTheme } from '../../types';

interface MediaOptionsProps {
  generateImages: boolean;
  setGenerateImages: (value: boolean) => void;
  generateAudio: boolean;
  setGenerateAudio: (value: boolean) => void;
  currentTheme: SoftTheme;
}

function MediaOptions({
  generateImages,
  setGenerateImages,
  generateAudio,
  setGenerateAudio,
  currentTheme
}: MediaOptionsProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: currentTheme.textPrimary,
        marginBottom: '12px',
        letterSpacing: '0.3px'
      }}>
        Media Generation (Optional)
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '10px',
          border: `1px solid ${currentTheme.cardBorder}`,
          cursor: 'pointer'
        }}>
          <ToggleSwitch
            isOn={generateImages}
            onToggle={() => setGenerateImages(!generateImages)}
            theme={currentTheme}
          />
          <div
            style={{ flex: 1 }}
            onClick={() => setGenerateImages(!generateImages)}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: currentTheme.textPrimary, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LucideIcon name="Image" size={16} /> Generate Images
            </div>
            <div style={{ fontSize: '12px', color: currentTheme.textSecondary }}>
              Create mnemonic images to help with memorization
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '10px',
          border: `1px solid ${currentTheme.cardBorder}`,
          cursor: 'pointer'
        }}>
          <ToggleSwitch
            isOn={generateAudio}
            onToggle={() => setGenerateAudio(!generateAudio)}
            theme={currentTheme}
          />
          <div
            style={{ flex: 1 }}
            onClick={() => setGenerateAudio(!generateAudio)}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', color: currentTheme.textPrimary, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LucideIcon name="Volume2" size={16} /> Generate Audio
            </div>
            <div style={{ fontSize: '12px', color: currentTheme.textSecondary }}>
              Create pronunciation audio for language learning
            </div>
          </div>
        </div>

        {(generateImages || generateAudio) && (
          <div style={{
            padding: '10px 14px',
            background: `${currentTheme.primary}15`,
            borderRadius: '8px',
            fontSize: '12px',
            color: currentTheme.textSecondary,
            border: `1px solid ${currentTheme.primary}30`
          }}>
            <strong>Note:</strong> Media generation happens after text creation and may take additional time. Cards will be created even if media generation fails.
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaOptions;
