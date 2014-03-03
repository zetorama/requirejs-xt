({
    baseUrl: 'js',
    mainConfigFile: 'js/main.js',

    removeCombined: true,
    findNestedDependencies: true,
    optimize: 'none',
    stubModules: [
      '../../engines/../xt',
      '../../engines/xt-underscore',

      'underscore',
      'text',
      'deferred',
      'css',
      'normalize',
      'css-builder'
    ],

    name: 'app',
    out: 'app-built.js'
})
