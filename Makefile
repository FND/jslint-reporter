.PHONY: jslint

jslint:
	{ \
		curl -s https://github.com/douglascrockford/JSLint/raw/master/fulljslint.js; \
		echo "module.exports.JSLINT = JSLINT;"; \
	} > jslint.js
