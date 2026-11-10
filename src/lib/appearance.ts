export const APPEARANCE_KEY = 'nexuspos-appearance'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

// Apply the saved preference before public pages paint.
export const appearanceBootstrap = `(() => {
    let preference;
    try { preference = localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)}); } catch {}
    document.documentElement.dataset.theme = preference === 'dark' || preference === 'light'
        ? preference
        : window.matchMedia(${JSON.stringify(COLOR_SCHEME_QUERY)}).matches ? 'dark' : 'light';
})();`
