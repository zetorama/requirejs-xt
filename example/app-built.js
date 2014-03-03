define('text',{});
define('deferred',{});
define('../../engines/../xt',{});
define('underscore',{});
define('../../engines/xt-underscore',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});
define('normalize',{});
define('css',{load: function(id){throw new Error("Dynamic load not allowed: " + id);}});

define('css!templates/template',[],function(){});

define('../../engines/xt-underscore!templates/example',[],function() { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div>\n\t\t<h3>Example: Header</h3>\n\t<small>Partial: Test</small>\n\n\t\t<p>Base: Rendering templates is so fun!</p>\n\t\t<small>Partial: Test</small>\n\n\t\t<div class="grey-box">\n    <h3>Example: Content</h3>\n  <section>Note, base content is not used</section>\n  </div>\n\t\t<h3>Example: Footer</h3>\n\t<footer>Base: Footer</footer>\n\t</div>';
}
return __p;
};});

define('app',['xt!templates/example'], function(template) {
	

	return {
    template: template,

		render: function(el) {
			el.innerHTML = this.template();
		}
	};
});


(function(c){var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
('h3 {\n\tcolor: red;\n}\n\n.grey-box {\n  border: 1px solid #999;\n  border-radius: 2px;\n  background: #eee;\n}\n');
