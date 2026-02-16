/**
 * Mongoose plugin to add default query timeout to all queries
 * This prevents queries from hanging indefinitely
 */
module.exports = function queryTimeoutPlugin(schema) {
  // Add maxTimeMS to all find operations
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments', 'distinct'], function() {
    if (!this.options.maxTimeMS) {
      this.maxTimeMS(10000); // 10 second default timeout (increased for better reliability)
    }
  });

  // Add maxTimeMS to aggregate operations
  schema.pre('aggregate', function() {
    if (!this.options.maxTimeMS) {
      this.maxTimeMS(10000); // 10 second default timeout
    }
  });
  
  // Add maxTimeMS to update operations
  schema.pre(['updateOne', 'updateMany', 'replaceOne'], function() {
    if (!this.options.maxTimeMS) {
      this.maxTimeMS(10000);
    }
  });
};
