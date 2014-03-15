/*jslint vars: true, nomen: true, node: true, white: true */

"use strict";

var fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	util = require("util");

var VERSION = "1.3.1";
var LINT = {
	name: "JSLint",
	filename: "jslint.js",
	root: "JSLINT",
	source: {
		scheme: "https",
		host: "raw.github.com",
		path: "/douglascrockford/JSLint/master/jslint.js"
	}
};

var getJSLint, formatOutput, transformWarning, parseOptions, supplant, exit;

var main = function(args) {
	args = args.slice(2); // ignore Node command and script file
	var opts = parseOptions(args);
	var anon = opts.anon;
	opts = opts.opts;

	if(opts.jshint) {
		delete opts.jshint;
		LINT.name = "JSHint";
		LINT.filename = "jshint.js";
		LINT.root = "JSHINT";
		LINT.source.path = "/jshint/jshint/2.x/dist/jshint.js";
	}
	LINT.path = path.join(__dirname, LINT.filename);

	var verbose = false;
	if(opts.verbose) {
		delete opts.verbose;
		verbose = true;
	}
	if(opts.help || args.length === 0) {
		var readme = fs.readFileSync(path.join(__dirname, "README"), "utf-8");
		exit(args.length > 0, readme);
	}
	if(opts.upgrade) {
		getJSLint(function(contents) {
			fs.writeFileSync(LINT.path, contents);
			main([null, null, "--version"]); // XXX: hacky!?
			exit(true);
		});
		return;
	}

	var jslint;
	try {
		jslint = fs.readFileSync(LINT.path, "utf-8");
	} catch(exc) {
		exit(false, "ERROR: " + LINT.path + " not found - " +
				"use `--upgrade` to initialize");
	}

	if(opts.version) {
		var sandbox = {};
		vm.runInNewContext(jslint, sandbox);
		exit(true, "JSLint Reporter v" + VERSION + "\n" +
				LINT.name + " v" + sandbox[LINT.root].edition);
	}

	if(verbose) {
		process.stderr.write("JSLint options: " + util.inspect(opts) + "\n");
	}

	var doLint = function(filepath) {
		var src = fs.readFileSync(filepath, "utf-8");
		var sandbox = {
			SRC: src,
			OPTS: opts
		};
		var code = LINT.root + "(SRC, OPTS); var data = " + LINT.root + ".data();";
		vm.runInNewContext(jslint + "\n" + code, sandbox);

		var data = sandbox.data;
		var implied = (data.implieds || []).map(function(item) {
			return transformWarning(item, "implied global");
		});
		var unused = (data.unused || []).map(function(item) {
			return transformWarning(item, "unused variable");
		});
		return (data.errors || []).concat(implied).concat(unused);
	};

	var errors = [];
	var i;
	for(i = 0; i < anon.length; i += 1) {
		var filepath = anon[i];
		var err = doLint(filepath);
		err = formatOutput(err, filepath, opts.format);
		errors = errors.concat(err);
	}
	var pass = errors.length === 0;

	if(!pass) {
		console.log(errors.join("\n") + "\n");
		if(verbose) {
			process.stderr.write(String(errors.length) + " errors\n");
		}
	}

	exit(pass);
};

getJSLint = function(callback) {
	var https = require(LINT.source.scheme);
	var options = {
		host: LINT.source.host,
		path: LINT.source.path
	};
	https.get(options, function(response) {
		if(response.statusCode !== 200) {
			exit(false, "failed to retrieve JSLint file");
		}
		response.setEncoding("utf8");
		var body = [];
		response.on("data", function(chunk) {
			body.push(chunk);
		});
		response.on("end", function() {
			callback(body.join(""));
		});
	});
};

// `format` is an optional string with the following placeholders:
// {f}: file
// {l}: line
// {c}: character
// {m}: message
formatOutput = function(errors, filepath, format) {
	format = format || "{f}:{l}:{c}:{m}";
	var lines = [];
	var i;
	for(i = 0; i < errors.length; i += 1) {
		var error = errors[i];
		if(error) { // last item might be null (if linting was aborted)
			var line = supplant(format, {
				f: filepath,
				l: error.line,
				c: error.character,
				m: error.reason
			});
			lines.push(line);
		}
	}
	return lines;
};

// generate an error (line, character, reason) from a warning (line, name)
transformWarning = function(item, prefix) {
	return {
		line: item.line,
		character: 0,
		reason: prefix + ": " + item.name
	};
};

parseOptions = function(args) {
	var opts = {};
	var anon = [];
	var i;
	for(i = 0; i < args.length; i += 1) {
		var arg = args[i];
		if(arg.indexOf("--") === 0) {
			arg = arg.substr(2);
			if(arg.indexOf("=") === -1) {
				opts[arg] = true;
			} else {
				var pair = arg.split("="); // NB: assumes exactly one "="
				var name = pair[0];
				var value = pair[1];

				// infer value type
				if(value === "false") {
					value = false;
				}
				switch(name) { // XXX: special-casing JSLint-specifics
				case "indent":
				case "maxerr":
				case "maxlen":
					value = parseInt(value, 10);
					break;
				case "predef":
					value = value.split(",");
					break;
				default:
					break;
				}

				opts[name] = value;
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

// adapted from Crockford:
// http://javascript.crockford.com/remedial.html
supplant = function(str, params) {
	return str.replace(/\{([^{}]*)\}/g, function(placeholder, key) {
		var sub = params[key];
		return (typeof sub === "string" || typeof sub === "number") ?  sub :
				placeholder;
	});
};

exit = function(status, msg) {
	if(msg) {
		process.stderr.write(msg + "\n");
	}
	try {
		process.stdout.flush(); // required for legacy support (Node <0.5)?
	} catch(exc) {}
	process.exit(status ? 0 : 1);
};

main(process.argv);
