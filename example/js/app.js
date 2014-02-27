define(['xt!templates/example'], function(template) {
	'use strict';

	return {
    template: template,

		render: function(el) {
			el.innerHTML = this.template;
		}
	};
});
