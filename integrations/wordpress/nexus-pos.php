<?php
/**
 * Plugin Name: Nexus POS Integration
 * Plugin URI: https://nexuspos.com/wordpress
 * Description: Integrate your WordPress restaurant website with Nexus POS management system. Display menu, accept orders, and sync everything automatically.
 * Version: 1.0.0
 * Author: Nexus POS
 * Author URI: https://nexuspos.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: nexus-pos
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('NEXUS_POS_VERSION', '1.0.0');
define('NEXUS_POS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('NEXUS_POS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('NEXUS_POS_API_URL', 'https://nexuspos.com/api/v1');

/**
 * Main Plugin Class
 */
class NexusPOS {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->init_hooks();
    }
    
    private function init_hooks() {
        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        
        // Shortcodes
        add_shortcode('nexus_menu', array($this, 'menu_shortcode'));
        add_shortcode('nexus_order', array($this, 'order_widget_shortcode'));
        
        // Widget script
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Gutenberg block
        add_action('init', array($this, 'register_block'));
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            'Nexus POS',
            'Nexus POS',
            'manage_options',
            'nexus-pos',
            array($this, 'admin_page'),
            'dashicons-food',
            30
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting('nexus_pos_settings', 'nexus_pos_api_key');
        register_setting('nexus_pos_settings', 'nexus_pos_restaurant_slug');
        register_setting('nexus_pos_settings', 'nexus_pos_theme');
        register_setting('nexus_pos_settings', 'nexus_pos_show_floating_button');
    }
    
    /**
     * Admin page
     */
    public function admin_page() {
        $api_key = get_option('nexus_pos_api_key', '');
        $restaurant_slug = get_option('nexus_pos_restaurant_slug', '');
        $theme = get_option('nexus_pos_theme', 'dark');
        $show_button = get_option('nexus_pos_show_floating_button', '1');
        ?>
        <div class="wrap">
            <h1>Nexus POS Settings</h1>
            
            <form method="post" action="options.php">
                <?php settings_fields('nexus_pos_settings'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">API Key</th>
                        <td>
                            <input type="text" name="nexus_pos_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                            <p class="description">Get your API key from Nexus POS Dashboard → Settings → API Keys</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Restaurant Slug</th>
                        <td>
                            <input type="text" name="nexus_pos_restaurant_slug" value="<?php echo esc_attr($restaurant_slug); ?>" class="regular-text" placeholder="spice-garden" />
                            <p class="description">Your restaurant URL slug (e.g., "spice-garden")</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Theme</th>
                        <td>
                            <select name="nexus_pos_theme">
                                <option value="dark" <?php selected($theme, 'dark'); ?>>Dark</option>
                                <option value="light" <?php selected($theme, 'light'); ?>>Light</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Show Floating Order Button</th>
                        <td>
                            <input type="checkbox" name="nexus_pos_show_floating_button" value="1" <?php checked($show_button, '1'); ?> />
                            <span class="description">Display floating "Order Now" button on all pages</span>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <hr>
            
            <h2>Shortcodes</h2>
            <table class="widefat">
                <thead>
                    <tr>
                        <th>Shortcode</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>[nexus_menu]</code></td>
                        <td>Display full menu with ordering</td>
                    </tr>
                    <tr>
                        <td><code>[nexus_order]</code></td>
                        <td>Display order button only</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <?php
    }
    
    /**
     * Enqueue scripts
     */
    public function enqueue_scripts() {
        $show_button = get_option('nexus_pos_show_floating_button', '1');
        $restaurant_slug = get_option('nexus_pos_restaurant_slug', '');
        $theme = get_option('nexus_pos_theme', 'dark');
        
        if ($show_button === '1' && !empty($restaurant_slug)) {
            wp_enqueue_script(
                'nexus-pos-widget',
                'https://nexuspos.com/widget.js',
                array(),
                NEXUS_POS_VERSION,
                true
            );
            
            // Add data attributes via inline script
            wp_add_inline_script('nexus-pos-widget', 
                "document.currentScript.setAttribute('data-restaurant', '{$restaurant_slug}');
                 document.currentScript.setAttribute('data-theme', '{$theme}');",
                'before'
            );
        }
    }
    
    /**
     * Menu shortcode
     */
    public function menu_shortcode($atts) {
        $atts = shortcode_atts(array(
            'restaurant' => get_option('nexus_pos_restaurant_slug', ''),
            'theme' => get_option('nexus_pos_theme', 'dark'),
        ), $atts);
        
        if (empty($atts['restaurant'])) {
            return '<p style="color: red;">Please configure your Nexus POS restaurant slug in Settings.</p>';
        }
        
        $iframe_url = 'https://nexuspos.com/embed/' . esc_attr($atts['restaurant']) . '?theme=' . esc_attr($atts['theme']);
        
        return '<iframe 
            src="' . $iframe_url . '" 
            style="width: 100%; min-height: 700px; border: none; border-radius: 16px;" 
            loading="lazy"
            title="Nexus POS Menu"
        ></iframe>';
    }
    
    /**
     * Order widget shortcode
     */
    public function order_widget_shortcode($atts) {
        $atts = shortcode_atts(array(
            'text' => 'Order Now',
            'restaurant' => get_option('nexus_pos_restaurant_slug', ''),
            'theme' => get_option('nexus_pos_theme', 'dark'),
        ), $atts);
        
        if (empty($atts['restaurant'])) {
            return '';
        }
        
        return '<button 
            onclick="NexusPOS.open()" 
            style="background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 16px 32px; border: none; border-radius: 50px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4);"
        >' . esc_html($atts['text']) . '</button>';
    }
    
    /**
     * Register Gutenberg block
     */
    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }
        
        register_block_type('nexus-pos/menu', array(
            'render_callback' => array($this, 'menu_shortcode'),
            'attributes' => array(
                'restaurant' => array('type' => 'string', 'default' => ''),
                'theme' => array('type' => 'string', 'default' => 'dark'),
            ),
        ));
    }
}

// Initialize
NexusPOS::get_instance();
