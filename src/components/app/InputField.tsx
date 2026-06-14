import React from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from 'react';
import type { SoftTheme } from '../../types';

interface InputFieldProps {
  label?: React.ReactNode;
  type?: string;
  value?: string | number | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  theme: SoftTheme;
}

const InputField = React.memo(({
  label,
  type = 'number',
  value,
  onChange,
  placeholder,
  step,
  min,
  theme
}: InputFieldProps) => {
  const handleChange = React.useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onChange(e);
  }, [onChange]);

  const handleKeyDown = React.useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  const handleClick = React.useCallback((e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  }, []);

  const handleFocus = React.useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.target.style.borderColor = theme.primary;
    e.target.style.boxShadow = `0 0 0 3px ${theme.primary}20`;
  }, [theme.primary]);

  const handleBlur = React.useCallback((e: FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = theme.cardBorder;
    e.target.style.boxShadow = 'none';
  }, [theme.cardBorder]);

  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: theme.textPrimary,
        marginBottom: '10px',
        letterSpacing: '0.3px'
      }}>
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        step={step}
        min={min}
        style={{
          width: '100%',
          padding: '14px 18px',
          fontSize: '15px',
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: '12px',
          outline: 'none',
          boxSizing: 'border-box',
          background: 'rgba(255, 255, 255, 0.5)',
          color: theme.textPrimary,
          transition: 'all 0.3s'
        }}
      />
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;
