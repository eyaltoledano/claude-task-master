/**
 * Model class for round-table discussions
 */
export class Discussion {
  /**
   * Create a new discussion
   * @param {string} title - Discussion title
   * @param {Array<object>} messages - Discussion messages
   * @param {object} options - Additional options (participants, topics, metadata, createdAt)
   */
  constructor(title, messages = [], options = {}) {
    this.title = title;
    this.messages = messages;
    this.participants = options.participants || [];
    this.topics = options.topics || [];
    this.metadata = options.metadata || {};
    // Use provided createdAt string directly, or generate new one if missing/invalid
    this.createdAt = (options.createdAt && typeof options.createdAt === 'string') 
                        ? options.createdAt 
                        : new Date().toISOString();
  }

  /**
   * Add a message to the discussion
   * @param {object} message - Message to add (role, content)
   */
  addMessage(message) {
    if (!message.role || !message.content) {
      throw new Error('Message must have role and content properties');
    }
    
    this.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    
    return this;
  }

  /**
   * Add metadata to this discussion
   * @param {object} metadata - Additional metadata
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Get a transcript of the discussion
   * @param {object} options - Format options
   * @returns {string} Discussion transcript
   */
  getTranscript(options = {}) {
    const format = options.format || 'text';
    let transcript = '';
    
    if (format === 'markdown') {
      transcript = `# ${this.title}\n\n`;
      
      if (this.participants.length > 0) {
        transcript += '## Participants\n\n';
        for (const participant of this.participants) {
          transcript += `- ${participant}\n`;
        }
        transcript += '\n';
      }
      
      if (this.topics.length > 0) {
        transcript += '## Topics\n\n';
        for (const topic of this.topics) {
          transcript += `- ${topic}\n`;
        }
        transcript += '\n';
      }
      
      transcript += '## Discussion\n\n';
      
      for (const message of this.messages) {
        transcript += `### ${message.role}\n\n${message.content}\n\n`;
      }
    } else {
      // Default text format
      transcript = `${this.title}\n\n`;
      
      if (this.participants.length > 0) {
        transcript += 'Participants:\n';
        for (const participant of this.participants) {
          transcript += `- ${participant}\n`;
        }
        transcript += '\n';
      }
      
      if (this.topics.length > 0) {
        transcript += 'Topics:\n';
        for (const topic of this.topics) {
          transcript += `- ${topic}\n`;
        }
        transcript += '\n';
      }
      
      transcript += 'Discussion:\n\n';
      
      for (const message of this.messages) {
        transcript += `${message.role}:\n${message.content}\n\n`;
      }
    }
    
    return transcript;
  }

  /**
   * Convert to plain object
   * @returns {object} Plain object representation
   */
  toObject() {
    return {
      title: this.title,
      messages: this.messages,
      participants: this.participants,
      topics: this.topics,
      metadata: this.metadata,
      createdAt: this.createdAt // Always a string from constructor
    };
  }

  /**
   * Create a Discussion instance from a plain object
   * @param {object} obj - Plain object
   * @returns {Discussion} Discussion instance
   */
  static fromObject(obj) {
    // Ensure all relevant properties from the object are passed to the constructor options
    const options = {
        participants: obj.participants,
        topics: obj.topics,
        metadata: obj.metadata,
        createdAt: obj.createdAt // Pass the exact createdAt string from the object
    };
    // Pass messages array, defaulting to empty if missing
    return new Discussion(obj.title, obj.messages || [], options);
  }
} 