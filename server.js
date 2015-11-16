#!/bin/env node
//  OpenShift sample Node application

//only required for react-pivot - becaouse package.json main:index.jsx - requires using node-jsx
require('node-jsx').install({extension: '.jsx'});

var express = require('express');
var fs      = require('fs');

var compression = require('compression');
var path = require('path');
var morgan = require('morgan');

var bodyParser = require('body-parser');

var React = require("react");
var pdf = require('html-pdf');
var PageRenderer  = require('react-page-renderer');
var BindingUtil = PageRenderer.BindingUtil;

//var areIntlLocalesSupported = require('intl-locales-supported');
//
//var localesMyAppSupports = [
//    'en-US','cz-CS','de-DE'
//];
//
//if (global.Intl) {
//    // Determine if the built-in `Intl` has the locale data we need.
//    if (!areIntlLocalesSupported(localesMyAppSupports)) {
//        // `Intl` exists, but it doesn't have the data we need, so load the
//        // polyfill and replace the constructors with need with the polyfill's.
//        require('intl');
//        Intl.NumberFormat   = IntlPolyfill.NumberFormat;
//        Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat;
//    }
//} else {
//    // No `Intl`, so use and load the polyfill.
//    global.Intl = require('intl');
//}

var App = require('./lib/app.js');
//var pdfRenderer = require('./lib/pdf-renderer');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;
        self.dataDir = process.env.OPENSHIFT_DATA_DIR;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
            self.dataDir = path.join(__dirname,"data");
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
            console.log('%s: Received %s - terminating sample app ...',
                Date(Date.now()), sig);
            process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
            'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
                process.on(element, function() { self.terminator(element); });
            });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };


    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();

        self.app = express();
        self.app.use(bodyParser.json());
        self.app.use(function (req, res, next) {

            // Website you wish to allow to connect
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Request methods you wish to allow
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

            // Request headers you wish to allow
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

            // Set to true if you need the website to include cookies in the requests sent
            // to the API (e.g. in case you use sessions)
            res.setHeader('Access-Control-Allow-Credentials', true);

            // Pass to next layer of middleware
            next();
        });

        //self.app.use(compression);
        self.app.use(morgan('combined'));
        self.app.use(express.static(path.join(__dirname, 'sites')));
        //self.app.use('/data', express.static(self.dataDir));
        //self.app.use('/assets', express.static('assets'));
        //self.app.use('/designer', express.static('designer'));
        //self.app.use('/publisher', express.static('publisher'));
        //self.app.use(express.static(path.join(__dirname, 'dist')));


        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }


        var generateBinary = function(req,res,type){

            var schema = req.body;
            var schemaName = schema.name;

            //take send data or fallback to default data
            var data = schema.data || schema.props.defaultData;

            //obtain default page options
            var defaultPageSizes = PageRenderer.GraphicUtil.PageSizes[schema.props.defaultPageSize || 'A4'];
            var defaultPageOptions = {height:defaultPageSizes[1], width:defaultPageSizes[0]};

            //take send page options or fallback to default page options
            var pageOptions = schema.pageOptions || defaultPageOptions;
            console.log("L:" + schema.data);
            console.log("Data:" + JSON.stringify(data));
            BindingUtil.bindToSchemaAsync(schema,data).then(function(response){

                var html = React.renderToStaticMarkup(React.createElement(App, {schema: response,pageOptions:pageOptions,data:data}));


                var options = {type:type};
                options.zoomFactor = type === "pdf"?1.4:1.0;

                if (pageOptions.height !== undefined){
                    options.height = Math.round(PageRenderer.GraphicUtil.pointToPixel(pageOptions.height)) * 1.4;
                }
                if (pageOptions.width !== undefined){
                    options.width = Math.round(PageRenderer.GraphicUtil.pointToPixel(pageOptions.width)) * 1.4;
                }


                pdf.create(html, options).toBuffer(function (err, buffer) {
                    res.contentType(type == 'pdf'?"application/pdf":"image/" + type);
                    res.send(buffer);
                    console.log(schemaName + " generation finished");
                });
            }, function(error){console.log(error)})
        };

        self.app.post('/pdf', function(req, res) {
            generateBinary(req,res,'pdf');
        });
        self.app.post('/png', function(req, res) {
            generateBinary(req,res,'png');
        });
        self.app.post('/jpeg', function(req, res) {
            generateBinary(req,res,'jpeg');
        });
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

