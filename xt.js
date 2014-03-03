/**
 * RequireJS X-Template Loader
 * Where X stands for Any
 *
 * This is a Base Class. You most likely need some extension over it
 *
 * Implements:
 *   - multiple templates/partials per file
 *   - templates extend
 *   - templates wrappers
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

  var VERSION = '0.2.4',
    moduleId = module.id,
    config = module.config() || {},
    loading = {},
    loaded = {},

    Deferred = dfr.Deferred || dfr,
    rxMap = {
      template: /<x-template\s*(.*?)>((?:.|\s)*?)<\/x-template>/g,
      wrapper: /<x-wrapper\s*(.*?)>((?:.|\s)*?)<\/x-wrapper>/g,
      require: /<x-require\s+(.*?)>/g,
      extend: /<x-extend\s+(.*?)>/g,
      include: /<x-include\s+(.*?)>/g,
      content: /<x-content>/g,
      quotes: /^['"]|['"]$/g,
      spaces: /\s+/
    },
    trim = String.prototype.trim || function trim() {
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

    extend = function(obj, ext) {
      var prop;
      for (prop in ext) {
        obj[prop] = ext[prop];
      }

      return obj;
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
        attrs = str.split(rxMap.spaces),
        k, attr, parts, key, val;

      for (k = attrs.length; k--;) {
        attr = attrs[k];

        parts = attr.split('=');
        key = parts.shift();
        val = parts.join('=').replace(rxMap.quotes, '');

        result[key] = trim.call(val);
      }

      return result;
    },
    plugin;

  plugin = {
    version: VERSION,

    isBuild: false,

    moduleId: moduleId,
    extension: config.extension || 'html',
    defaultPartialName: config.defaultPartialName || 'main',
    defaultParentAlias: config.defaultParentAlias || 'super',

    extend: function(obj) {
      return extend(linkPrototype(this), obj);
    },

    register: function(template, required) {
      return template;
    },

    include: function(content, options) {
      return plugin.getContent(options.template, options.name, options.context);
    },

    compile: function(content, name, template) {
      // For example make it a simple function
      var plugin = this,
        compiled = function() {
          return content;
        };

      if (plugin.isBuild) {
        compiled.source = "function() { return '" + text.jsEscape(content) + "'; }";
      }

      return compiled;
    },

    get: function(id, partialName) {
      var plugin = this,
        template = loaded[id],
        result;

      if (!template) {
        throw 'Requested template file was not loaded: ' + template.id;
      }

      partialName || (partialName = plugin.defaultPartialName);
      result = template.compiled[partialName];

      if (!result) {
        throw 'Requested template "' + partialName + '" is not defined in file ' + template.id;
      }

      return result;
    },

    parseName: function(name) {
      var plugin = this,
        parts = String(name).split(':', 2),
        name = parts[0],
        file = plugin.addExtension(name),
        partialName = parts[1] || '';

      return {
        name: name,
        file: file,
        partial: partialName
      };
    },

    addExtension: function(path) {
      var plugin = this,
        hasExtension = path.lastIndexOf('.') > path.lastIndexOf('/');

      return hasExtension ? path : [path, this.extension].join('.');
    },

    resolveRelativePath: function(path, parentFile, config) {
      // TODO: use some requirejs API when available
      var parent = parentFile.split('/'),
        dirs = path.split('/');
      parent.pop();
      parent = parent.join('/');

      if (dirs[0] === '.') {
        // The same dir
        dirs.shift();
        return [parent, dirs.join('/')].join('/');
      } else if (dirs[0] === '..') {
        // Parent dir should be normalized later
        return [parent, dirs.join('/')].join('/');
      }

      // NOTE: currently only relative paths are supported
      // Everything else should be supported VIA requirejs' paths config

      return path;
    },

    makeId: function(url, req, config) {
      return req.toUrl(url);
    },

    getContent: function(template, name, context) {
      var plugin = this,
        content,
        wrapper, wrapName,
        occurs, k, l, part,
        source, incContext, replace;

      if (!template.partials[name]) {
        throw 'Template "' + name + '" is not defined in file ' + template.id;
      }

      context || (context = template);
      content = template.partials[name];
      wrapName = template.wrapMap[name];

      // Check wrapper
      if (wrapName) {
        wrapper = template.wrappers[wrapName];
        if (!wrapper) {
          throw 'Template "' + name + '" uses unknown wrapper "' + wrapName + '" in file ' + template.id;
        }

        content = wrapper.replace(rxMap.content, content);
      }

      // Find includes
      occurs = findOccurrences(rxMap.include, content);
      for (k = 0, l = occurs.length; k < l; k++) {
        part = occurs[k].options;
        if (!part.name) {
          throw 'Undefined name for x-include (template "' + name + '") in file ' + template.id;
        }

        if (part.from) {
          if (!context.includes[part.from]) {
            throw 'Undefined filename "' + part.from + '" ' +
            'is used for x-include (template "' + name + '") in file ' + template.id;
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
            'is used for x-include (template "' + name + '") in file ' + template.id;
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
        partialName = (options || {}).partial || plugin.defaultPartialName;

      return plugin.get(template.id, partialName);
    },

    fetchFiles: function(urls, req, config) {
      var plugin = this,
        dfr = new Deferred(),
        remain = urls.length,
        ids = {},
        onError = function onFetchError(err) {
          var k, url, id;
          for (k = urls.length; k--;) {
            url = urls[k];
            id = ids[url];
            if (loading[id]) {
              loading[id].reject(err);
              delete loading[id];
            }
          };

          dfr.reject(err);
        },
        checkDone = function checkFetchDone() {
          var files = [],
            k, l, url, id;

          if (!--remain) {
            for (k = 0, l = urls.length; k < l; k++) {
              url = urls[k];
              id = ids[url];
              files.push(loaded[id]);
            }

            dfr.resolveWith(null, files);
          }
        },
        onLoad = function(url, content) {
          var id = ids[url],
            data = plugin.parseContent(content, url, req, config);

          data.id = id;

          plugin.process(data, req, config)
            .done(function(template) {
              loaded[id] = template;

              loading[id].resolve(template);
              delete loading[id];

              checkDone(id);
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
        url, id, k;

      for (k = remain; k--;) {
        url = urls[k];
        id = plugin.makeId(url, req, config);
        ids[url] = id;

        if (loaded[id]) {
          checkDone();
        } else if (loading[id]) {
          loading[id]
            .done(checkDone)
            .fail(onError);
        } else {
          loading[id] = new Deferred();
          text.load(url, req, getOnLoad(url), config);
        }
      }

      return dfr.promise();
    },

    parseContent: function(content, url, req, config) {
      var plugin = this,
        data = {
          url: url,
          partials: {},
          wrappers: {},
          wrapMap: {},
          incDeps: [],
          incAliases: [],
          reqDeps: [],
          reqAliases: [],
          extendFrom: false
        },
        magicPosition = content.indexOf('<x-template'),
        parts, occurs, k, part, alias, path;

      if (magicPosition === -1) {
        // assume it as a simple template file
        data.partials[plugin.defaultPartialName] = content;
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
      occurs = findOccurrences(rxMap.require, parts.req);
      for (k = occurs.length; k--;) {
        part = occurs[k].options;
        alias = part.alias || part.path;

        if (!part.module || part.module === plugin.moduleId) {
            // re-use foreign partials
            data.incAliases.push(alias);
            path = plugin.resolveRelativePath(part.path, url, config);
            path = plugin.addExtension(path);
            data.incDeps.push(path);
          } else {
            data.reqAliases.push(alias);
            path = plugin.resolveRelativePath(part.path, url, config);
            if (part.module === 'require') {
              // assume it as a default AMD-module
              data.reqDeps.push(path);
            } else {
              // prepend module name, useful for css files
              data.reqDeps.push([part.module, path].join('!'));
            }
          }
      }

      // 2. Is it inherited?
      occurs = findOccurrences(rxMap.extend, parts.req);
      if (occurs.length) {
        // Only one is allowed
        part = occurs[0].options;
        if (part.path) {
          alias = part.alias || plugin.defaultParentAlias;
          data.extendFrom = alias;
          data.incAliases.push(alias);
          path = plugin.resolveRelativePath(part.path, url, config);
          path = plugin.addExtension(path);
          data.incDeps.push(path);
        }
      }

      // 3. Get all partials
      occurs = findOccurrences(rxMap.template, parts.tpl);
      for (k = occurs.length; k--;) {
        part = occurs[k];
        alias = part.options.name || plugin.defaultPartialName;
        data.partials[alias] = trim.call(part.content);

        if (part.options.wrapper) {
          data.wrapMap[alias] = part.options.wrapper;
        }
      }

      // 4. Find wrappers
      occurs = findOccurrences(rxMap.wrapper, parts.tpl);
      for (k = occurs.length; k--;) {
        part = occurs[k];
        alias = part.options.name || plugin.defaultPartialName;
        data.wrappers[alias] = trim.call(part.content);
      }

      return data;
    },

    process: function(data, req, config) {
      var plugin = this,
        dfr = new Deferred(),

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

      // console.log('process template "%s": %o', data.id, data);

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
        plugin.fetchFiles(data.incDeps, req, config)
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
          id: data.id,
          compiled: {},
          partials: {},
          includes: {},
          wrappers: {},
          wrapMap: data.wrapMap,
          inherits: false
        },
        parent = data.extendFrom && data.incMap[data.extendFrom],
        name, content, compiled;

      if (parent) {
        // Extend
        template.partials = linkPrototype(parent.partials);
        template.includes = linkPrototype(parent.includes);
        template.wrappers = linkPrototype(parent.wrappers);

        template.inherits = {
          alias: data.extendFrom,
          url: data.extendUrl
        };
      }

      // Mix parts
      extend(template.partials, data.partials);
      extend(template.includes, data.incMap);
      extend(template.wrappers, data.wrappers);

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

            dfr.resolve(result);
          } catch (ex) {
            onError(ex);
          }
        })
        .fail(onError);

      return dfr.promise();
    },

    load: function(name, req, onLoad, config) {
      var plugin = this,
        resource = plugin.parseName(name),
        result;

      plugin.isBuild = config.isBuild;

      plugin.fetchFiles([resource.file], req, config)
        .done(function(template) {
          try {
            result = plugin.result(template, resource);

            if (plugin.isBuild) {
              plugin.cacheForBuild(name, result);
            }

            onLoad(result);
          } catch (ex) {
            onLoad.error(ex);
          }
        })
        .fail(onLoad.error);
    },

    normalize: function(name, normalize) {
      var plugin = this,
        extLength = plugin.extension.length + 1;

      if (name.indexOf('.'+ plugin.extension) === name.length - extLength) {
        name = name.substr(0, name.length - 4);
      }

      return normalize(name);
    },

    write: function(pluginName, moduleName, write) {
      var plugin = this,
        content = plugin.extractForBuild(moduleName),
        def;

      console.info('XT-WRITE:', pluginName, plugin.moduleId);

      if (content) {
          def = "define(function() { return "
            + plugin.escapeForWrite(content)
            + ";});\n";

          write.asModule(pluginName + "!" + moduleName, def);
      }
    },

    cacheForBuild: function(name, result) {
      var plugin = this;
      plugin.buildMap || (plugin.buildMap = {});

      plugin.buildMap[name] = result;
    },

    extractForBuild: function(name) {
      var plugin = this;
      return plugin.buildMap && plugin.buildMap[name];
    },

    escapeForWrite: function(content) {
      return content.source;
    }
  };

  return plugin;
});
