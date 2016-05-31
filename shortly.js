var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'nyancat'}));

app.get('/', function(req, res) {
  if (req.session.username) {
    res.render('index');
  } else {
    console.log("access restricted, no session username set.");
    res.redirect('/login');
  }
});

app.get('/create', function(req, res) {
  if (req.session.username) {
    res.render('index');
  } else {
    console.log("access restricted, no session username set.");
    res.redirect('/login');
  }
  // res.render('index');
});

app.get('/links', function(req, res) {
  var username = req.session.username;
  var userId;
  
  if (username) {
    db.knex('users').where('username', '=', username).then(function(row) {
      console.log("row: ", row);
      userId = row[0].id;
      Links.reset().query('where', 'user_id', '=', userId).fetch().then(function(links) {
        console.log('links.models:', links.models);
        res.send(200, links.models);
      });
    });
  } else {
      console.log("access restricted, no session username set.");
      // res.send(401, links.models);
      res.redirect('/login');
    }
});

app.post('/links', function(req, res) {
  var uri = req.body.url;
  var username = req.session.username;
  var userId;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        db.knex('users').where('username', '=', username).then(function(row) {
          userId = row[0].id;
          var link = new Link({
            url: uri,
            title: title,
            base_url: req.headers.origin,
            user_id: userId
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });

      });
    }
  });
});

/************************************************************/
// Write your dedicated authentication routes here
// e.g. login, logout, etc.
/************************************************************/

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {

  var username = req.body.username;
  var password = req.body.password;

  db.knex('users')
    .where('username', '=', username).then(function(row) {
      console.log("empty array truthy?: ", [] == true);
      console.log("row: ", row.length);
      if (row.length) {
        var savedPassword = row[0].password;
        if (password === savedPassword) {
          console.log("you are valid! (plain text)");
          req.session.username = req.body.username;
          res.redirect('/');
        } else {
          bcrypt.compare(password, savedPassword, function(err, pwCorrect) {
            if (pwCorrect) {
              console.log("you are valid! (hashed)");
              req.session.username = req.body.username;
              res.redirect('/');
            } else {
              console.log("password did not match");
              res.redirect('login');
              // window.alert('Incorrect password!'); // ???
              // res.end();
            }
          });
        }
      } else {
        res.redirect('/login');
      }
    });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  // Will need to verify where the username and password are in request
  // Just a guess!
  var username = req.body.username;
  var password = req.body.password;

  bcrypt.hash(password, null, null, function(err, hash) {
    new User({ username: username}).fetch().then(function(found) {
      if (found) {
        // Send error saying username already exists
        console.error('Username already exists!');
      } else {
        console.log('username was not found (create a new one)')
        var user = new User({
          username: username,
          password: hash
        });

        user.save().then(function(newUser) {
          Users.add(newUser);
          res.send(200, newUser.username);
          res.redirect('/');
        })
      }
    });
    
  });


});

app.get('/logout', function(req, res) {
  req.session.destroy(function(err){
    if (!err) {
      res.render('login');
    } else {
      console.error('error destroying session: ', err);
    }
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
