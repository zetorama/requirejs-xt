/**
 * RequireJS X-Template Loader
 * Where X stands for Any
 *
 * Implements:
 *   - multiple templates/partials per file
 *   - templates extend
 *   - auto-loading for dependencies (templates/stylesheets/anything else)
 *
 * Dependencies:
 *   - RequireJS (what a surprise): http://requirejs.org/
 *   - RequireJS text plugin: https://github.com/requirejs/text
 *   - jQuery compatible promises, like: https://github.com/sudhirj/simply-deferred
 *
 * Details:
 *   - https://github.com/zetorama/requirejs-xt
 */

define(['require', 'module', 'text', 'deferred'], function (require, module, text, dfr) {
  'use strict';

  var VERSION = '0.1.0',
    loading = {},
    loaded = {},
    extend = function(obj, ext) {
      var prop;
      for (prop in ext) {
        obj[prop] = ext[prop];
      }

      return obj;
    },
    trim = String.prototype.trim || function() {
      // regExp from jQuery
      trim.rx || (trim.rx = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g);

      return String(this).replace(trim.rx, '');
    },
    linkPrototype = Object.create ? Object.create : (function() {
      function F() {};

      return function(parent) {
        F.prototype = parent;
        return new F();
      };
    })(),
    Deferred = dfr.Deferred || dfr,
    rx = {
      template: /<x-template\s*(.*?)>((?:.|\s)*?)<\/x-template>/g,
      require: /<x-require\s+(.*?)>/g,
      extend: /<x-extend\s+(.*?)>/g,
      include: /<x-include\s+(.*?)>/g,
      quotes: /^['"]|['"]$/g,
      spaces: /\s+/
    },

    findOccurrences = function(rx, text) {
      var result = [],
        cur;

        while ((cur = rx.exec(text)) !== null) {
          result.push({
            text: cur[0],
            options: parseAttributes(cur[1]),
            content: cur[2]
          });
        }

        return result;
    },

    parseAttributes = function(str) {
      var result = {},
        attrs = str.split(rx.spaces),
        k, attr, parts, key, val;

      for (k = attrs.length; k--;) {
        attr = attrs[k];

        parts = attr.split('=');
        key = parts.shift();
        val = parts.join('=').replace(rx.quotes, '');

        result[key] = trim.call(val);
      }

      return result;
    },
    plugin;

  plugin = {
    version: VERSION,

    moduleId: module.id,
    extension: 'html',
    templateNameDefault: 'main',
    superAliasDefault: 'super',

    extend: function(obj) {
      return extend(linkPrototype(plugin), obj);
    },

    register: function(template, required) {
      return template;
    },

    include: function(content, options) {
      return plugin.getContent(options.template, options.name, options.context);
    },

    compile: function(text, name, template) {
      return text;
    },

    get: function(url) {
      return loaded[url];
    },

    parseName: function(name, req) {
      var parts = String(name).split('!', 2),
        path = this.addExtension(parts[0]),
        options = parts[1] || '';

      return {
        path: path,
        url: req.toUrl(path),
        partial: options
      };
    },

    addExtension: function(path) {
      var hasExtension = path.lastIndexOf('.') > path.lastIndexOf('/');

      return hasExtension ? path : [path, this.extension].join('.');
    },

    parseContent: function(content) {
      var plugin = this,
        data = {
          partials: {},
          incDeps: [],
          incAliases: [],
          reqDeps: [],
          reqAliases: [],
          extendFrom: false
        },
        magicPosition = content.indexOf('<x-template'),
        parts, occurs, k, part, alias;

      if (magicPosition === -1) {
        // assume it as a simple template file
        data.partials[plugin.templateNameDefault] = content;
        return data;
      }

      // Parse content to find each template
      // Using reg-exes is pretty fast, but has some restrictions.
      // Split content in two parts to speed up,
      // So requires and extend are allowed only before templates
      parts = {
        req: content.slice(0, magicPosition),
        tpl: content.slice(magicPosition)
      };

      // 1. Find dependencies
      occurs = findOccurrences(rx.require, parts.req);
      for (k = occurs.length; k--;) {
        part = occurs[k].options;
        alias = part.alias || part.path

        if (!part.module || part.module === plugin.moduleId) {
            // re-use foreign partials
            data.incAliases.push(alias);
            data.incDeps.push(part.path);
          } else {
            data.reqAliases.push(alias);
            if (part.module === 'require') {
              // assume it as a default AMD-module
              data.reqDeps.push(part.path);
            } else {
              // prepend module name, useful for css files
              data.reqDeps.push([part.module, part.path].join('!'));
            }
          }
      }

      // 2. Is it inherited?
      occurs = findOccurrences(rx.extend, parts.req);
      if (occurs.length) {
        // Only one is allowed
        part = occurs[0].options;
        if (part.path) {
          alias = part.alias || plugin.superAliasDefault;
          data.extendFrom = alias;
          data.incAliases.push(alias);
          data.incDeps.push(part.path);
        }
      }

      // 3. Get all partials
      occurs = findOccurrences(rx.template, parts.tpl);
      for (k = occurs.length; k--;) {
        part = occurs[k];
        alias = part.options.name || plugin.templateNameDefault;
        data.partials[alias] = trim.call(part.content);
      }

      return data;
    },

    getContent: function(template, name, context) {
      var plugin = this,
        content,
        occurs, k, l, part,
        source, incContext, replace;

      if (!template.partials[name]) {
        throw 'Template "' + name + '" is not defined in file ' + template.url;
      }

      context || (context = template);
      content = template.partials[name];

      occurs = findOccurrences(rx.include, content);
      for (k = 0, l = occurs.length; k < l; k++) {
        part = occurs[k].options;
        if (!part.name) {
          throw 'Undefined name for x-include (template "' + name + '") in file ' + template.url;
        }

        if (part.from) {
          if (!context.includes[part.from]) {
            throw 'Undefined filename "' + part.from + '" ' +
            'is used for x-include (template "' + name + '") in file ' + template.url;
          }

          source = context.includes[part.from];
          incContext = (template.inherits || {}).alias === part.from ? context : source;
        } else {
          source = template;
          incContext = context;
        }

        if (!source.partials[part.name]) {
          throw 'Undefined template "' + part.name + '" ' +
            (part.from ? '(from "' + part.from + '") ' : '') +
            'is used for x-include (template "' + name + '") in file ' + template.url;
        }

        replace = plugin.include(source.partials[part.name], {
          template: source,
          alias: part.from,
          name: part.name,
          to: {
            template: template,
            name: name
          },
          context: incContext,
          params: part.params
        });

        content = content.replace(occurs[k].text, replace);
      }

      return content;
    },

    result: function(template, options) {
      var plugin = this,
        partial;
      options || (options = {});

      partial = options.partial || plugin.templateNameDefault;

      if (!template.compiled[partial]) {
        throw 'Requested template "' + partial + '" is not defined in file ' + template.url;
      }

      return template.compiled[partial];
    },

    fetchFiles: function(urls, req, config) {
      var plugin = this,
        dfr = new Deferred(),
        remain = urls.length,
        onError = function onFetchError(err) {
          var k, url;
          for (k = urls.length; k--;) {
            url = urls[k];
            if (loading[url]) {
              loading[url].reject(err);
              delete loading[url];
            }
          };

          dfr.reject(err);
        },
        checkDone = function checkFetchDone(url) {
          var files = [],
            k, l, url;

          if (!--remain) {
            for (k = 0, l = urls.length; k < l; k++) {
              url = urls[k];
              files.push(loaded[url]);
            }

            dfr.resolveWith(null, files);
          }
        },
        onLoad = function(url, content) {
          plugin.process(content, url, req, config)
            .done(function(template) {
              loaded[url] = template;

              loading[url].resolve(template);
              delete loading[url];

              checkDone(url);
            })
            .fail(onError);
        },
        getOnLoad = function(url) {
          var closure = function(content) {
            onLoad(url, content);
          };

          closure.error = onError;
          return closure;
        },
        url, k;

      for (k = remain; k--;) {
        url = urls[k];

        if (loaded[url]) {
          checkDone(url);
        } else if (loading[url]) {
          loading[url]
            .done(checkDone)
            .fail(onError);
        } else {
          loading[url] = new Deferred();
          text.load(url, req, getOnLoad(url), config);
        }
      }

      return dfr.promise();
    },

    process: function(content, url, req, config) {
      var plugin = this,
        dfr = new Deferred(),
        data = plugin.parseContent(content),

        depLoaded = !data.reqDeps.length,
        incLoaded = !data.incDeps.length,
        onError = function onProcessError(err) {
          dfr.reject(err);
        },
        checkDone = function checkProcessDone() {
          var template;

          if (!depLoaded || !incLoaded) {
            return;
          }
          try {
            template = plugin.finalize(data);
          } catch (ex) {
            onError(ex);
          } finally {
            template && dfr.resolve(template);
            data = null;
          }

        },
        incUrls = [],
        k, l, depName;

      data.url = url;

      if (depLoaded && incLoaded) {
        checkDone();
        return dfr.promise();
      }

      if (!depLoaded) {
        // Just load custom dependencies via require
        req(data.reqDeps, function() {
          var alias, k;

          // Cache deps until template is registered
          data.depMap = {};
          for (k = data.reqAliases.length; k--;) {
            alias = data.reqAliases[k];
            data.depMap[alias] = arguments[k];
          }

          depLoaded = true;
          checkDone();
        }, onError);
      }

      if (!incLoaded) {
        // Load required templates internally
        for (k = 0, l = data.incDeps.length; k < l; k++) {
          depName = data.incDeps[k];
          incUrls.push(plugin.parseName(depName, req).url);
        }
        plugin.fetchFiles(incUrls, req, config)
          .done(function() {
            var k, alias;
            // All templates are passed as arguments
            data.incMap = {};
            for (k = data.incAliases.length; k--;) {
              alias = data.incAliases[k];
              data.incMap[alias] = arguments[k];

              // Keep parent url
              if (alias === data.extendFrom) {
                data.extendUrl = incUrls[k];
              }
            }

            incLoaded = true;
            checkDone();
          })
          .fail(onError)
      }

      return dfr.promise();
    },

    finalize: function(data) {
      var plugin = this,
        template = {
          url: data.url,
          compiled: {},
          partials: {},
          includes: {},
          inherits: false
        },
        parent = data.extendFrom && data.incMap[data.extendFrom],
        name, content, compiled;

      if (parent) {
        // Extend
        template.partials = linkPrototype(parent.partials);
        template.includes = linkPrototype(parent.includes);

        template.inherits = {
          alias: data.extendFrom,
          url: data.extendUrl
        };
      }

      // Mix parts
      extend(template.partials, data.partials);
      extend(template.includes, data.incMap);

      // Compile
      for (name in template.partials) {
        content = template.partials[name];
        compiled = plugin.getContent(template, name);

        template.compiled[name] = plugin.compile(compiled, name, template);
      };

      // Sometimes you need register loaded templates,
      // Maybe you required some modules with purpose?
      plugin.register(template, data.reqMap);

      return template;
    },

    fetch: function(path, name) {
      var plugin = this,
        url = this.addExtension(path),
        dfr = new Deferred(),
        onError = function(err) {
          dfr.reject(err);
        };

      plugin.fetchFiles([url], require, {})
        .done(function(template) {
          try {
            result = plugin.result(template, {
              partial: name
            });
          } catch (ex) {
            onError(ex);
          } finally {
            result && dfr.resolve(result);
          }
        })
        .fail(onError);

      return dfr.promise();
    },

    load: function(name, req, onLoad, config) {
      var plugin = this,
        file = plugin.parseName(name, req),
        result;

      plugin.fetchFiles([file.url], req, config)
        .done(function(template) {
          try {
            result = plugin.result(template, file);
          } catch (ex) {
            onLoad.error(ex);
          } finally {
            result && onLoad(result);
          }
        })
        .fail(onLoad.error);
    },

    write: function(pluginName, moduleName, write) {
      // TODO
    }
  };

  return plugin;
});