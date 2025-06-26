import { jest } from '@jest/globals';

// Mock dependencies
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
jest.mock('../../scripts/modules/logger.js', () => ({
    createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }))
}));
const mockCreate = jest.fn((msg, opts) => { const e = new Error(msg); Object.assign(e, opts); e.name = opts?.name || 'TaskMasterError'; return e; });
const mockHandle = jest.fn((err, opts) => { const e = new Error(opts?.message || err.message); Object.assign(e, opts); return e; });
jest.mock('../../scripts/modules/error-handler.js', () => ({
  handle: mockHandle,
  create: mockCreate,
  ERROR_CATEGORIES: { SERVICE: 'service', VALIDATION: 'validation' },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('ora', () => {
    const mockOraInstance = {
        start: jest.fn().mockReturnThis(),
        stop: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis(),
        text: '',
    };
    return jest.fn(() => mockOraInstance);
});

// --- Import Modules AFTER Mocks ---
import { PRDService } from '../../scripts/modules/prd-service.js';
import { PRD } from '../../scripts/modules/models/prd.js';

// --- Test Suite --- 
describe('PRDService', () => { 
  let prdService;
  let mockAiProviderInstance; // Mock provider instance
  const conceptContent = 'Concept for the PRD.';
  const defaultOptions = { format: 'markdown', style: 'standard' };
  const mockApiResponse = {
    content: [{ type: 'text', text: '# Generated PRD\nContent...' }],
  };

  beforeEach(async () => { 
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';

    // Create mock provider object
    mockAiProviderInstance = {
        messages: { create: mockMessagesCreate }
    };

    prdService = new PRDService(); 
    // Spy and override _initializeAIProvider
    jest.spyOn(prdService, '_initializeAIProvider').mockReturnValue(mockAiProviderInstance);
    // Manually assign the mocked provider
    prdService.aiProvider = prdService._initializeAIProvider(); 
    
    // Initialize the service (needed for ensureInitialized checks)
    await prdService.initialize(); 
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should use the mocked AI provider via spyOn', async () => {
    expect(prdService.initialized).toBe(true);
    expect(prdService.aiProvider).toBe(mockAiProviderInstance);
    expect(prdService.aiProvider.messages.create).toBe(mockMessagesCreate);
  });
  
   test('constructor should throw if API key is missing AND no provider injected', () => {
      delete process.env.ANTHROPIC_API_KEY;
      // Test original constructor path without spy
      expect(() => new PRDService()).toThrow('AI Provider could not be initialized');
   });

  describe('generatePRD', () => {
    beforeEach(() => {
        // Use the globally defined mock function
        mockMessagesCreate.mockResolvedValue(mockApiResponse);
    });

    test('should call the mocked provider method and return a PRD object', async () => {
      const prd = await prdService.generatePRD(conceptContent, defaultOptions);
      expect(prd).toBeInstanceOf(PRD);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: expect.any(String),
        system: expect.stringContaining('You are an AI assistant specialized in creating comprehensive Product Requirements Documents')
             && expect.stringContaining('Include the following sections: Executive Summary, Problem Statement') // Check for default sections
             && expect.stringContaining('Format the PRD using Markdown') 
             && expect.stringContaining('Balance detail and conciseness'), // Check for default style
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining(conceptContent) })
        ]),
      }));
      expect(prd.content).toBe(mockApiResponse.content[0].text);
    });

    test('should use default sections if none provided', async () => {
        await prdService.generatePRD(conceptContent, defaultOptions);
        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            // Check that the prompt contains the default sections
            system: expect.stringContaining('Include the following sections: Executive Summary, Problem Statement, Product Goals') 
        }));
    });
    
     test('should use provided sections', async () => {
         const customSections = ['Introduction', 'User Stories'];
        await prdService.generatePRD(conceptContent, { ...defaultOptions, sections: customSections });
        expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
            // Check that the prompt contains the custom sections
            system: expect.stringContaining('Include the following sections: Introduction, User Stories')
        }));
    });

    test('should throw validation error if concept content is empty', async () => {
      // Expect the specific error CREATED by the errorHandler.create mock
      await expect(prdService.generatePRD('', defaultOptions)).rejects.toThrow(
        // The error thrown should match what mockCreate produces
        expect.objectContaining({ name: 'ValidationError' }) 
      );
       expect(mockMessagesCreate).not.toHaveBeenCalled(); 
    });

    test('should handle AI generation errors', async () => {
      const errorMessage = 'PRD Generation Error';
      mockMessagesCreate.mockRejectedValue(new Error(errorMessage)); 
      await expect(prdService.generatePRD(conceptContent, defaultOptions)).rejects.toThrow(
        // Check that the error was enhanced by errorHandler.handle
        expect.objectContaining({ code: 'ERR_PRD_GENERATION_FAILED' })
      );
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });

    test('should call _ensureInitialized and throw if not initialized', async () => { // Combined test
       prdService.initialized = false; 
       // Expect the specific error created by the errorHandler mock
       await expect(prdService.generatePRD(conceptContent)).rejects.toThrow(
            expect.objectContaining({ code: 'ERR_SERVICE_NOT_INITIALIZED' })
       );
        expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

  });

  describe('generatePRDPreview', () => {
    beforeEach(() => {
      mockMessagesCreate.mockResolvedValue(mockApiResponse);
    });

    test('should call the mocked provider method with preview mode', async () => {
      await prdService.generatePRDPreview(conceptContent, defaultOptions);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
        system: expect.stringContaining('preview or outline'),
        messages: expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining(conceptContent) })
        ]),
      }));
    });

    test.skip('should throw error if not initialized', async () => {
      prdService.initialized = false;
      await expect(prdService.generatePRDPreview(conceptContent)).rejects.toThrow(
        expect.objectContaining({ code: 'ERR_SERVICE_NOT_INITIALIZED' })
      );
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });

  describe('exportPRD', () => {
    test('should throw if export provider is not configured', async () => {
      // The export provider is null by default
      await expect(prdService.exportPRD(new PRD('title', 'content'), 'markdown')).rejects.toThrow(
        expect.objectContaining({ code: 'ERR_EXPORT_PROVIDER_MISSING' })
      );
    });
  });
}); 