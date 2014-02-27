'use strict';

requirejs.config({
  baseUrl: 'js',
	paths: {
		'xt': '../../xt',
    'templates': '../templates'
	}
});


require(['app'], function(app) {
  console.info('App is loaded');

  var el = document.getElementById('example');
  app.render(el);
});
