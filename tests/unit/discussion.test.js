import { Discussion } from '../../scripts/modules/models/discussion.js';

describe('Discussion Model', () => {
  let discussionInstance;
  const title = 'Test Discussion Title';
  const messages = [
    { role: 'user', content: 'First message' },
    { role: 'assistant', content: 'Second message' },
  ];
  const options = {
    participants: ['Alice', 'Bob'],
    topics: ['Topic A', 'Topic B'],
    metadata: { sourceConceptId: 'concept-123' },
  };
  let fixedDateString; // Use a string for consistent comparison

  beforeEach(() => {
    fixedDateString = new Date().toISOString(); // Assign fixed date string
    discussionInstance = new Discussion(title, messages, {
        ...options,
        createdAt: fixedDateString // Pass the fixed string to constructor
    });
  });

  test('should create a Discussion instance with correct properties', () => {
    expect(discussionInstance).toBeInstanceOf(Discussion);
    expect(discussionInstance.title).toBe(title);
    expect(discussionInstance.messages.length).toBe(messages.length);
    expect(discussionInstance.participants).toEqual(options.participants);
    expect(discussionInstance.topics).toEqual(options.topics);
    expect(discussionInstance.metadata).toEqual(options.metadata);
    expect(discussionInstance.createdAt).toBe(fixedDateString);
    // Check message structure within the instance if needed
    expect(discussionInstance.messages[0].role).toBe(messages[0].role);
    expect(discussionInstance.messages[0].content).toBe(messages[0].content);
    // Insights should not exist initially
    expect(discussionInstance.metadata.insights).toBeUndefined();
  });

  test('should add metadata correctly', () => {
    const newMetadata = { insights: { summary: 'Test Summary' } };
    discussionInstance.addMetadata(newMetadata);
    // Expect metadata to be merged
    expect(discussionInstance.metadata).toEqual({ ...options.metadata, ...newMetadata });
    expect(discussionInstance.metadata.insights.summary).toBe('Test Summary');
  });

  test('should convert to object correctly', () => {
    const discussionObject = discussionInstance.toObject();
    expect(discussionObject).toEqual({
      title: title,
      messages: messages, // Assuming constructor stores initial messages
      participants: options.participants,
      topics: options.topics,
      metadata: options.metadata,
      createdAt: fixedDateString, // Expect the fixed string date
    });
  });

  test('should create from object correctly', () => {
    // Create an object with the fixed date string
    const discussionObject = {
        title: title,
        messages: messages, 
        participants: options.participants,
        topics: options.topics,
        metadata: options.metadata,
        createdAt: fixedDateString, // Use fixed date string
    };
    const newDiscussionInstance = Discussion.fromObject(discussionObject);

    expect(newDiscussionInstance).toBeInstanceOf(Discussion);
    // Compare date strings directly
    expect(newDiscussionInstance.createdAt).toBe(fixedDateString);
    expect(newDiscussionInstance.title).toBe(discussionObject.title);
    expect(newDiscussionInstance.messages).toEqual(discussionObject.messages);
    expect(newDiscussionInstance.participants).toEqual(discussionObject.participants);
    expect(newDiscussionInstance.topics).toEqual(discussionObject.topics);
    expect(newDiscussionInstance.metadata).toEqual(discussionObject.metadata);
  });

  test('should handle missing options in constructor', () => {
    const simpleDiscussion = new Discussion('Simple Title');
    expect(simpleDiscussion.messages).toEqual([]);
    expect(simpleDiscussion.participants).toEqual([]);
    expect(simpleDiscussion.topics).toEqual([]);
    expect(simpleDiscussion.metadata).toEqual({});
    expect(simpleDiscussion.createdAt).toBeDefined(); // Should still get a date
  });

  test('should add a message correctly', () => {
    const newMessage = { role: 'user', content: 'New message' };
    discussionInstance.addMessage(newMessage);
    
    expect(discussionInstance.messages.length).toBe(3);
    expect(discussionInstance.messages[2].role).toBe(newMessage.role);
    expect(discussionInstance.messages[2].content).toBe(newMessage.content);
    expect(discussionInstance.messages[2].timestamp).toBeDefined();
  });

  test('should throw error when adding invalid message', () => {
    expect(() => discussionInstance.addMessage({ content: 'Missing role' }))
      .toThrow('Message must have role and content properties');
    
    expect(() => discussionInstance.addMessage({ role: 'user' }))
      .toThrow('Message must have role and content properties');
  });

  test('should generate transcript in text format', () => {
    const transcript = discussionInstance.getTranscript();
    
    expect(transcript).toContain(title);
    expect(transcript).toContain('Participants:');
    expect(transcript).toContain('Alice');
    expect(transcript).toContain('Bob');
    expect(transcript).toContain('Topics:');
    expect(transcript).toContain('Topic A');
    expect(transcript).toContain('Discussion:');
    expect(transcript).toContain('user:');
    expect(transcript).toContain('First message');
    expect(transcript).toContain('assistant:');
    expect(transcript).toContain('Second message');
  });

  test('should generate transcript in markdown format', () => {
    const transcript = discussionInstance.getTranscript({ format: 'markdown' });
    
    expect(transcript).toContain(`# ${title}`);
    expect(transcript).toContain('## Participants');
    expect(transcript).toContain('- Alice');
    expect(transcript).toContain('- Bob');
    expect(transcript).toContain('## Topics');
    expect(transcript).toContain('- Topic A');
    expect(transcript).toContain('## Discussion');
    expect(transcript).toContain('### user');
    expect(transcript).toContain('First message');
    expect(transcript).toContain('### assistant');
    expect(transcript).toContain('Second message');
  });
}); 