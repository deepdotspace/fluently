import React, { useEffect, useRef, useState } from 'react';

/**
 * Converts various icon name formats to PascalCase for Lucide
 * Handles: "arrow-left" -> "ArrowLeft", "X" -> "X", "settings" -> "Settings"
 */
const toPascalCase = (str) => {
  if (!str) return '';
  
  // If already PascalCase (starts with uppercase), check if it needs conversion
  if (str[0] === str[0].toUpperCase() && !str.includes('-')) {
    return str;
  }
  
  // Handle kebab-case and lowercase
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

/**
 * Converts icon name to kebab-case for Lucide createIcons
 * Handles: "ArrowLeft" -> "arrow-left", "X" -> "x", "Settings" -> "settings"
 */
const toKebabCase = (str) => {
  if (!str) return '';
  
  // If already kebab-case, return as is
  if (str.includes('-')) {
    return str.toLowerCase();
  }
  
  // Convert PascalCase/camelCase to kebab-case
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, ''); // Remove leading dash
};

/**
 * LucideIcon component that uses the lucide global library
 * loaded from CDN to render icons.
 */
const LucideIcon = ({ 
  name, 
  size = 20, 
  color = 'currentColor', 
  strokeWidth = 2,
  className = '' 
}) => {
  const iconRef = useRef(null);
  const [lucideReady, setLucideReady] = useState(false);

  useEffect(() => {
    // Check if Lucide is already loaded
    if (window.lucide) {
      setLucideReady(true);
      return;
    }

    // Listen for lucide-loaded event
    const handleLucideLoaded = () => {
      setLucideReady(true);
    };

    window.addEventListener('lucide-loaded', handleLucideLoaded);

    // Also check periodically in case event was missed
    const checkInterval = setInterval(() => {
      if (window.lucide) {
        setLucideReady(true);
        clearInterval(checkInterval);
      }
    }, 100);

    return () => {
      window.removeEventListener('lucide-loaded', handleLucideLoaded);
      clearInterval(checkInterval);
    };
  }, []);

  useEffect(() => {
    if (!lucideReady || !iconRef.current || !name) return;

    const renderIcon = () => {
      if (!window.lucide) {
        return;
      }

      // Convert icon name to PascalCase and kebab-case
      const pascalName = toPascalCase(name);
      const kebabName = toKebabCase(name);
      
      // Clear previous content
      if (iconRef.current) {
        iconRef.current.innerHTML = '';
      }

      let iconRendered = false;

      // Method 1: Try direct access via window.lucide[pascalName]
      const IconComponent = window.lucide[pascalName];
      if (IconComponent && typeof IconComponent === 'function') {
        try {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svg.setAttribute('width', size.toString());
          svg.setAttribute('height', size.toString());
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', color);
          svg.setAttribute('stroke-width', strokeWidth.toString());
          svg.setAttribute('stroke-linecap', 'round');
          svg.setAttribute('stroke-linejoin', 'round');
          if (className) {
            svg.setAttribute('class', className);
          }
          svg.style.display = 'inline-block';
          svg.style.verticalAlign = 'middle';

          IconComponent(svg);
          
          if (iconRef.current) {
            iconRef.current.appendChild(svg);
            iconRendered = true;
          }
        } catch (e) {
          console.warn(`Error rendering icon "${pascalName}":`, e);
        }
      }

      // Method 2: Try via lucide.icons object
      if (!iconRendered && window.lucide.icons) {
        const IconFromIcons = window.lucide.icons[pascalName];
        if (IconFromIcons && typeof IconFromIcons === 'function') {
          try {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svg.setAttribute('width', size.toString());
            svg.setAttribute('height', size.toString());
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', color);
            svg.setAttribute('stroke-width', strokeWidth.toString());
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            if (className) {
              svg.setAttribute('class', className);
            }
            svg.style.display = 'inline-block';
            svg.style.verticalAlign = 'middle';

            IconFromIcons(svg);
            
            if (iconRef.current) {
              iconRef.current.appendChild(svg);
              iconRendered = true;
            }
          } catch (e) {
            console.warn(`Error rendering icon "${pascalName}" from icons object:`, e);
          }
        }
      }

      // Method 3: Use createIcons with kebab-case name
      if (!iconRendered && window.lucide.createIcons) {
        try {
          const element = document.createElement('i');
          element.setAttribute('data-lucide', kebabName);
          
          if (iconRef.current) {
            iconRef.current.appendChild(element);
            
            // createIcons needs to be called after element is in DOM
            window.lucide.createIcons({
              nameAttr: 'data-lucide',
              attrs: {
                width: size,
                height: size,
                stroke: color,
                'stroke-width': strokeWidth
              }
            });
            iconRendered = true;
          }
        } catch (e) {
          console.warn(`Error using createIcons for "${kebabName}":`, e);
        }
      }

      if (!iconRendered) {
        console.warn(`Lucide icon "${name}" (PascalCase: "${pascalName}", kebab-case: "${kebabName}") not found`);
      }
    };

    renderIcon();
  }, [name, size, color, strokeWidth, className, lucideReady]);

  return (
    <span 
      ref={iconRef} 
      className={className} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: size,
        height: size,
        verticalAlign: 'middle'
      }} 
    />
  );
};

export default LucideIcon;
