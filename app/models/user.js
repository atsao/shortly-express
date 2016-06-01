var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',

  link: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', this.setPassword);
  },
  checkPassword: function(plainTextPassword, callback) {
    bcrypt.compare(plainTextPassword, this.get('password'), function(err, matched) {
      callback(matched);
    });
  },
  setPassword: function(model, attrs, options) {
    var hasher = Promise.promisify(bcrypt.hash);

    return hasher(this.get('password'), null, null).bind(this).then(function(hashedPassword) {
      this.set('password', hashedPassword);
    });
  }
});

module.exports = User;