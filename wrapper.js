// Node.js wrapper for JSLint
//
// Usage:
//   $ node wrapper.js [options] filepath

var sys = require("sys"); // XXX: renamed in Node.js v0.3.0
var fs = require("fs");
var JSLINT = require(__dirname + "/jslint.js").JSLINT;

var main = function(args) {
	var valueOptions = ["indent", "maxerr", "maxlen"];
	args = parseOptions(args, valueOptions);
	// TODO: post-process valueOptions (integers, arrays)
	var filepath = args.anon[0]; // TODO: support for multiple files
	var src = fs.readFileSync(filepath, "utf-8"); // XXX: UTF-8 always suitable?
	var pass = JSLINT(src, args.opts);
	if(!pass) {
		var errors = formatOutput(JSLINT.errors, filepath);
		sys.print(errors.join("\n") + "\n");
	}
};

var formatOutput = function(errors, filepath) {
	var lines = [];
	for(var i = 0; i < errors.length; i++) {
		var error = errors[i];
		if(error) { // last item might be null (if linting was aborted)
			var line = [filepath, error.line, error.character, error.reason].
				join(":");
			lines.push(line);
		}
	}
	return lines;
};

var parseOptions = function(args, valueOptions) { // XXX: rename valueOptions argument -- TODO: use dedicated third-party module
	var opts = {};
	var anon = [];
	for(var i = 2; i < args.length; i++) {
		var arg = args[i];
		if(arg.indexOf("--") == 0) {
			var name = arg.substr(2);
			if(valueOptions.indexOf(name) != -1) {
				i++;
				opts[name] = args[i];
			} else {
				opts[name] = true;
			}
		} else {
			anon.push(arg);
		}
	}
	return {
		opts: opts,
		anon: anon
	};
};

main(process.argv);
