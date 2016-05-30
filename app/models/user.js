var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',

  link: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      bcrypt.hash(model.get('password'), null, null, function(error, result) {
        if (!error) {
          model.set('password', result);
        } else {
          console.error('Error hashing password. Error:', error);
        }
      });
    });
  }
});

module.exports = User;