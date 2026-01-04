/**
 * Nexus POS Embed Widget
 * 
 * Usage:
 * <script src="https://nexuspos.com/widget.js" data-restaurant="restaurant-slug"></script>
 * 
 * Options:
 * - data-restaurant: Restaurant slug (required)
 * - data-theme: "light" or "dark" (default: "dark")
 * - data-button-text: Custom button text (default: "Order Now")
 * - data-position: "bottom-right", "bottom-left", "inline" (default: "bottom-right")
 */

(function () {
    'use strict';

    const NEXUS_BASE_URL = window.NEXUS_POS_URL || 'https://nexuspos.com';

    // Get script element and read data attributes
    const script = document.currentScript || document.querySelector('script[data-restaurant]');
    const restaurant = script?.getAttribute('data-restaurant');
    const theme = script?.getAttribute('data-theme') || 'dark';
    const buttonText = script?.getAttribute('data-button-text') || 'Order Now';
    const position = script?.getAttribute('data-position') || 'bottom-right';
    const containerId = script?.getAttribute('data-container');

    if (!restaurant) {
        console.error('Nexus POS Widget: data-restaurant attribute is required');
        return;
    }

    // Styles
    const styles = `
        .nexus-widget-button {
            position: fixed;
            ${position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
            bottom: 24px;
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 28px;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            border: none;
            border-radius: 50px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .nexus-widget-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(124, 58, 237, 0.5);
        }
        .nexus-widget-button svg {
            width: 24px;
            height: 24px;
        }
        .nexus-widget-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 100000;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
        }
        .nexus-widget-modal.open {
            display: flex;
        }
        .nexus-widget-iframe-container {
            width: 95%;
            max-width: 480px;
            height: 90%;
            max-height: 800px;
            background: ${theme === 'dark' ? '#0a0a0a' : '#ffffff'};
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
            position: relative;
        }
        .nexus-widget-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .nexus-widget-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .nexus-widget-close svg {
            width: 20px;
            height: 20px;
            color: white;
        }
        .nexus-widget-iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        .nexus-inline-widget {
            width: 100%;
            min-height: 600px;
            border: none;
            border-radius: 16px;
            overflow: hidden;
        }
    `;

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create widget
    if (position === 'inline' && containerId) {
        // Inline embed mode
        const container = document.getElementById(containerId);
        if (container) {
            const iframe = document.createElement('iframe');
            iframe.src = `${NEXUS_BASE_URL}/embed/${restaurant}?theme=${theme}`;
            iframe.className = 'nexus-inline-widget';
            iframe.setAttribute('loading', 'lazy');
            container.appendChild(iframe);
        }
    } else {
        // Floating button mode
        const button = document.createElement('button');
        button.className = 'nexus-widget-button';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3h18v18H3z"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
            </svg>
            ${buttonText}
        `;

        const modal = document.createElement('div');
        modal.className = 'nexus-widget-modal';
        modal.innerHTML = `
            <div class="nexus-widget-iframe-container">
                <button class="nexus-widget-close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
                <iframe class="nexus-widget-iframe" src="" loading="lazy"></iframe>
            </div>
        `;

        document.body.appendChild(button);
        document.body.appendChild(modal);

        const iframe = modal.querySelector('.nexus-widget-iframe');
        const closeBtn = modal.querySelector('.nexus-widget-close');

        button.addEventListener('click', () => {
            iframe.src = `${NEXUS_BASE_URL}/embed/${restaurant}?theme=${theme}`;
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });

        // Listen for messages from iframe (order completion, etc.)
        window.addEventListener('message', (e) => {
            if (e.origin !== NEXUS_BASE_URL) return;

            if (e.data.type === 'nexus:order_complete') {
                // Could show success message or redirect
                console.log('Order complete:', e.data.orderNumber);
            }

            if (e.data.type === 'nexus:close') {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    }

    // Expose API for programmatic control
    window.NexusPOS = {
        open: function () {
            const modal = document.querySelector('.nexus-widget-modal');
            const iframe = modal?.querySelector('.nexus-widget-iframe');
            if (modal && iframe) {
                iframe.src = `${NEXUS_BASE_URL}/embed/${restaurant}?theme=${theme}`;
                modal.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        },
        close: function () {
            const modal = document.querySelector('.nexus-widget-modal');
            if (modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        }
    };
})();
