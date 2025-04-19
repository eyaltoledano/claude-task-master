import { PRD } from '../../scripts/modules/models/prd.js';

describe('PRD Model', () => {
  let prdInstance;
  const title = 'Test PRD Title';
  const content = '# Test PRD Content\n\nSection 1...';
  const options = {
    format: 'markdown',
    sections: ['executive_summary', 'goals'],
    conceptId: 'concept-456',
    metadata: { generatedAt: '2023-01-02T00:00:00Z', model: 'claude-test' },
  };

  beforeEach(() => {
    prdInstance = new PRD(title, content, options);
  });

  test('should create a PRD instance with correct properties', () => {
    expect(prdInstance).toBeInstanceOf(PRD);
    expect(prdInstance.title).toBe(title);
    expect(prdInstance.content).toBe(content);
    expect(prdInstance.format).toBe(options.format);
    expect(prdInstance.sections).toEqual(options.sections);
    expect(prdInstance.conceptId).toBe(options.conceptId);
    expect(prdInstance.metadata).toEqual(options.metadata);
    expect(prdInstance.version).toBe(1);
    expect(prdInstance.createdAt).toBeDefined();
    expect(prdInstance.updatedAt).toBe(prdInstance.createdAt);
    expect(prdInstance.id).toBeDefined();
  });

  test('should update content and increment version', () => {
    const originalUpdatedAt = prdInstance.updatedAt;
    const newContent = '# Updated PRD Content\n\nNew section...';
    // Wait a tiny bit to ensure updatedAt changes
    return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
      prdInstance.updateContent(newContent);
      expect(prdInstance.content).toBe(newContent);
      expect(prdInstance.version).toBe(2);
      expect(prdInstance.updatedAt).not.toBe(originalUpdatedAt);
      expect(new Date(prdInstance.updatedAt) > new Date(originalUpdatedAt)).toBe(true);
    });
  });

  test('should add metadata correctly', () => {
    const newMetadata = { reviewedBy: 'Alice' };
    prdInstance.addMetadata(newMetadata);
    expect(prdInstance.metadata).toEqual({ ...options.metadata, ...newMetadata });
  });

  test('should convert to object correctly', () => {
    const prdObject = prdInstance.toObject();
    expect(prdObject).toEqual({
      id: prdInstance.id,
      title: title,
      content: content,
      version: 1,
      format: options.format,
      sections: options.sections,
      conceptId: options.conceptId,
      metadata: options.metadata,
      createdAt: prdInstance.createdAt,
      updatedAt: prdInstance.updatedAt,
    });
  });

  test('should create from object correctly', () => {
    const prdObject = prdInstance.toObject();
    const newPrdInstance = PRD.fromObject(prdObject);

    expect(newPrdInstance).toBeInstanceOf(PRD);
    expect(newPrdInstance.id).toBe(prdObject.id);
    expect(newPrdInstance.title).toBe(prdObject.title);
    expect(newPrdInstance.content).toBe(prdObject.content);
    expect(newPrdInstance.version).toBe(prdObject.version);
    expect(newPrdInstance.format).toBe(prdObject.format);
    expect(newPrdInstance.sections).toEqual(prdObject.sections);
    expect(newPrdInstance.conceptId).toBe(prdObject.conceptId);
    expect(newPrdInstance.metadata).toEqual(prdObject.metadata);
    expect(newPrdInstance.createdAt).toBe(prdObject.createdAt);
    expect(newPrdInstance.updatedAt).toBe(prdObject.updatedAt);
  });

  test('should handle missing options in constructor', () => {
    const simplePRD = new PRD('Simple Title', 'Simple Content');
    expect(simplePRD.format).toBe('markdown');
    expect(simplePRD.sections).toEqual([]);
    expect(simplePRD.conceptId).toBeNull();
    expect(simplePRD.metadata).toEqual({});
    expect(simplePRD.version).toBe(1);
  });

  test('fromObject should handle missing optional fields', () => {
    const minimalObject = {
      id: 'prd-min-1',
      title: 'Minimal PRD',
      content: 'Minimal content.',
    };
    const minimalPrd = PRD.fromObject(minimalObject);
    expect(minimalPrd.version).toBe(1);
    expect(minimalPrd.format).toBe('markdown');
    expect(minimalPrd.sections).toEqual([]);
    expect(minimalPrd.conceptId).toBeNull();
    expect(minimalPrd.metadata).toEqual({});
    expect(minimalPrd.createdAt).toBeDefined();
    expect(minimalPrd.updatedAt).toBe(minimalPrd.createdAt);
  });
}); 