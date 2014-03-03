'use strict';

requirejs.config({
  baseUrl: './js',
	paths: {
    'templates': '../templates'
	},
  map: {
    '*': {
      'xt': '../../engines/xt-underscore'
    }
  }
});


require(['app'], function(app) {
  console.info('App is loaded');

  var el = document.getElementById('example');
  app.render(el);
});
