#!/usr/bin/env node

var fs      = require('fs');
var request = require('request');
var jsdom   = require('jsdom')
var url     = require('url');
var program = require('commander');
var sys     = require('sys')
var exec    = require('child_process').exec;
var async   = require('async');

program.version('0.0.1')
  .usage('[options] <url>')
  .option('-f, --filename <s>', 'destination filename (default: merge.pdf)')
  .parse(process.argv);

var endpoint = program.args[0];
var filename = program.filename || 'merge.pdf';

var request = request.defaults({jar: true});
request.get({
  url: endpoint
}, function(err, response, body){
  if(err && response.statusCode !== 200){
    console.log('Request error.');
  }

  jsdom.env({
    html: body,
    scripts: ['http://code.jquery.com/jquery.js'],
    done: collectItemsFromPage
  });
});

var items = [];
var collectItemsFromPage = function(err, window){
  var $ = window.jQuery;
  var host = url.parse(endpoint).host;

  $('a').each(function() {
    var path = $(this).attr('href');
    if (!/pdf/gi.test(path)) {
      return;
    }

    var fileName = /\/([\d\w\.]*)$/.exec(path);
    if(!fileName){
      return;
    }

    items.push({
      url: host + path,
      name: fileName[1] + '.pdf'
    });
  });

  async.forEach(items, dl, function(err, ok){
    merge();
  });
};

var count = 0;
var dl = function(obj) {
  request('http://' + obj.url)
    .on('end', function() {
      console.log('dl ' + obj.name);

      if (++count !== items.length) {
        return;
      }

      merge();
    })
    .pipe(fs.createWriteStream(obj.name));
};

var cmd = "gs -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOutputFile=" + filename;
var merge = function() {
  items.forEach(function(item) {
    cmd += " " + item.name;
  });

  console.log('merge files');
  var child = exec(cmd, function (error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    console.log('stderr: ' + stderr);
    if (error !== null) {
      console.log('exec error: ' + error);
    }
  });
};
