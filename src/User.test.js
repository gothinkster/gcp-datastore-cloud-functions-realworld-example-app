const User = require('./User.js');
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

describe('User module', async () => {

  before(async () => {
    await cleanSlate();
  });

  after(async () => {
    await cleanSlate();
  });

  it('should create new user', async () => {
    const createdUser = await User.create(userToCreate);
    mlog.log(`Created user: [${JSON.stringify(createdUser)}]`);
    await delay(1000);
  });

  it('should not allow same username', async () => {
    await User.create(userToCreate).catch(err =>
      expect(err).to.match(/Username already taken/));
  });

  it('should not allow same email', async () => {
    const userWithSameEmail = JSON.parse(JSON.stringify(userToCreate));
    userWithSameEmail.username += 'foo';
    await User.create(userWithSameEmail).catch(err =>
      expect(err).to.match(/Email already taken/));
  });

  it('should login user', async () => {
    loggedInUser = await User.login({
      email: userToCreate.email,
      password: userToCreate.password
    });
    mlog.log(`Logged in user: [${JSON.stringify(loggedInUser)}]`);
  });

  it('should authenticate token', async () => {
    const authenticatedUser = await User.authenticateToken(loggedInUser.token);
    mlog.log(`Authenticated user: [${JSON.stringify(authenticatedUser)}]`);
  });

  it('should not allow bad token', async () => {
    await User.authenticateToken(loggedInUser.token + 'foo').catch(err => {
      expect(err.message).to.match(/invalid signature/);
    });
  });

  it('should not allow wrong email', async () => {
    await User.login({
      email: userToCreate.email + 'foo',
      password: userToCreate.password
    }).catch(err => expect(err).to.match(/Email not found/));
  });

  it('should not allow wrong password', async () => {
    await User.login({
      email: userToCreate.email,
      password: userToCreate.password + 'bar'
    }).catch(err => expect(err).to.match(/Incorrect password/));
  });

  it('should not allow token for non existetnt user', async () => {
    const tokenForNonExistentUser = User.mintToken((Math.random() * Math.pow(36, 6)).toString(36));
    await User.authenticateToken(tokenForNonExistentUser).catch(err => {
      expect(err).to.match(/Invalid token/);
    });
  });

  it('should update user', async () => {
    const newEmail = casual.email;
    const newPassword = casual.password;
    const newBio = casual.sentence;
    const newImage = casual.url;
    let updatedUser = await User.update(loggedInUser, {
      email: newEmail,
      password: newPassword,
      bio: newBio,
      image: newImage
    });
    mlog.log(`Updated user: [${JSON.stringify(updatedUser)}]`);
    expect(updatedUser.email).to.equal(newEmail);
    expect(updatedUser.bio).to.equal(newBio);
    expect(updatedUser.image).to.equal(newImage);

    // Empty mutation should be no-op
    updatedUser = await User.update(loggedInUser, {});
    expect(updatedUser.email).to.equal(newEmail);
    expect(updatedUser.bio).to.equal(newBio);
    expect(updatedUser.image).to.equal(newImage);

    await User.update({ username: casual.username }).catch(err =>
      expect(err).to.match(/User not found/));
  });

  it('should follow/unfollow a user', async () => {
    const userToFollow = await User.create({
      email: 'followed_' + username + '@gmail.com',
      username: 'followed_' + username,
      password: 'a',
    });
    mlog.log(`User to follow: [${JSON.stringify(userToFollow)}]`);

    // Follow
    let followedUserProfile = await User.followUser(loggedInUser.username, userToFollow.username);
    mlog.log(`Followed user profile: [${JSON.stringify(followedUserProfile)}]`);
    followedUserProfile = await User.getProfile(userToFollow.username, loggedInUser);
    expect(followedUserProfile.following).to.be.true;

    // Follow again to ensure idempotence
    await User.getProfile(userToFollow.username, loggedInUser);

    // Unfollow
    let unfollowedUserProfile = await User.unfollowUser(loggedInUser.username, userToFollow.username);
    mlog.log(`Unfollowed user profile: [${JSON.stringify(unfollowedUserProfile)}]`);
    unfollowedUserProfile = await User.getProfile(userToFollow.username, loggedInUser);
    expect(unfollowedUserProfile.following).to.be.false;

    // Get profile without current user
    const anonymouslyViewedProfile = await User.getProfile(userToFollow.username);
    expect(anonymouslyViewedProfile.following).to.be.false;

    await User.getProfile(null).catch(err => {
      expect(err).to.match(/User name must be specified/);
    });
    await User.getProfile(loggedInUser.username + 'foobar').catch(err =>
      expect(err).to.match(/User not found/));

    await User.followUser(loggedInUser.username + 'foobar').catch(err =>
      expect(err).to.match(/User not found/));
    await User.followUser(loggedInUser.username, userToFollow.username + 'foobar').catch(err =>
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
  await User.testutils.__deleteAllUsers();
}
