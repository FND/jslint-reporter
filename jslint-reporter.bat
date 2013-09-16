@ECHO OFF

REM Temporary files workaround: https://github.com/joyent/node/issues/3584

node "%~dp0\wrapper.js" ^
    >"%TEMP%"\jslint-reporter.out ^
    2>"%TEMP%"\jslint-reporter.err %*
TYPE "%TEMP%"\jslint-reporter.out
TYPE "%TEMP%"\jslint-reporter.err 1>&2
