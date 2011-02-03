var sys = require("sys"); // XXX: renamed in Node.js v0.3.0
var fs = require("fs");
var vm;
try {
	vm = require("vm");
} catch(exc) { // Node.js v0.2
	vm = process.binding("evals").Script;
}

JSLINT_PATH = __dirname + "/fulljslint.js";

var main = function(args) {
	var valueOptions = ["indent", "maxerr", "maxlen"];
	args = parseOptions(args, valueOptions);
	var opts = args.opts;
	args = args.anon; // XXX: variable reuse messy!?

	if(opts.upgrade) {
		getJSLint(function(contents) {
			fs.writeFileSync(JSLINT_PATH, contents)
			exit(true);
		});
		return;
	}

	// The Good Parts
	if(opts.goodparts) {
		delete opts.goodparts;
		opts.white = true;
		opts.onevar = true;
		opts.undef = true;
		opts.newcap = true;
		opts.nomen = true;
		opts.regexp = true;
		opts.plusplus = true;
		opts.bitwise = true;
	}

	// TODO: post-process valueOptions (integers, arrays)
	sys.debug("JSLint options: " + sys.inspect(opts)); // XXX: optional?

	var filepath = args[0]; // TODO: support for multiple files
	var src = fs.readFileSync(filepath, "utf-8");
	var jslint = fs.readFileSync(JSLINT_PATH, "utf-8");

	var sandbox = {
		SRC: src,
		OPTS: opts
	};
	vm.runInNewContext(jslint + "\nJSLINT(SRC, OPTS);", sandbox);

	var errors = sandbox.JSLINT.errors;
	var pass = errors.length == 0;

	if(!pass) {
		errors = formatOutput(errors, filepath);
		sys.print(errors.join("\n") + "\n");
	}

	exit(pass);
};

var getJSLint = function(callback) {
	var host = "github.com";
	var path = "/douglascrockford/JSLint/raw/master/fulljslint.js";
	var http = require("http");
	var client = http.createClient(443, host, true);
	var request = client.request("GET", path, { "host": host });
	request.end();
	request.on("response", function(response) {
		if(response.statusCode != 200) {
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

var formatOutput = function(errors, filepath) {
	var lines = [];
	var i;
	for(i = 0; i < errors.length; i++) {
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
	var i;
	for(i = 2; i < args.length; i++) {
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

var exit = function(status, msg) {
	if(msg) {
		sys.debug(msg);
	}
	process.exit(status ? 0 : 1);
};

main(process.argv);
