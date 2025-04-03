import { jest } from '@jest/globals';

// --- Mock Dependencies --- 
const mockMessagesCreate = jest.fn(); // Define the mock function upfront
// Keep the basic SDK mock for constructor checks if needed, but rely on spyOn later
jest.mock('@anthropic-ai/sdk', () => {
    return {
        Anthropic: jest.fn().mockImplementation(() => ({ 
             messages: { create: () => { throw new Error('Mock constructor used unexpectedly'); } } 
        })),
    };
});
jest.mock('fs');
jest.mock('../../scripts/modules/utils.js', () => ({
  log: jest.fn(),
  CONFIG: { debug: false },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

// --- Import Modules AFTER Mocks --- 
import { IdeationService } from '../../scripts/modules/ideation-service.js';
import { Idea } from '../../scripts/modules/models/idea.js';

// --- Test Suite --- 
describe('IdeationService', () => { 
  let ideationService;
  let mockAiProviderInstance; // Instance of the provider with the mock function

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    
    // Create the object structure our service expects the provider to have
    mockAiProviderInstance = {
      messages: {
        create: mockMessagesCreate
      }
    };
    
    // Instantiate the service normally
    ideationService = new IdeationService(); 
    
    // *** Use jest.spyOn to override the _initializeAIProvider method ***
    // Make it return our mock provider instance *after* the service is created
    jest.spyOn(ideationService, '_initializeAIProvider').mockReturnValue(mockAiProviderInstance);
    // Manually assign the mocked provider after spying
    ideationService.aiProvider = ideationService._initializeAIProvider(); 
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should use the mocked AI provider via spyOn', () => {
    // Check that the provider is the one returned by our spy
    expect(ideationService.aiProvider).toBe(mockAiProviderInstance);
    expect(ideationService.aiProvider.messages.create).toBe(mockMessagesCreate);
  });

  test('should throw error if API key is missing during construction', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new IdeationService()).toThrow('AI Provider could not be initialized');
  });

  describe('generateConcept', () => {
    test('should call the mocked provider method and return concept string', async () => {
      const ideaInput = 'A simple to-do list app';
      const mockApiResponse = {
        content: [{ type: 'text', text: '# Concept Title\n\nConcept details...' }],
      };
      mockMessagesCreate.mockResolvedValue(mockApiResponse); 

      const conceptContent = await ideationService.generateConcept(ideaInput);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining(ideaInput) })
        ]),
      }));
      expect(conceptContent).toBe(mockApiResponse.content[0].text);
    });

    test('should throw an error if AI call fails', async () => {
      const ideaInput = 'Another app idea';
      const errorMessage = 'Anthropic API Error';
      mockMessagesCreate.mockRejectedValue(new Error(errorMessage)); 

      await expect(ideationService.generateConcept(ideaInput)).rejects.toThrow(
        `AI interaction failed during concept generation: ${errorMessage}`
      );
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });

     test('should throw an error if idea input is empty', async () => {
        await expect(ideationService.generateConcept('')).rejects.toThrow('Initial idea text is required for concept generation');
        await expect(ideationService.generateConcept('  ')).rejects.toThrow('Initial idea text is required for concept generation');
        expect(mockMessagesCreate).not.toHaveBeenCalled();
     });
  });

  describe('refineConcept', () => {
    const conceptContent = 'Original concept';
    const discussionContent = 'Discussion insights';
    const customPrompt = 'Focus on UI';
    const mockApiResponse = {
        content: [{ type: 'text', text: 'Refined concept details...' }],
      };

    test('should call the mocked provider method with discussion and prompt', async () => {
      mockMessagesCreate.mockResolvedValue(mockApiResponse); 
      const refinedContent = await ideationService.refineConcept(conceptContent, discussionContent, customPrompt);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
          system: expect.stringContaining(discussionContent) && expect.stringContaining(customPrompt)
      }));
      expect(refinedContent).toBe(mockApiResponse.content[0].text);
    });

    test('should call the mocked provider method with only discussion', async () => {
        mockMessagesCreate.mockResolvedValue(mockApiResponse); 
        const refinedContent = await ideationService.refineConcept(conceptContent, discussionContent, null);
        expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
         expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            system: expect.stringContaining(discussionContent) && expect.not.stringContaining('Additionally, consider the following')
        }));
        expect(refinedContent).toBe(mockApiResponse.content[0].text);
    });
    
     test('should call the mocked provider method with only custom prompt', async () => {
        mockMessagesCreate.mockResolvedValue(mockApiResponse); 
        const refinedContent = await ideationService.refineConcept(conceptContent, null, customPrompt);
        expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            system: expect.not.stringContaining('discussion transcript') && expect.stringContaining(customPrompt)
        }));
        expect(refinedContent).toBe(mockApiResponse.content[0].text);
    });

    test('should throw error if concept content is missing', async () => {
      await expect(ideationService.refineConcept('', discussionContent)).rejects.toThrow(
        'Original concept content is required'
      );
       expect(mockMessagesCreate).not.toHaveBeenCalled(); 
    });

    test('should throw error if neither discussion nor prompt is provided', async () => {
      await expect(ideationService.refineConcept(conceptContent, null, null)).rejects.toThrow(
        'Either discussion content or a custom prompt is required'
      );
      expect(mockMessagesCreate).not.toHaveBeenCalled(); 
    });

     test('should throw an error if AI call fails during refinement', async () => {
      const errorMessage = 'Refinement API Error';
      mockMessagesCreate.mockRejectedValue(new Error(errorMessage)); 
      await expect(ideationService.refineConcept(conceptContent, discussionContent)).rejects.toThrow(
        `AI interaction failed during concept refinement: ${errorMessage}`
      );
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1); 
    });

  });

}); 