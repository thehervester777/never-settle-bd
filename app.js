/**
 * cPanel's "Setup Node.js App" suggests app.js as the startup file and creates a placeholder with that
 * name. This one starts the store, so the app works whether the startup file is app.js or server.js.
 */
require('./server.js');
