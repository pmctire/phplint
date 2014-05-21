'use strict';

var fs = require('fs');
var _ = require('lodash');
var glob = require('glob');
var async = require('async');
var cacheSwap = require('cache-swap');
var crypto = require('crypto');
var shell = require('shelljs/global');

var SWAP_CATEGORY = "linted";

var swap = new cacheSwap({
  tmpDir: require('os').tmpDir(),
  cacheDirName: 'node-phplint'
});

var checkCached = function(filePath, done) {
  fs.readFile(filePath, function(err, contents) {
    if (err) return done(err);

    var sha1 = crypto.createHash("sha1"),
    fileHash = sha1.update(contents.toString()).digest("hex");

    swap.hasCached(SWAP_CATEGORY, fileHash, function(isCached, cachedPath) {
      done(null, isCached, fileHash);
    });
  });
};

var linter = function (file, cb) {
  checkCached(file, function(err, isCached, hash) {
    if (err) return cb(err);

    process.stdout.write('.');

    if (isCached) return cb();

    exec('php -l '+file, {silent: true}, function (code, output) {

      var err = (code === 0) ? null : output.trim();

      if (err) return cb(err);

      swap.addCached(SWAP_CATEGORY, hash, "", function(err) {
        if (err) return cb(err);
        cb();
      });
    });
  });
};

var processPatterns = function (patterns) {
  var result = [];

  if (_.isString(patterns)) {
    patterns = [patterns];
  }

  _.each(patterns, function (pattern) {
    var exclusion = pattern.indexOf('!') === 0;

    if (exclusion) {
      pattern = pattern.slice(1);
    }

    var matches = glob.sync(pattern);

    if (exclusion) {
      result = _.difference(result, matches);
    } else {
      result = _.union(result, matches);
    }
  });

  return result;
};

module.exports = function (patterns, cb) {
  var result = processPatterns(patterns);

  async.eachLimit(result, 10, linter, function (err) {
    if (err) return cb(err);

    cb();
  });
};
