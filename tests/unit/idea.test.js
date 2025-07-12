import { Idea } from '../../scripts/modules/models/idea.js';

describe('Idea Model', () => {
  let ideaInstance;
  const title = 'Test Idea Title';
  const description = 'Test Idea Description';
  const options = {
    tags: ['tag1', 'tag2'],
    metadata: { generatedAt: '2023-01-01T00:00:00Z' },
  };

  beforeEach(() => {
    ideaInstance = new Idea(title, description, options);
  });

  test('should create an Idea instance with correct properties', () => {
    expect(ideaInstance).toBeInstanceOf(Idea);
    expect(ideaInstance.title).toBe(title);
    expect(ideaInstance.description).toBe(description);
    expect(ideaInstance.tags).toEqual(options.tags);
    expect(ideaInstance.metadata).toEqual(options.metadata);
    expect(ideaInstance.score).toBe(0);
    expect(ideaInstance.id).toBeDefined();
  });

  test('should add metadata correctly', () => {
    const newMetadata = { updated: true };
    ideaInstance.addMetadata(newMetadata);
    expect(ideaInstance.metadata).toEqual({ ...options.metadata, ...newMetadata });
  });

  test('should set score correctly', () => {
    const score = 0.85;
    ideaInstance.setScore(score);
    expect(ideaInstance.score).toBe(score);
  });

  test('should convert to object correctly', () => {
    const ideaObject = ideaInstance.toObject();
    expect(ideaObject).toEqual({
      id: ideaInstance.id,
      title: title,
      description: description,
      tags: options.tags,
      score: 0,
      metadata: options.metadata,
      createdAt: ideaInstance.createdAt
    });
  });

  test('should create from object correctly', () => {
    const ideaObject = ideaInstance.toObject();
    const newIdeaInstance = Idea.fromObject(ideaObject);

    expect(newIdeaInstance).toBeInstanceOf(Idea);
    expect(newIdeaInstance.id).toBe(ideaObject.id);
    expect(newIdeaInstance.title).toBe(ideaObject.title);
    expect(newIdeaInstance.description).toBe(ideaObject.description);
    expect(newIdeaInstance.tags).toEqual(ideaObject.tags);
    expect(newIdeaInstance.score).toBe(ideaObject.score);
    expect(newIdeaInstance.metadata).toEqual(ideaObject.metadata);
  });

  test('should generate a unique ID for each instance', () => {
    const idea2 = new Idea('Another Title', 'Another Desc');
    expect(ideaInstance.id).not.toBe(idea2.id);
  });

  test('should handle missing options in constructor', () => {
    const simpleIdea = new Idea('Simple Title', 'Simple Desc');
    expect(simpleIdea.tags).toEqual([]);
    expect(simpleIdea.metadata).toEqual({});
    expect(simpleIdea.score).toBe(0);
  });
}); 