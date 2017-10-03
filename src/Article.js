var { ds, namespace } = require('./Datastore.js');
var slug = require('slug');

module.exports = {

  async create(aArticleData, aAuthorUsername) {
    // Get author data
    var authorUser = (await ds.get(ds.key({ namespace, path: ['User', aAuthorUsername] })))[0];
    if (!authorUser) {
      throw new Error(`User does not exist: [${aAuthorUsername}]`);
    }
    ['email', 'password', 'following', 'followers', ds.KEY].forEach(key => delete authorUser[key]);
    authorUser.following = false;

    var articleSlug = slug(aArticleData.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
    var timestamp = (new Date()).getTime();
    var newArticle = {
      slug: articleSlug,
      title: aArticleData.title,
      description: aArticleData.description,
      body: aArticleData.body,
      tagList: aArticleData.tagList ? aArticleData.tagList : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      author: aAuthorUsername,
      favoritesCount: 0,
    };
    await ds.upsert({
      key: ds.key({ namespace, path: ['Article', newArticle.slug] }),
      data: newArticle,
    });
    newArticle.author = authorUser;
    newArticle.favorited = false;
    return newArticle;
  },

  async get(aSlug, aReaderUsername) {
    var article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article not found: [${aSlug}]`);
    }
    delete article[ds.KEY];

    // Get author data
    var authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
    /* istanbul ignore next */
    if (!authorUser) {
      throw new Error(`User does not exist: [${aAuthorUsername}]`);
    }
    ['email', 'password', 'following', ds.KEY].forEach(key => delete authorUser[key]);

    // If reader's username is provided, populate following bit
    authorUser.following = false;
    if (aReaderUsername) {
      authorUser.following = authorUser.followers.includes(aReaderUsername)
    }
    delete authorUser.followers;

    article.author = authorUser;
    return article;
  },

  async getAll(options) {
    var query = ds.createQuery(namespace, 'Article')
      .order('createdAt', { descending: true });
    if (!options) {
      options = {};
    }

    if (options.tag) {
      query = query.filter('tagList', '=', options.tag);
    } else if (options.author) {
      query = query.filter('author', '=', options.author);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(20);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    var articles = (await query.run(query))[0];
    for (var article of articles) {
      delete article[ds.KEY];

      // Get author info for this article
      var authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
      article.author = {
        username: authorUser.username,
        bio: authorUser.bio,
        image: authorUser.image,
        following: false,
      }
      if (options.reader) {
        article.author.following = authorUser.followers.includes(options.reader);
      }
    }

    return articles;
  },

  async getFeed(aUsername, options) {
    var user = (await ds.get(ds.key({ namespace, path: ['User', aUsername] })))[0];
    if (!user) {
      throw new Error(`User not found: [${aUsername}]`);
    }
    if (!options) {
      options = {};
    }
    if (!options.limit) {
      options.limit = 20;
    }
    if (!options.offset) {
      options.offset = 0;
    }

    // For each followed user, get authored articles
    var articles = [];
    for (var i = 0; i < user.following.length; ++i) {
      var followedUser = (await ds.get(ds.key({ namespace, path: ['User', user.following[i]] })))[0];
      var query = ds.createQuery(namespace, 'Article')
        .order('createdAt', { descending: true })
        .filter('author', '=', user.following[i]);

      var articlesByThisAuthor = (await query.run())[0];
      for (var article of articlesByThisAuthor) {
        delete article[ds.KEY];
        article.author = {
          username: followedUser.username,
          bio: followedUser.bio,
          image: followedUser.image,
          following: true,
        };
        articles.push(article);
      }
    }
    return articles.slice(options.offset, options.offset + options.limit);
  },

  async createComment(aSlug, aCommentAuthorUsername, aCommentBody) {
    var key = ds.key({ namespace, path: ['Article', aSlug, 'Comment'] });
    var timestamp = (new Date()).getTime();
    var commentData = {
      body: aCommentBody,
      createdAt: timestamp,
      updatedAt: timestamp,
      author: aCommentAuthorUsername,
    };
    await ds.insert({ key, data: commentData });
    commentData.id = key.id;
    var commentAuthorUser = (await ds.get(ds.key({ namespace, path: ['User', aCommentAuthorUsername] })))[0];
    commentData.author = {
      username: aCommentAuthorUsername,
      bio: commentAuthorUser.bio,
      image: commentAuthorUser.image,
      following: false,
    };
    return commentData;
  },

  async getAllComments(aSlug, aReaderUsername) {
    var comments = (await ds.createQuery(namespace, 'Comment')
      .hasAncestor(ds.key({ namespace, path: ['Article', aSlug] })).run())[0];
    comments = comments.sort((a, b) => b.createdAt - a.createdAt);

    for (var comment of comments) {
      comment.id = comment[ds.KEY].id;
      delete comment[ds.KEY];

      // Get comment author info
      var authorUser = (await ds.get(ds.key({ namespace, path: ['User', comment.author] })))[0];
      comment.author = {
        username: authorUser.username,
        bio: authorUser.bio,
        image: authorUser.image,
        following: false,
      };
      if (aReaderUsername) {
        comment.author.following = authorUser.followers.includes(aReaderUsername);
      }
    }
    return comments;
  },



  testutils: {
    async __deleteAll() {
      /* istanbul ignore next */
      if (namespace != 'test') {
        console.warn(`namespace is not test but [${namespace}], skipping.`);
        return;
      }
      var articleKeys = (await ds.createQuery(namespace, 'Article').select('__key__').run())[0];
      articleKeys.forEach(async(articleKey) => {
        await ds.delete(articleKey[ds.KEY]);
      });
    },
    async __deleteAllComments() {
      /* istanbul ignore next */
      if (namespace != 'test') {
        console.warn(`namespace is not test but [${namespace}], skipping.`);
        return;
      }
      var commentKeys = (await ds.createQuery(namespace, 'Comment').select('__key__').run())[0];
      commentKeys.forEach(async(commentKey) => {
        await ds.delete(commentKey[ds.KEY]);
      });
    },
  },

};
