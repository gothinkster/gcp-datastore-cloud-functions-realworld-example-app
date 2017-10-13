const user = require('./User.js');
const expect = require('chai').expect;
const casual = require('casual');
const mlog = process.env.CI ? { log() {} } : require('mocha-logger');

const username = casual.username;
const userToCreate = {
  email: username + '@gmail.com',
  username: username,
  password: 'a',
};
let loggedInUser = null;

describe('User module', async() => {

  before(async() => {
    await cleanSlate();
  });

  it('should create new user', async() => {
    const createdUser = await user.create(userToCreate);
    mlog.log(`Created user: [${JSON.stringify(createdUser)}]`);
    await delay(1000);
  });

  it('should not allow same username', async() => {
    await user.create(userToCreate).catch(err =>
      expect(err).to.match(/Username already taken/));
  });

  it('should not allow same email', async() => {
    const userWithSameEmail = JSON.parse(JSON.stringify(userToCreate));
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
    const authenticatedUser = await user.authenticateToken(loggedInUser.token);
    mlog.log(`Authenticated user: [${JSON.stringify(authenticatedUser)}]`);
  });

  it('should not allow bad token', async() => {
    await user.authenticateToken(loggedInUser.token + 'foo').catch(err => {
      expect(err.message).to.match(/invalid signature/);
    });
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
    const tokenForNonExistentUser = user.mintToken((Math.random() * Math.pow(36, 6)).toString(36));
    await user.authenticateToken(tokenForNonExistentUser).catch(err => {
      expect(err).to.match(/Invalid token/);
    });
  });

  it('should follow/unfollow a user', async() => {
    const userToFollow = await user.create({
      email: 'followed_' + username + '@gmail.com',
      username: 'followed_' + username,
      password: 'a',
    });
    mlog.log(`User to follow: [${JSON.stringify(userToFollow)}]`);

    // Follow
    let followedUserProfile = await user.followUser(loggedInUser.username, userToFollow.username);
    mlog.log(`Followed user profile: [${JSON.stringify(followedUserProfile)}]`);
    followedUserProfile = await user.getProfile(userToFollow.username, loggedInUser);
    expect(followedUserProfile.following).to.be.true;

    // Unfollow
    let unfollowedUserProfile = await user.unfollowUser(loggedInUser.username, userToFollow.username);
    mlog.log(`Unfollowed user profile: [${JSON.stringify(unfollowedUserProfile)}]`);
    unfollowedUserProfile = await user.getProfile(userToFollow.username, loggedInUser);
    expect(unfollowedUserProfile.following).to.be.false;

    // Get profile without current user
    const anonymouslyViewedProfile = await user.getProfile(userToFollow.username);
    expect(anonymouslyViewedProfile.following).to.be.false;

    await user.getProfile(loggedInUser.username + 'foobar').catch(err =>
      expect(err).to.match(/User not found/));

    await user.followUser(loggedInUser.username + 'foobar').catch(err =>
      expect(err).to.match(/User not found/));
    await user.followUser(loggedInUser.username, userToFollow.username + 'foobar').catch(err =>
      expect(err).to.match(/User not found/));
  });

});

function delay(time) {
  return new Promise(function(fulfill) {
    setTimeout(fulfill, time);
  });
}

async function cleanSlate() {
  mlog.log('Deleting all users.');
  await user.testutils.__deleteAllUsers();
}
