// Blue-Merle Main Module for GL-iNet SDK4 UI
(function() {
    'use strict';

    // Module registration for GL-iNet UI framework
    const blueMerleModule = {
        name: 'blue-merle',
        path: '/blue-merle',
        component: () => import('./blue-merle-component.js'),
        meta: {
            requiresAuth: true,
            title: 'Blue Merle',
            icon: 'iconfont icon-security'
        }
    };

    // Register the module with the GL-iNet router
    if (window.glRouter && window.glRouter.addRoute) {
        window.glRouter.addRoute({
            path: '/blue-merle',
            name: 'blue-merle',
            component: blueMerleModule.component,
            meta: blueMerleModule.meta
        });
    }

    // Add to applications menu
    if (window.glMenuManager && window.glMenuManager.addMenuItem) {
        window.glMenuManager.addMenuItem({
            id: 'blue-merle',
            name: 'Blue Merle',
            path: '/blue-merle',
            icon: 'iconfont icon-security',
            parent: 'applications',
            order: 100
        });
    }

    // Export module for use by the framework
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = blueMerleModule;
    } else if (typeof window !== 'undefined') {
        window.blueMerleModule = blueMerleModule;
    }
})();