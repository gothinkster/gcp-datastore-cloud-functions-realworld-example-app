var user = require('./User.js');
var expect = require('chai').expect;
var casual = require('casual');
var mlog = process.env.CI ? { log() {} } : require('mocha-logger');

var username = casual.username;
var userToCreate = {
  email: username + '@gmail.com',
  username: username,
  password: 'a',
};
var loggedInUser = null;

describe('User module', async() => {

  it('should create new user', async() => {
    var createdUser = await user.create(userToCreate);
    mlog.log(`Created user: [${JSON.stringify(createdUser)}]`);
    await delay(1000);
  });

  it('should not allow same username', async() => {
    await user.create(userToCreate).catch(err =>
      expect(err).to.match(/Username already taken/));
  });

  it('should not allow same email', async() => {
    var userWithSameEmail = JSON.parse(JSON.stringify(userToCreate));
    userWithSameEmail.username += 'foo';
    await user.create(userWithSameEmail).catch(err =>
      expect(err).to.match(/Email already taken/));
  });

  it('should login user', async() => {
    loggedInUser = await user.login({
      email: userToCreate.email,
      password: userToCreate.password
    });
    mlog.log(`Logged in user: [${JSON.stringify(loggedInUser)}]`);
  });

  it('should authenticate token', async() => {
    var authenticatedUser = await user.authenticateToken(loggedInUser.token);
    mlog.log(`Authenticated user: [${JSON.stringify(authenticatedUser)}]`);
  });

  it('should not allow bad token', async() => {
    // userWithWrongToken = JSON.parse(JSON.stringify(loggedInUser));
    // userWithWrongToken.token += 'foo';
    await user.authenticateToken(loggedInUser.token + 'foo').catch(err =>
      expect(err).to.match(/Signature verification failed/));
  });

  it('should not allow wrong email', async() => {
    await user.login({
      email: userToCreate.email + 'foo',
      password: userToCreate.password
    }).catch(err => expect(err).to.match(/Email not found/));
  });

  it('should not allow wrong password', async() => {
    await user.login({
      email: userToCreate.email,
      password: userToCreate.password + 'bar'
    }).catch(err => expect(err).to.match(/Incorrect password/));
  });

  it('should not allow token for non existetnt user', async() => {
    var tokenForNonExistentUser = user.mintToken((Math.random() * Math.pow(36, 6)).toString(36));
    await user.authenticateToken(tokenForNonExistentUser).catch(err => {
      expect(err).to.match(/Invalid token/);
    });
  });

});

function delay(time) {
  return new Promise(function(fulfill) {
    setTimeout(fulfill, time);
  });
}
