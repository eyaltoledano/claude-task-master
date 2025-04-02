/**
 * Represents a Product Requirements Document (PRD)
 */
export class PRD {
  /**
   * Create a new PRD
   * @param {string} title - The title of the PRD
   * @param {string} content - The content of the PRD
   * @param {object} options - Additional options
   */
  constructor(title, content, options = {}) {
    this.id = options.id || `prd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.title = title;
    this.content = content;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || this.createdAt;
    this.version = options.version || 1;
    this.format = options.format || 'markdown';
    this.sourceConceptId = options.sourceConceptId || null;
    this.sections = options.sections || [];
    this.template = options.template || 'standard';
    this.history = options.history || [];
    this.metadata = options.metadata || {};
  }

  /**
   * Update the PRD content
   * @param {string} newContent - New content
   * @param {string} reason - Reason for the update
   * @returns {PRD} - This PRD for chaining
   */
  update(newContent, reason = 'manual update') {
    // Store current version in history
    this.history.push({
      version: this.version,
      content: this.content,
      updatedAt: this.updatedAt,
      reason: 'version history'
    });

    // Update content
    this.content = newContent;
    this.updatedAt = new Date().toISOString();
    this.version += 1;
    this.metadata.lastUpdateReason = reason;

    return this;
  }

  /**
   * Update the sections analysis
   * @param {Array} sections - Detected sections
   * @returns {PRD} - This PRD for chaining
   */
  updateSections(sections) {
    this.sections = sections;
    this.metadata.sectionsUpdatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Change the format of the PRD
   * @param {string} format - New format (markdown, html, plain)
   * @param {string} convertedContent - Content in the new format
   * @returns {PRD} - This PRD for chaining
   */
  changeFormat(format, convertedContent) {
    if (!['markdown', 'html', 'plain'].includes(format)) {
      throw new Error(`Invalid format: ${format}`);
    }

    this.format = format;
    
    if (convertedContent) {
      return this.update(convertedContent, `converted to ${format}`);
    }
    
    return this;
  }

  /**
   * Add metadata to the PRD
   * @param {object} metadata - Metadata to add
   * @returns {PRD} - This PRD for chaining
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Get a specific version of the PRD
   * @param {number} version - Version number (default: current)
   * @returns {object} - PRD version or null
   */
  getVersion(version) {
    if (version === this.version) {
      return {
        version: this.version,
        content: this.content,
        updatedAt: this.updatedAt
      };
    }

    return this.history.find(v => v.version === version) || null;
  }

  /**
   * Convert the PRD to a plain object
   * @returns {object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
      format: this.format,
      sourceConceptId: this.sourceConceptId,
      sections: this.sections,
      template: this.template,
      history: this.history,
      metadata: this.metadata
    };
  }

  /**
   * Create a PRD from a plain object
   * @param {object} obj - Object to create from
   * @returns {PRD} - New PRD instance
   */
  static fromObject(obj) {
    const prd = new PRD(
      obj.title,
      obj.content,
      {
        id: obj.id,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        version: obj.version,
        format: obj.format,
        sourceConceptId: obj.sourceConceptId,
        sections: obj.sections,
        template: obj.template,
        history: obj.history,
        metadata: obj.metadata
      }
    );
    
    return prd;
  }
} 