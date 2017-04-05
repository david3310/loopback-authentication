// Copyright IBM Corp. 2014,2015. All Rights Reserved.
// Node module: loopback-example-user-management
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var dsConfig = require('../datasources.json');
var passport = require('passport');
var jwt = require('jsonwebtoken');
var auth = require('../auth/auth.service');
var path = require('path');
var config = require('../../server/config.json');

module.exports = function(app) {
  var User = app.models.user;

  //user sign up
  app.post('/things/users', function (req, res) {

    var newUser = {};
    newUser.email = req.body.email.toLowerCase();
    newUser.username = req.body.name;
    newUser.password = req.body.password;
    newUser.provider = 'local';
    newUser.role = 'user';

    User.create(newUser, function(err, user) {
      if (err) {
        console.log('--error--', err.message);
        return res.redirect('createfailed');
      } else {
        console.log('user successfully created');
        var url = 'http://' + config.host + ':' + config.port;
        var html = 'You have created a Checkphish account . Please check the website  <a href="' + url + '">here</a>';

        User.app.models.Email.send({
          to: newUser.email,
          from: 'Checkphish',
          subject: 'You have created a Checkphish account',
          html: html
        }, function(err) {
          if (err) return console.log('> error sending signup notification email', err);
          console.log('> sending signup notification email to:', newUser.email);
        });
        var token = jwt.sign({_id: user.id }, 'checkphish', { expiresIn: 60*5 });
        res.json({ token: token, success: true });
      }

    });
  });

  //get current user
  app.get('/things/users/me',  auth.isAuthenticated(app), function(req, res, next) {
    User.findById(req.user.id, function(err, user) {
      console.log('created and retrieved user for "-me-"==> ', user);
      res.json(user);
    });
  });

  //auth
  app.use('/auth', require('../auth')(app));

  // //send an email with instructions to reset an existing user's password
  app.post('/request-password-reset', function(req, res, next) {
    User.resetPassword({
      email: req.body.email
    }, function(err) {
      console.log('request-password-reset error=> ', err);
      if (err) return res.status(401).send(err);
      res.send({success: true});
    });
  });

  //show password reset form
  app.get('/reset-password', function(req, res, next) {
    if (!req.accessToken) return res.sendStatus(401);
    res.render('password-reset', {
      accessToken: req.accessToken.id
    });
  });

  //reset the user's pasword
  app.post('/reset-password', function(req, res, next) {

    if (!req.accessToken) return res.sendStatus(401);

    //verify passwords match
    if (!req.body.password ||
        !req.body.confirmation ||
        req.body.password !== req.body.confirmation) {
      return res.sendStatus(400, new Error('Passwords do not match'));
    }

    User.findById(req.accessToken.userId, function(err, user) {
      if (err) return res.sendStatus(404);
      user.updateAttribute('password', req.body.password, function(err, user) {
      if (err) return res.sendStatus(404);
        console.log('> password reset processed successfully');
        res.render('response', {
          title: 'Password reset success',
          content: 'Your password has been reset successfully',
          redirectTo: '/#!/login',
          redirectToLinkText: 'Log in'
        });
      });
    });
  });
};
