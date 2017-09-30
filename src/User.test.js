var user = require('./User.js');
var expect = require('chai').expect;
var casual = require('casual');

it('works', async() => {
  var username = casual.username;
  var userToCreate = {
    email: username + '@gmail.com',
    username: username,
    password: 'a',
  };
  var createdUser = await user.create(userToCreate);
  console.log('##### Created user');
  console.log(createdUser);
  await delay(1000);

  await user.create(userToCreate).catch(err =>
    expect(err).to.match(/Username already taken/));
  var userWithSameEmail = JSON.parse(JSON.stringify(userToCreate));
  userWithSameEmail.username += 'foo';
  await user.create(userWithSameEmail).catch(err =>
    expect(err).to.match(/Email already taken/));

  var loggedInUser = await user.login({
    email: userToCreate.email,
    password: userToCreate.password
  });
  console.log('\n##### Logged in user');
  console.log(loggedInUser);

  var authenticatedUser = await user.authenticateToken(loggedInUser.token);
  console.log('\n##### Authenticated in user');
  console.log(authenticatedUser);
  userWithWrongToken = JSON.parse(JSON.stringify(loggedInUser));
  userWithWrongToken.token += 'foo';
  await user.authenticateToken(userWithWrongToken.token).catch(err =>
    expect(err).to.match(/Signature verification failed/));

  await user.login({
    email: userToCreate.email + 'foo',
    password: userToCreate.password
  }).catch(err => expect(err).to.match(/Email not found/));

  await user.login({
    email: userToCreate.email,
    password: userToCreate.password + 'bar'
  }).catch(err => expect(err).to.match(/Incorrect password/));
});

function delay(time) {
  return new Promise(function(fulfill) {
    setTimeout(fulfill, time);
  });
}
