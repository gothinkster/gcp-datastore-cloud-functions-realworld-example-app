const { ds, namespace } = require('./Datastore.js');
const bcrypt = require('bcrypt');
const jwt = require('jwt-simple');

/* istanbul ignore next */
const tokenSecret = process.env.SECRET ? process.env.SECRET : 'secret';

module.exports = {

  async create(aUserData) {

    // Verify username is not taken
    const userKey = ds.key({ namespace, path: ['User', aUserData.username], });
    const result = await ds.get(userKey);
    if (result[0]) {
      throw new Error(`Username already taken: [${aUserData.username}]`);
    }

    // Verify email is not taken
    const usersWithThisEmail = await ds.runQuery(
      ds.createQuery(namespace, 'User').filter('email', '=', aUserData.email));
    if (usersWithThisEmail[0].length) {
      throw new Error(`Email already taken: [${aUserData.email}]`);
    }

    // Add user
    const encryptedPassword = await bcrypt.hash(aUserData.password, 5);
    const userRecord = {
      username: aUserData.username,
      email: aUserData.email,
      password: encryptedPassword,
      bio: '',
      image: '',
      followers: [],
      following: [],
    };
    await ds.upsert({ key: userKey, data: userRecord });
    delete userRecord.password;
    userRecord.token = this.mintToken(aUserData.username);
    userRecord.username = aUserData.username;
    return userRecord;
  },

  async login(aUserData) {

    // Get user with this email
    const queryResult = await ds.runQuery(
      ds.createQuery(namespace, 'User').filter('email', '=', aUserData.email));
    const foundUser = queryResult[0][0];
    if (!foundUser) {
      throw new Error(`Email not found: [${aUserData.email}]`);
    }
    foundUser.username = foundUser[ds.KEY].name;
    const passwordCheckResult = await bcrypt.compare(aUserData.password, foundUser.password);
    if (!passwordCheckResult) {
      throw new Error('Incorrect password');
    }
    return {
      email: foundUser.email,
      token: this.mintToken(foundUser.username),
      username: foundUser.username,
      bio: foundUser.bio,
      image: foundUser.image
    };
  },

  async followUser(aFollowerUsername, aFollowedUsername) {
    return await this.mutateFollowing(aFollowerUsername, aFollowedUsername, true);
  },

  async unfollowUser(aFollowerUsername, aFollowedUsername) {
    return await this.mutateFollowing(aFollowerUsername, aFollowedUsername, false);
  },

  async mutateFollowing(aFollowerUsername, aFollowedUsername, aMutation) {

    const updates = [];

    // Add/remove "following" array of follower
    const followerUserKey = ds.key({ namespace, path: ['User', aFollowerUsername] });
    const followerUser = (await ds.get(followerUserKey))[0];
    if (!followerUser) {
      throw new Error(`User not found: [${aFollowerUsername}]`);
    }
    if (aMutation) {
      followerUser.following.push(aFollowedUsername);
    } else {
      followerUser.following = followerUser.following.filter(e => e != aFollowedUsername);
    }
    updates.push({ key: followerUserKey, data: followerUser, });

    // Add/remove "followers" array of followed
    const followedUserKey = ds.key({ namespace, path: ['User', aFollowedUsername] });
    const followedUser = (await ds.get(followedUserKey))[0];
    if (!followedUser) {
      throw new Error(`User not found: [${aFollowedUsername}]`);
    }
    if (aMutation) {
      followedUser.followers.push(aFollowerUsername);
    } else {
      followedUser.followers = followedUser.followers.filter(e => e != aFollowerUsername);
    }
    updates.push({ key: followedUserKey, data: followedUser });

    await ds.update(updates);

    // Return profile of followed user
    return {
      username: aFollowedUsername,
      bio: followedUser.bio,
      image: followedUser.image,
      following: aMutation,
    };
  },

  // ===== Token managenement

  async authenticateToken(aToken) {
    const decoded = jwt.decode(aToken, tokenSecret);
    const username = decoded.username;
    const result = await ds.get(ds.key({ namespace, path: ['User', decoded.username], }));
    const foundUser = result[0];
    if (!foundUser) {
      throw new Error('Invalid token');
    }
    return {
      username,
      token: aToken,
      email: foundUser.email,
      bio: foundUser.bio,
      image: foundUser.image,
    };
  },

  mintToken(aUsername) {
    return jwt.encode({
      username: aUsername,
      exp: (Date.now() + 2 * 24 * 60 * 60 * 1000) / 1000, // expires in 2 days
    }, tokenSecret);
  },

  testutils: {
    async __deleteAllUsers() {
      /* istanbul ignore next */
      if (namespace != 'test') {
        console.warn(`namespace is not test but [${namespace}], skipping.`);
        return;
      }
      const userKeys = (await ds.createQuery(namespace, 'User').select('__key__').run())[0];
      userKeys.forEach(async(userKey) => {
        await ds.delete(userKey[ds.KEY]);
      });
    },
  },

};
