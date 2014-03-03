/**
 * Underscore-templates on RequireJS X-Template Loader
 *
 * Dependencies:
 *   - RequireJS X-Template with its dependencies
 *   - Underscore.js (or Lo-Dash.js)
 *
 * Details:
 *   - https://github.com/zetorama/requirejs-xt
 */
define(['module', '../xt', 'underscore', 'require'], function(module, xt, _, require) {

  return xt.extend({
    moduleId: module.id,

    compile: function(content, name, template) {
      return _.template(content);
    }
  });

});
