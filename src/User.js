const { ds, namespace } = require('./Datastore.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/* istanbul ignore next */
const tokenSecret = process.env.SECRET ? process.env.SECRET : '3ee058420bc2';

module.exports = {

  async create(aUserData) {

    // Verify username is not taken
    const userKey = ds.key({ namespace, path: ['User', aUserData.username], });
    const result = await ds.get(userKey);
    if (result[0]) {
      throw new Error(`Username already taken: [${aUserData.username}]`);
    }

    await verifyEmailIsNotTaken(aUserData.email);

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

  async update(aCurrentUser, aUserMutation) {
    const userKey = ds.key({ namespace, path: ['User', aCurrentUser.username] });
    const user = (await ds.get(userKey))[0];
    if (!user) {
      throw new Error(`User not found: [${aCurrentUser.username}]`);
    }

    // Make requested mutations
    if (aUserMutation.email) {
      await verifyEmailIsNotTaken(aUserMutation.email);
      user.email = aUserMutation.email;
    }
    if (aUserMutation.password) {
      user.password = await bcrypt.hash(aUserMutation.password, 5);
    }
    if (aUserMutation.image) {
      user.image = aUserMutation.image;
    }
    if (aUserMutation.bio) {
      user.bio = aUserMutation.bio;
    }
    await ds.update(user);
    const updatedUser = (await ds.get(userKey))[0];
    return {
      email: updatedUser.email,
      token: aCurrentUser.token,
      username: updatedUser.username,
      bio: updatedUser.bio,
      image: updatedUser.image
    };
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

  async getProfile(aUsername, aCurrentUser) {
    if (!aUsername) {
      throw new Error('User name must be specified');
    }
    const user = (await ds.get(ds.key({ namespace, path: ['User', aUsername] })))[0];
    if (!user) {
      throw new Error(`User not found: [${aUsername}]`);
    }

    const profile = {
      username: aUsername,
      bio: user.bio,
      image: user.image,
      following: false,
    };

    if (aCurrentUser && aCurrentUser.username) {
      profile.following = user.followers.includes(aCurrentUser.username);
    }

    return profile;
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
      if (!followerUser.following.includes(aFollowedUsername)) {
        followerUser.following.push(aFollowedUsername);
      }
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
      if (!followedUser.followers.includes(aFollowerUsername)) {
        followedUser.followers.push(aFollowerUsername);
      }
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
    const decoded = jwt.verify(aToken, tokenSecret);
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
    return jwt.sign({ username: aUsername }, tokenSecret, { expiresIn: '2 days' });
  },

  testutils: {
    async __deleteAllUsers() {
      /* istanbul ignore next */
      if (!namespace.startsWith('test')) {
        console.warn(`__deleteAllUsers: namespace does not start with "test" but is [${namespace}], skipping.`);
        return;
      }
      const userKeys = (await ds.createQuery(namespace, 'User').select('__key__').run())[0];
      userKeys.forEach(async (userKey) => {
        await ds.delete(userKey[ds.KEY]);
      });
    },
  },

};

async function verifyEmailIsNotTaken(aEmail) {
  const usersWithThisEmail = await ds.runQuery(
    ds.createQuery(namespace, 'User').filter('email', '=', aEmail));
  if (usersWithThisEmail[0].length) {
    throw new Error(`Email already taken: [${aEmail}]`);
  }
}
