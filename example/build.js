({
    baseUrl: 'js',
    mainConfigFile: 'js/main.js',

    removeCombined: true,
    findNestedDependencies: true,
    optimize: 'none',
    stubModules: ['text', 'xt', 'deferred', 'css', 'normalize', 'css-builder'],

    name: 'app',
    out: 'app-built.js'
})
