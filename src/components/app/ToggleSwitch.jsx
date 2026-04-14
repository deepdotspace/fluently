import React from 'react';

function ToggleSwitch({ isOn, onToggle, theme }) {
    const switchStyle = {
        width: '60px',
        height: '34px',
        backgroundColor: isOn ? (theme?.primary || '#3B82F6') : 'rgba(120, 120, 128, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOn ? 'flex-end' : 'flex-start',
        borderRadius: '50px',
        padding: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease',
        position: 'relative',
        boxSizing: 'border-box'
    };

    const ballStyle = {
        width: '26px',
        height: '26px',
        backgroundColor: '#ffffff',
        borderRadius: '50%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    return (
        <div
            className="switch"
            style={switchStyle}
            onClick={onToggle}
            data-is-on={isOn}
        >
            <div className="ball" style={ballStyle} />
        </div>
    );
}

export default ToggleSwitch;
