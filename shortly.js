var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');

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
  res.render('index');
});

app.get('/links', function(req, res) {
  if (req.session.username) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  } else {
    console.log("access restricted, no session username set.");
    // res.send(401, links.models);
    res.redirect('/login');
  }
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

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

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
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
  req.session.username = req.body.username;
  console.log("req.session: ", req.session);
  res.redirect('index');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  // Will need to verify where the username and password are in request
  // Just a guess!
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username}).fetch().then(function(found) {
    if (found) {
      // Send error saying username already exists
      console.error('Username already exists!');
    } else {
      console.log('username was not found (create a new one)')
      var user = new User({
        username: username,
        password: password
      });

      user.save().then(function(newUser) {
        Users.add(newUser);
        res.send(200, newUser.username);
        res.redirect('index');
      })
    }
  });

});

app.get('/logout', function(req, res) {
  req.session.destroy(function(err){
    if (!err) {
      res.redirect('/login');
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
