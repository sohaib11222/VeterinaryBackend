const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    unique: true,
    default: null
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  featuredImage: {
    type: String,
    default: null
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  category: {
    type: String,
    default: null
  },
  tags: {
    type: [String],
    default: []
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ isPublished: 1, publishedAt: -1 });
blogPostSchema.index({ authorId: 1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);
