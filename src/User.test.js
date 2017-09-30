var user = require('./User.js');
var expect = require('chai').expect;
var casual = require('casual');

it('works', async() => {
  var userToCreate = {
    email: casual.email,
    username: casual.username,
    password: 'a',
  };
  var createdUser = await user.create(userToCreate);
  await delay(2000);
  console.log(createdUser);
  await user.login(createdUser);
});

function delay(time) {
  return new Promise(function(fulfill) {
    setTimeout(fulfill, time);
  });
}
