define('text',{});
define('deferred',{});
define('xt',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('normalize',{});
define('css',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});

define('css!templates/template',[],function(){});

define('xt!templates/example',[],function () { return '<div>\n\t\t<h3>Example: Header</h3>\n\t<small>Partial: Test</small>\n\n\t\t<p>Base: Rendering templates is so fun!</p>\n\t\t<small>Partial: Test</small>\n\n\t\t<div class="grey-box">\n    <h3>Example: Content</h3>\n  <section>Note, base content is not used</section>\n  </div>\n\t\t<h3>Example: Footer</h3>\n\t<footer>Base: Footer</footer>\n\t</div>';});

define('app',['xt!templates/example'], function(template) {
	

	return {
    template: template,

		render: function(el) {
			el.innerHTML = this.template;
		}
	};
});


(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
('h3 {\n\tcolor: red;\n}\n\n.grey-box {\n  border: 1px solid #999;\n  border-radius: 2px;\n  background: #eee;\n}\n');
