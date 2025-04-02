/**
 * Represents a generated idea
 */
export class Idea {
  /**
   * Create a new idea
   * @param {string} title - The title of the idea
   * @param {string} description - The description of the idea
   * @param {object} options - Additional options
   */
  constructor(title, description, options = {}) {
    this.id = options.id || `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.title = title;
    this.description = description;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.tags = options.tags || [];
    this.score = options.score || 0;
    this.metadata = options.metadata || {};
  }

  /**
   * Add tags to the idea
   * @param {Array<string>} tags - Tags to add
   * @returns {Idea} - This idea for chaining
   */
  addTags(tags) {
    this.tags = [...new Set([...this.tags, ...tags])];
    return this;
  }

  /**
   * Set the score for the idea
   * @param {number} score - Score value
   * @returns {Idea} - This idea for chaining
   */
  setScore(score) {
    this.score = score;
    return this;
  }

  /**
   * Add metadata to the idea
   * @param {object} metadata - Metadata to add
   * @returns {Idea} - This idea for chaining
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Convert the idea to a plain object
   * @returns {object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      tags: this.tags,
      score: this.score,
      metadata: this.metadata
    };
  }

  /**
   * Create an Idea from a plain object
   * @param {object} obj - Object to create from
   * @returns {Idea} - New Idea instance
   */
  static fromObject(obj) {
    const idea = new Idea(
      obj.title,
      obj.description,
      {
        id: obj.id,
        createdAt: obj.createdAt,
        tags: obj.tags,
        score: obj.score,
        metadata: obj.metadata
      }
    );
    
    return idea;
  }
} 