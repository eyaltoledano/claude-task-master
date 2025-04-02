/**
 * Represents an expert discussion about a concept
 */
export class Discussion {
  /**
   * Create a new discussion
   * @param {string} content - The content of the discussion
   * @param {Array<string>} participants - The participants in the discussion
   * @param {object} options - Additional options
   */
  constructor(content, participants, options = {}) {
    this.id = options.id || `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.content = content;
    this.participants = participants;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.sourceConceptId = options.sourceConceptId || null;
    this.summary = options.summary || null;
    this.keyInsights = options.keyInsights || [];
    this.challenges = options.challenges || [];
    this.actionItems = options.actionItems || [];
    this.metadata = options.metadata || {};
  }

  /**
   * Update the discussion summary and insights
   * @param {object} insights - Discussion insights 
   * @returns {Discussion} - This discussion for chaining
   */
  updateInsights(insights) {
    this.summary = insights.summary || this.summary;
    this.keyInsights = insights.keyInsights || this.keyInsights;
    this.challenges = insights.challenges || this.challenges;
    this.actionItems = insights.actionItems || this.actionItems;
    this.metadata.insightsUpdatedAt = new Date().toISOString();
    
    return this;
  }

  /**
   * Add a participant to the discussion
   * @param {string} participant - Participant to add
   * @returns {Discussion} - This discussion for chaining
   */
  addParticipant(participant) {
    if (!this.participants.includes(participant)) {
      this.participants.push(participant);
    }
    return this;
  }

  /**
   * Add metadata to the discussion
   * @param {object} metadata - Metadata to add
   * @returns {Discussion} - This discussion for chaining
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Check if insights have been extracted
   * @returns {boolean} - Whether insights have been extracted
   */
  hasInsights() {
    return Boolean(this.summary);
  }

  /**
   * Convert the discussion to a plain object
   * @returns {object} - Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      content: this.content,
      participants: this.participants,
      createdAt: this.createdAt,
      sourceConceptId: this.sourceConceptId,
      summary: this.summary,
      keyInsights: this.keyInsights,
      challenges: this.challenges,
      actionItems: this.actionItems,
      metadata: this.metadata
    };
  }

  /**
   * Create a Discussion from a plain object
   * @param {object} obj - Object to create from
   * @returns {Discussion} - New Discussion instance
   */
  static fromObject(obj) {
    const discussion = new Discussion(
      obj.content,
      obj.participants,
      {
        id: obj.id,
        createdAt: obj.createdAt,
        sourceConceptId: obj.sourceConceptId,
        summary: obj.summary,
        keyInsights: obj.keyInsights,
        challenges: obj.challenges,
        actionItems: obj.actionItems,
        metadata: obj.metadata
      }
    );
    
    return discussion;
  }
} 