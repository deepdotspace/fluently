import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useUser, signOut } from 'deepspace';
import ThemeSelector from './ThemeSelector';
import LucideIcon from './LucideIcon';
import useIsMobile from '../../hooks/useIsMobile';

const Navbar = ({ 
  navTabs, 
  activeTab, 
  setActiveTab, 
  viewingDeckId, 
  setViewingDeckId, 
  theme, 
  allThemes, 
  currentTheme, 
  setCurrentTheme 
}) => {
  const isMobile = useIsMobile();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userButtonRef = useRef(null);
  const [userMenuPos, setUserMenuPos] = useState({ top: 0, right: 0 });

  // Re-measure the user button when the menu opens or the window resizes,
  // so the portaled dropdown stays anchored under the button.
  useLayoutEffect(() => {
    if (!userMenuOpen) return;
    const updatePos = () => {
      const rect = userButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setUserMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [userMenuOpen]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setViewingDeckId(null);
    if (isMobile) closeDrawer();
  }, [setActiveTab, setViewingDeckId, isMobile]);

  const openDrawer = useCallback(() => {
    setDrawerClosing(false);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerClosing(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
    }, 250);
  }, []);

  // Close drawer on escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerOpen, closeDrawer]);

  const currentActiveId = viewingDeckId ? 'decks' : activeTab;

  // ─── Mobile Drawer (portal) ──────────────────────────────────────────────
  const mobileDrawer = drawerOpen ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`mobile-drawer-backdrop${drawerClosing ? ' closing' : ''}`}
        onClick={closeDrawer}
      />

      {/* Drawer Panel */}
      <div
        className={`mobile-drawer${drawerClosing ? ' closing' : ''}`}
        style={{
          background: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRight: `1px solid ${theme.cardBorder}`,
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 16px 20px',
          borderBottom: `1px solid ${theme.cardBorder}40`
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => handleTabChange('decks')}
          >
            <LucideIcon name="sparkles" size={22} color={theme.primary} />
            <span style={{
              fontSize: '16px',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: theme.primary
            }}>
              Fluently
            </span>
          </div>
          <button
            onClick={closeDrawer}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              background: `${theme.primary}10`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.textSecondary
            }}
          >
            <LucideIcon name="x" size={20} color={theme.textSecondary} />
          </button>
        </div>

        {/* Navigation Items */}
        <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navTabs.map((tab) => {
            const isActive = currentActiveId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '15px',
                  color: isActive ? theme.primary : theme.textSecondary,
                  background: isActive ? `${theme.primary}12` : 'transparent',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  letterSpacing: '0.2px'
                }}
              >
                <LucideIcon
                  name={tab.icon}
                  size={22}
                  color={isActive ? theme.primary : theme.textSecondary}
                />
                {tab.label}
                {isActive && (
                  <div style={{
                    marginLeft: 'auto',
                    width: '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: theme.primary
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Theme selector at bottom */}
        <div style={{
          padding: '16px 20px 12px 20px',
          borderTop: `1px solid ${theme.cardBorder}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: theme.textSecondary,
            opacity: 0.6
          }}>
            Theme
          </span>
          <ThemeSelector
            themes={allThemes}
            currentThemeId={currentTheme}
            onThemeChange={setCurrentTheme}
            currentTheme={theme}
          />
        </div>

        {/* User / Sign out */}
        {isSignedIn && user && (
          <div style={{
            padding: '12px 20px 24px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: `${theme.primary}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                color: theme.primary,
                flexShrink: 0,
                overflow: 'hidden'
              }}>
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user.name?.[0]?.toUpperCase() ?? '?'
                )}
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: theme.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.name || user.email}
              </span>
            </div>
            <button
              onClick={() => { closeDrawer(); signOut(); }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: `1px solid ${theme.cardBorder}`,
                background: 'transparent',
                color: theme.textSecondary,
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <nav
        className="sticky top-0 w-full border-b"
        style={{
          // Robust against every stacking-context trap in the app:
          //   • SOLID background (no rgba) — cards can't bleed through.
          //   • NO backdrop-filter — the previous backdrop-blur created its
          //     own stacking context that fought with GlassCard's backdrop
          //     filters and the home wrapper's opacity transition. Removing
          //     it eliminates that whole class of paint-order bugs.
          //   • `isolation: isolate` pins the nav as a fresh stacking root.
          //   • zIndex 9000 sits above all in-page elements but leaves room
          //     for modals (10000+) and the profile dropdown (9999).
          background: '#ffffff',
          borderColor: theme.cardBorder,
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          isolation: 'isolate',
          zIndex: 9000
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: isMobile ? '56px' : '80px'
          }}>
            {/* Left: Mobile hamburger OR Logo */}
            {isMobile ? (
              <button
                onClick={openDrawer}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: 'none',
                  background: `${theme.primary}10`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.primary
                }}
              >
                <LucideIcon name="menu" size={22} color={theme.primary} />
              </button>
            ) : (
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => handleTabChange('decks')}
              >
                <span className="text-2xl transition-transform group-hover:scale-110 duration-300">
                  <LucideIcon name="sparkles" size={24} color={theme.primary} />
                </span>
                <span 
                  className="text-lg font-black uppercase tracking-[2px]"
                  style={{ color: theme.primary }}
                >
                  Fluently
                </span>
              </div>
            )}

            {/* Center: Mobile logo / Desktop nav tabs */}
            {isMobile ? (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={() => handleTabChange('decks')}
              >
                <LucideIcon name="sparkles" size={20} color={theme.primary} />
                <span style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: theme.primary
                }}>
                  Fluently
                </span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
                {navTabs.map(tab => {
                  const isActive = currentActiveId === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        fontSize: '14px',
                        fontWeight: isActive ? '600' : '500',
                        color: isActive ? '#fff' : theme.textSecondary,
                        background: isActive ? theme.primary : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease, color 0.12s ease',
                        letterSpacing: '0.2px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <LucideIcon 
                        name={tab.icon} 
                        size={18} 
                        color="currentColor"
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Right: Theme selector (desktop only) / placeholder on mobile */}
            {isMobile ? (
              <div style={{ width: '40px' }} />
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                  <ThemeSelector
                    themes={allThemes}
                    currentThemeId={currentTheme}
                    onThemeChange={setCurrentTheme}
                    currentTheme={theme}
                  />
                </div>
                {isSignedIn && user && (
                  <div style={{ position: 'relative' }}>
                    <button
                      ref={userButtonRef}
                      onClick={() => setUserMenuOpen((prev) => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '5px 12px 5px 5px',
                        borderRadius: '9999px',
                        border: `1px solid ${theme.cardBorder}`,
                        background: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: `${theme.primary}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: theme.primary,
                        overflow: 'hidden'
                      }}>
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          user.name?.[0]?.toUpperCase() ?? '?'
                        )}
                      </div>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: theme.textSecondary,
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.name || user.email}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {mobileDrawer}

      {/* Profile dropdown — portaled to body so it floats above all page content
          (cards on Create/Browse use backdrop-filter, which creates stacking
          contexts that paint above the nav's own z-index). */}
      {userMenuOpen && isSignedIn && user && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setUserMenuOpen(false)}
          />
          <div style={{
            position: 'fixed',
            top: userMenuPos.top,
            right: userMenuPos.right,
            zIndex: 9999,
            minWidth: '180px',
            borderRadius: '12px',
            border: `1px solid ${theme.cardBorder}`,
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${theme.cardBorder}40`
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '11px', color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            </div>
            <button
              onClick={() => { setUserMenuOpen(false); signOut(); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                color: theme.textSecondary,
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'background 0.1s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.primary}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Sign out
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default Navbar;
