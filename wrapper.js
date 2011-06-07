/*jslint node: true, nomen: false */

var fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	util = require("util");

var JSLINT_PATH = path.join(__dirname, "jslint.js");

var getJSLint, formatOutput, transformWarning, parseOptions, exit;

var main = function(args) {
	args = args.slice(2); // ignore Node command and script file
	var opts = parseOptions(args);
	var anon = opts.anon;
	opts = opts.opts;

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
			fs.writeFileSync(JSLINT_PATH, contents);
			main([null, null, "--version"]); // XXX: hacky!?
			exit(true);
		});
		return;
	}

	var jslint = fs.readFileSync(JSLINT_PATH, "utf-8");

	if(opts.version) {
		var pkgFile = path.join(__dirname, "package.json");
		var version = JSON.parse(fs.readFileSync(pkgFile, "utf-8")).version;
		var sandbox = {};
		vm.runInNewContext(jslint, sandbox);
		exit(true, "JSLint Reporter v" + version + "\n" +
			"JSLint v" + sandbox.JSLINT.edition);
	}

	// The Good Parts
	if(opts.goodparts) {
		delete opts.goodparts;
		var goodparts = ["white", "onevar", "undef", "newcap", "nomen",
			"regexp", "plusplus", "bitwise"];
		goodparts.forEach(function(item, i) {
			opts[item] = opts[item] !== false ? true : false;
		});
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
		var code = "JSLINT(SRC, OPTS); var data = JSLINT.data();";
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
		err = formatOutput(err, filepath);
		errors = errors.concat(err);
	}
	var pass = errors.length === 0;

	if(!pass) {
		util.print(errors.join("\n") + "\n");
		if(verbose) {
			process.stderr.write(errors.length + " errors\n");
		}
	}

	exit(pass);
};

getJSLint = function(callback) {
	var https = require("https");
	var options = {
		host: "github.com",
		path: "/douglascrockford/JSLint/raw/master/jslint.js"
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
			body = body.join("");
			callback(body);
		});
	});
};

formatOutput = function(errors, filepath) {
	var lines = [];
	var i;
	for(i = 0; i < errors.length; i += 1) {
		var error = errors[i];
		if(error) { // last item might be null (if linting was aborted)
			var line = [filepath, error.line, error.character, error.reason].
				join(":");
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

exit = function(status, msg) {
	if(msg) {
		process.stderr.write(msg + "\n");
	}
	process.exit(status ? 0 : 1);
};

if(!module.parent) { // executed directly
	main(process.argv);
} else { // imported
	exports.main = main;
	exports.exit = exit;
}
