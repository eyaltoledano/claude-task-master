import { jest } from '@jest/globals';

// --- Mock Dependencies --- 
const mockMessagesCreate = jest.fn(); // Define mock function upfront
jest.mock('@anthropic-ai/sdk', () => {
    return {
        Anthropic: jest.fn().mockImplementation(() => ({ 
             messages: { create: () => { throw new Error('Mock constructor used unexpectedly'); } } 
        })),
    };
});
jest.mock('../../scripts/modules/utils.js', () => ({
  log: jest.fn(),
  CONFIG: { debug: false },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

// --- Import Modules AFTER Mocks ---
import { DiscussionService } from '../../scripts/modules/discussion-service.js';
import { Discussion } from '../../scripts/modules/models/discussion.js';

// --- Test Suite ---
describe('DiscussionService', () => { 
  let discussionService;
  let mockAiProviderInstance;
  const concept = 'Test concept content.';
  const participants = ['Engineer', 'Designer'];

  beforeEach(async () => { // Make async if initialize is async
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // Create mock provider object
    mockAiProviderInstance = {
        messages: { create: mockMessagesCreate }
    };
    
    discussionService = new DiscussionService();
    // Spy and override _initializeAIProvider
    jest.spyOn(discussionService, '_initializeAIProvider').mockReturnValue(mockAiProviderInstance);
    // Manually assign the mocked provider
    discussionService.aiProvider = discussionService._initializeAIProvider(); 
    
    // Assuming DiscussionService might have an async initialize method like PRDService
    if (typeof discussionService.initialize === 'function') {
        await discussionService.initialize();
    }
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should use the mocked AI provider via spyOn', () => {
    expect(discussionService.aiProvider).toBe(mockAiProviderInstance);
    expect(discussionService.aiProvider.messages.create).toBe(mockMessagesCreate);
  });

  test('constructor should throw if API key is missing AND no provider setup', () => {
    delete process.env.ANTHROPIC_API_KEY;
    // Test original constructor path without spy
    expect(() => new DiscussionService()).toThrow('AI Provider could not be initialized');
  });

  describe('generateDiscussion', () => {
    const mockApiResponse = {
      content: [{ type: 'text', text: 'Engineer: ...\nDesigner: ...' }],
    };
    const mockInsightsResponse = {
       content: [{ type: 'text', text: JSON.stringify({ summary: 's', keyInsights: ['ki'], challenges: ['c'], actionItems: ['ai'] }) }]
    };

    test('should call the mocked provider method and return a Discussion object with insights', async () => {
      mockMessagesCreate.mockResolvedValueOnce(mockApiResponse);
      mockMessagesCreate.mockResolvedValueOnce(mockInsightsResponse);

      const discussion = await discussionService.generateDiscussion(concept, participants);

      expect(discussion).toBeInstanceOf(Discussion);
      expect(discussion.metadata.rawContent).toBe(mockApiResponse.content[0].text);
      expect(discussion.participants).toEqual(participants);
      expect(discussion.metadata.insights).toBeDefined();
      expect(discussion.metadata.insights.summary).toBe('s');
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2); 
      expect(mockMessagesCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        system: expect.stringContaining(participants.join(', ')),
      }));
      expect(mockMessagesCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
        system: expect.stringContaining('extract key information'),
      }));
    });
    
    test('should handle options like topics and focusTopics', async () => {
        mockMessagesCreate.mockResolvedValueOnce(mockApiResponse);
        mockMessagesCreate.mockResolvedValueOnce(mockInsightsResponse);
        const topics = ['Scalability', 'UI/UX'];
        
        await discussionService.generateDiscussion(concept, participants, { topics: topics, focusTopics: true });
        
        expect(mockMessagesCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
            system: expect.stringContaining('main goal is to discuss the following specific topics'),
        }));
    });

    test('should throw error if concept is empty', async () => {
      await expect(discussionService.generateDiscussion('', participants)).rejects.toThrow('Concept is required');
       expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    test('should throw error if less than two participants', async () => {
      await expect(discussionService.generateDiscussion(concept, ['Engineer'])).rejects.toThrow('At least two participants are required');
       expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    test('should handle AI error during discussion generation', async () => {
       const errorMessage = 'Discussion API Error';
       mockMessagesCreate.mockRejectedValueOnce(new Error(errorMessage)); 
       
       await expect(discussionService.generateDiscussion(concept, participants)).rejects.toThrow(
         `AI interaction failed during discussion generation: ${errorMessage}` // Expect the specific error
       );
       expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });
    
    test.skip('should handle AI error during insight extraction but still return discussion', async () => {
       const errorMessage = 'Insight API Error';
       // Setup mocks: First call (discussion generation) resolves, second call (insight extraction) rejects.
       mockMessagesCreate.mockResolvedValueOnce(mockApiResponse); 
       mockMessagesCreate.mockRejectedValueOnce(new Error(errorMessage)); 
       
       const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

       // Call generateDiscussion ONCE
       const discussionResult = await discussionService.generateDiscussion(concept, participants, { extractInsights: true });

       // Verify the result of the single call
       expect(discussionResult).toBeInstanceOf(Discussion);
       expect(discussionResult.metadata.insightsError).toBe(errorMessage);
       expect(discussionResult.metadata.insights.summary).toBe('Insight extraction failed'); // Check placeholder
       expect(consoleErrSpy).toHaveBeenCalledWith(expect.stringContaining('Error extracting insights:'), expect.any(Error));
       // Ensure the AI call mock was invoked twice (once for discussion, once for insights)
       expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
       
       consoleErrSpy.mockRestore();
    });
    
    test('should handle JSON parsing failure during insight extraction', async () => {
        const invalidJsonResponse = { content: [{ type: 'text', text: 'This is not JSON' }] };
        mockMessagesCreate.mockResolvedValueOnce(mockApiResponse); 
        mockMessagesCreate.mockResolvedValueOnce(invalidJsonResponse); 
        const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const discussion = await discussionService.generateDiscussion(concept, participants);

        expect(discussion).toBeInstanceOf(Discussion);
        expect(discussion.metadata.insights).toBeDefined();
        expect(discussion.metadata.insights.summary).toContain('Manual review recommended'); 
        expect(consoleErrSpy).toHaveBeenCalledWith("Raw content received:", expect.stringContaining('This is not JSON'));
        consoleErrSpy.mockRestore();
    });

  });

}); 