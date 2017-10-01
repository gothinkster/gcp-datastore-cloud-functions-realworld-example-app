var ds = require('./Datastore.js');
var slug = require('slug');

/* istanbul ignore next */
var namespace = process.env.DATASTORE_NAMESPACE ? process.env.DATASTORE_NAMESPACE : 'dev';

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
  }

};
