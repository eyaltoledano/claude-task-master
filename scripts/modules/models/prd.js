import { randomUUID } from 'crypto';

/**
 * Model class for Product Requirements Documents (PRDs)
 */
export class PRD {
  /**
   * Create a new PRD
   * @param {string} title - PRD title
   * @param {string} content - PRD content (Markdown, text, etc.)
   * @param {object} options - Additional options
   */
  constructor(title, content, options = {}) {
    this.id = options.id || randomUUID(); // Use provided ID or generate new
    this.title = title;
    this.content = content;
    this.version = options.version || 1; // Initialize version
    this.format = options.format || 'markdown';
    this.sections = options.sections || [];
    this.conceptId = options.conceptId || null;
    this.metadata = options.metadata || {};
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || this.createdAt;
  }

  /**
   * Update the content of the PRD
   * @param {string} newContent - The new content for the PRD
   */
  updateContent(newContent) {
    this.content = newContent;
    this.version += 1;
    this.updatedAt = new Date().toISOString();
    return this; // Allow chaining
  }

  /**
   * Extract a specific section from the PRD content
   * @param {string} sectionName - Section to extract
   * @returns {string|null} Section content or null if not found
   */
  extractSection(sectionName) {
    // This is a simple implementation that might need to be adjusted based on actual PRD formatting
    const pattern = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?:\\n## |$)`, 'i');
    const match = this.content.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Add metadata to this PRD
   * @param {object} metadata - Additional metadata
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Convert to plain object
   * @returns {object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      version: this.version,
      format: this.format,
      sections: this.sections,
      conceptId: this.conceptId,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create a PRD instance from a plain object
   * @param {object} obj - Plain object
   * @returns {PRD} PRD instance
   */
  static fromObject(obj) {
    // Pass all properties from the object to the constructor options
    return new PRD(obj.title, obj.content, {
      id: obj.id,
      version: obj.version, // Pass version if exists
      format: obj.format,
      sections: obj.sections,
      conceptId: obj.conceptId,
      metadata: obj.metadata,
      createdAt: obj.createdAt, // Pass createdAt if exists
      updatedAt: obj.updatedAt // Pass updatedAt if exists
    });
  }
} 