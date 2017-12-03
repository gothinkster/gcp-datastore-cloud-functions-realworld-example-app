const { ds, namespace } = require('./Datastore.js');
const slugify = require('slugify');

module.exports = {

  async create(aArticleData, aAuthorUsername) {
    // Get author data
    const authorUser = (await ds.get(ds.key({ namespace, path: ['User', aAuthorUsername] })))[0];
    if (!authorUser) {
      throw new Error(`User does not exist: [${aAuthorUsername}]`);
    }

    const articleSlug = slugify('' + aArticleData.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
    const timestamp = (new Date()).getTime();
    const newArticle = {
      slug: articleSlug,
      title: aArticleData.title,
      description: aArticleData.description,
      body: aArticleData.body,
      tagList: aArticleData.tagList ? aArticleData.tagList : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      author: aAuthorUsername,
      favoritedBy: [],
    };
    await ds.upsert({
      key: ds.key({ namespace, path: ['Article', newArticle.slug] }),
      data: newArticle,
    });
    newArticle.author = {
      username: aAuthorUsername,
      bio: authorUser.bio,
      image: authorUser.bio,
      following: false,
    };
    newArticle.favorited = false;
    newArticle.favoritesCount = 0;
    delete newArticle.favoritedBy;
    return newArticle;
  },

  async update(aSlug, aMutation, aUpdaterUsername) {
    const article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article not found: [${aSlug}]`);
    }

    if (aUpdaterUsername !== article.author) {
      throw new Error('Only author can update article');
    }

    if (aMutation.title) {
      article.title = aMutation.title;
    }
    if (aMutation.description) {
      article.description = aMutation.description;
    }
    if (aMutation.body) {
      article.body = aMutation.body;
    }
    await ds.update(article);
    return await this.get(aSlug, aUpdaterUsername);
  },

  async get(aSlug, aReaderUsername) {
    const article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article not found: [${aSlug}]`);
    }
    delete article[ds.KEY];

    // Get author data
    const authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
    /* istanbul ignore next */
    if (!authorUser) {
      throw new Error(`User does not exist: [${article.author}]`);
    }
    article.author = {
      username: authorUser.username,
      bio: authorUser.bio,
      image: authorUser.image,
      following: false,
    };

    // If reader's username is provided, populate following & favorited bits
    article.favorited = false;
    article.favoritesCount = article.favoritedBy.length;
    if (aReaderUsername) {
      article.author.following = authorUser.followers.includes(aReaderUsername);
      article.favoritedBy.includes(aReaderUsername);
    }
    delete article.favoritedBy;

    return article;
  },

  async delete(aSlug, aUsername) {
    const article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article not found: [${aSlug}]`);
    }
    const user = (await ds.get(ds.key({ namespace, path: ['User', aUsername] })))[0];
    if (!user) {
      throw new Error(`User does not exist: [${aUsername}]`);
    }
    if (article.author !== user.username) {
      throw new Error(`Only author can delete article: [${article.author}]`);
    }
    await ds.delete(ds.key({ namespace, path: ['Article', aSlug] }));
    return null;
  },

  async getAll(options) {
    let query = ds.createQuery(namespace, 'Article')
      .order('createdAt', { descending: true });
    if (!options) {
      options = {};
    }

    if (options.tag) {
      query = query.filter('tagList', '=', options.tag);
    } else if (options.author) {
      query = query.filter('author', '=', options.author);
    } else if (options.favoritedBy) {
      query = query.filter('favoritedBy', '=', options.favoritedBy);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(20);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const articles = (await query.run(query))[0];
    for (const article of articles) {
      delete article[ds.KEY];

      // Get author info for this article
      const authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
      article.author = {
        username: authorUser.username,
        bio: authorUser.bio,
        image: authorUser.image,
        following: false,
      };
      article.favorited = false;
      article.favoritesCount = article.favoritedBy.length;
      if (options.reader) {
        article.author.following = authorUser.followers.includes(options.reader);
        article.favorited = article.favoritedBy.includes(options.reader);
      }
      delete article.favoritedBy;
    }

    return articles;
  },

  async getFeed(aUsername, options) {
    const user = (await ds.get(ds.key({ namespace, path: ['User', aUsername] })))[0];
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
    let articles = [];
    for (let i = 0; i < user.following.length; ++i) {
      const followedUser = (await ds.get(ds.key({ namespace, path: ['User', user.following[i]] })))[0];
      const query = ds.createQuery(namespace, 'Article').filter('author', '=', user.following[i]);

      const articlesByThisAuthor = (await query.run())[0];
      for (const article of articlesByThisAuthor) {
        delete article[ds.KEY];
        article.favorited = article.favoritedBy.includes(aUsername);
        article.favoritesCount = article.favoritedBy.length;
        delete article.favoritedBy;
        article.author = {
          username: followedUser.username,
          bio: followedUser.bio,
          image: followedUser.image,
          following: true,
        };
        articles.push(article);
      }
    }

    // Sort merged articles by createdAt descending
    articles = articles.sort((a, b) => b.createdAt - a.createdAt);

    return articles.slice(options.offset, options.offset + options.limit);
  },

  async favoriteArticle(aSlug, aUsername) {
    return await this.mutateFavoriteBit(aSlug, aUsername, true);
  },

  async unfavoriteArticle(aSlug, aUsername) {
    return await this.mutateFavoriteBit(aSlug, aUsername, false);
  },

  async mutateFavoriteBit(aSlug, aUsername, aFavoriteBit) {
    // Verify user exists
    if (!aUsername) {
      throw new Error('User must be specified');
    }
    const favoriterUser = (await ds.get(ds.key({ namespace, path: ['User', aUsername] })))[0];
    if (!favoriterUser) {
      throw new Error(`User does not exist: [${aUsername}]`);
    }

    // Get article to mutate
    const article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article does not exist: [${aSlug}]`);
    }

    // First remove this author if already in list, and add back if favoriting
    article.favoritedBy = article.favoritedBy.filter(e => e !== aUsername);
    if (aFavoriteBit) {
      article.favoritedBy.push(aUsername);
    }
    await ds.update(article);
    article.favorited = aFavoriteBit;
    article.favoritesCount = article.favoritedBy.length;
    delete article.favoritedBy;
    article[ds.KEY];

    // Get author data
    const authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
    article.author = {
      username: authorUser.username,
      bio: authorUser.bio,
      image: authorUser.image,
      following: authorUser.followers.includes(aUsername),
    };

    return article;
  },

  async createComment(aSlug, aCommentAuthorUsername, aCommentBody) {
    const key = ds.key({ namespace, path: ['Article', aSlug, 'Comment'] });
    const timestamp = (new Date()).getTime();
    const commentData = {
      body: aCommentBody,
      createdAt: timestamp,
      updatedAt: timestamp,
      author: aCommentAuthorUsername,
    };
    await ds.insert({ key, data: commentData });
    commentData.id = key.id;
    const commentAuthorUser = (await ds.get(ds.key({ namespace, path: ['User', aCommentAuthorUsername] })))[0];
    commentData.author = {
      username: aCommentAuthorUsername,
      bio: commentAuthorUser.bio,
      image: commentAuthorUser.image,
      following: false,
    };
    return commentData;
  },

  async deleteComment(aSlug, aCommentId, aDeleterUsername) {
    const commentKey = ds.key({ namespace, path: ['Article', aSlug, 'Comment', parseInt(aCommentId)] });
    const comment = (await ds.get(commentKey))[0];
    if (!comment) {
      throw new Error(`Comment not found: [${aSlug}/${aCommentId}]`);
    }

    // Only comment's author can delete comment
    if (comment.author !== aDeleterUsername) {
      throw new Error('Only comment author can delete comment');
    }
    await ds.delete(commentKey);
    return null;
  },

  async getAllComments(aSlug, aReaderUsername) {
    let comments = (await ds.createQuery(namespace, 'Comment')
      .hasAncestor(ds.key({ namespace, path: ['Article', aSlug] })).run())[0];
    comments = comments.sort((a, b) => b.createdAt - a.createdAt);

    for (const comment of comments) {
      comment.id = comment[ds.KEY].id;
      delete comment[ds.KEY];

      // Get comment author info
      const authorUser = (await ds.get(ds.key({ namespace, path: ['User', comment.author] })))[0];
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

  async getAllTags() {
    const tags = (await ds.createQuery(namespace, 'Article').select('tagList').run())[0];
    const dedupeObj = {};
    for (let i = 0; i < tags.length; ++i) {
      dedupeObj[tags[i].tagList] = 1;
    }
    return Object.keys(dedupeObj);
  },

  testutils: {
    async __deleteAllArticles() {
      /* istanbul ignore next */
      if (!namespace.startsWith('test')) {
        console.warn(`__deleteAllArticles: namespace does not start with "test" but is [${namespace}], skipping.`);
        return;
      }
      const articleKeys = (await ds.createQuery(namespace, 'Article').select('__key__').run())[0];
      articleKeys.forEach(async (articleKey) => {
        await ds.delete(articleKey[ds.KEY]);
      });
    },
    async __deleteAllComments() {
      /* istanbul ignore next */
      if (!namespace.startsWith('test')) {
        console.warn(`__deleteAllComments: namespace does not start with "test" but is [${namespace}], skipping.`);
        return;
      }
      const commentKeys = (await ds.createQuery(namespace, 'Comment').select('__key__').run())[0];
      commentKeys.forEach(async (commentKey) => {
        await ds.delete(commentKey[ds.KEY]);
      });
    },
  },

};
