import { randomUUID } from 'crypto'; // Import crypto module for UUIDs

/**
 * Model class for idea generation
 */
export class Idea {
  /**
   * Create a new idea
   * @param {string} title - Idea title
   * @param {string} description - Idea description
   * @param {object} options - Additional options (tags, metadata)
   */
  constructor(title, description, options = {}) {
    this.id = randomUUID(); // Generate a unique ID
    this.title = title;
    this.description = description;
    this.tags = options.tags || [];
    this.metadata = options.metadata || {};
    this.score = options.score || 0;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Set the score of this idea
   * @param {number} score - Idea score (0-1)
   */
  setScore(score) {
    this.score = Math.max(0, Math.min(1, score)); // Ensure score is between 0 and 1
    return this;
  }

  /**
   * Add metadata to this idea
   * @param {object} metadata - Additional metadata
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Add tags to this idea
   * @param {Array<string>} tags - Tags to add
   */
  addTags(tags) {
    this.tags = [...new Set([...this.tags, ...tags])];
    return this;
  }

  /**
   * Convert to plain object
   * @returns {object} Plain object representation
   */
  toObject() {
    return {
      id: this.id, // Include the id
      title: this.title,
      description: this.description,
      tags: this.tags,
      score: this.score,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }

  /**
   * Create an Idea instance from a plain object
   * @param {object} obj - Plain object
   * @returns {Idea} Idea instance
   */
  static fromObject(obj) {
    const idea = new Idea(obj.title, obj.description, {
      tags: obj.tags,
      score: obj.score,
      metadata: obj.metadata
    });
    // Restore the original ID if present
    if (obj.id) {
        idea.id = obj.id;
    }
    idea.createdAt = obj.createdAt || new Date().toISOString();
    return idea;
  }
} 