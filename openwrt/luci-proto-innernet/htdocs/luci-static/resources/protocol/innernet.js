'use strict';
'require form';
'require network';

return network.registerProtocol('innernet', {
	getI18n: function () {
		return _('innernet');
	},

	getIfname: function () {
		return this._ubus('l3_device') || this.sid;
	},

	getPackageName: function () {
		return 'innernet';
	},

	isFloating: function () {
		return true;
	},

	isVirtual: function () {
		return true;
	},

	getDevices: function () {
		return null;
	},

	containsDevice: function (ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function (s) {
		var o;

		o = s.taboption('general', form.DummyValue, '_innernet_note', _('Note'));
		o.rawhtml = true;
		o.value = _('This interface is brought up and kept alive by the innernet daemon, ' +
			'configured via <code>/etc/config/innernet</code> and managed by ' +
			'<code>/etc/init.d/innernet</code> -- there is nothing to configure here. ' +
			'The interface name above must match a <code>network</code> section name ' +
			'in <code>/etc/config/innernet</code>.');
	}
});
