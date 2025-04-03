/**
 * Service for generating and managing ideas
 */
import { Idea } from './models/idea.js';
// Attempt to import the Anthropic client - might need adjustment based on actual export
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config(); // Ensure env variables are loaded

/**
 * Service for generating and managing ideas
 */
export class IdeationService {
  /**
   * Create a new ideation service
   * @param {object} config - Configuration options (optional, can include aiProvider, storageProvider)
   */
  constructor(config = {}) {
    console.log('DEBUG: [IdeationService] Constructor started.'); // Log start
    this.storageProvider = config.storageProvider || null;
    
    console.log('DEBUG: [IdeationService] Initializing AI Provider...'); // Log before init
    this.aiProvider = config.aiProvider || this._initializeAIProvider();
    console.log('DEBUG: [IdeationService] AI Provider initialized (type:', typeof this.aiProvider, ').'); // Log after init
    
    if (!this.aiProvider) {
        // This error should stop execution if aiProvider is null/undefined
        console.error('ERROR: [IdeationService] AI Provider is null or undefined AFTER initialization attempt!');
        throw new Error('AI Provider could not be initialized. Check ANTHROPIC_API_KEY environment variable.');
    }
    console.log('DEBUG: [IdeationService] Constructor finished successfully.');
  }
  
  /**
   * Initializes the default AI provider (Anthropic)
   * @private
   */
  _initializeAIProvider() {
    console.log('DEBUG: [IdeationService] Running _initializeAIProvider...'); // Log helper start
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('WARN: [IdeationService] ANTHROPIC_API_KEY not found in environment variables. Returning null.');
        return null;
    }
    try {
        console.log('DEBUG: [IdeationService] Attempting to create Anthropic client...'); // Log before new Anthropic
        const client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            defaultHeaders: {
                'anthropic-beta': 'output-128k-2025-02-19'
            }
        });
        console.log('DEBUG: [IdeationService] Anthropic client created successfully.'); // Log success
        return client;
    } catch (error) {
        console.error('ERROR: [IdeationService] Failed to create Anthropic client:', error);
        return null; // Return null on error
    }
  }

  /**
   * Generate ideas based on a topic
   * @param {string} topic - The topic to generate ideas for
   * @param {object} options - Generation options
   * @returns {Promise<Array<Idea>>} - Array of generated ideas
   */
  async generateIdeas(topic, options = {}) {
    if (!topic || topic.trim().length === 0) {
      throw new Error('Topic is required for idea generation');
    }
    
    // Set default options
    const defaultOptions = {
      count: 5,
      temperature: 0.7,
      includeTags: true,
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219' // Use model from env or default
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // --- ADAPTATION NEEDED --- 
    // The original code called `this.aiProvider.generateIdeas(topic, mergedOptions);`
    // This assumes aiProvider has a `generateIdeas` method.
    // The basic Anthropic client does NOT. We need to call `this.aiProvider.messages.create`
    // with a suitable prompt to generate ideas.
    
    // Example prompt construction (needs refinement)
    const systemPrompt = `You are an AI assistant specialized in brainstorming. Generate ${mergedOptions.count} distinct ideas related to the topic: ${topic}. For each idea, provide a concise title and a brief description. Optionally include relevant tags. Respond in JSON format: { ideas: [ { title: "...", description: "...", tags: ["..."] } ] }`;
    const userPrompt = `Generate ideas for: ${topic}`; 
    
    let rawIdeas = [];
    try {
      const response = await this.aiProvider.messages.create({
          model: mergedOptions.model,
          max_tokens: 4000, // Adjust as needed
          temperature: mergedOptions.temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
      });
      
      // Attempt to parse the JSON response
      // TODO: Add robust error handling for JSON parsing and response structure
      let responseContent = response.content[0].text;

      // --- BEGIN ADDED EXTRACTION LOGIC ---
      // Attempt to extract JSON from markdown code block
      const jsonRegex = /```json\n([\s\S]*?)\n```/;
      const match = responseContent.match(jsonRegex);
      let jsonToParse = responseContent; // Default to original if regex fails

      if (match && match[1]) {
        jsonToParse = match[1];
        console.log('[IdeationService] Extracted JSON from markdown block.'); // Optional debug log
      } else {
        console.log('[IdeationService] No markdown block detected, attempting to parse directly.'); // Optional debug log
      }
      // --- END ADDED EXTRACTION LOGIC ---
      
      const parsedResponse = JSON.parse(jsonToParse); // Parse the potentially extracted JSON
      if (parsedResponse && parsedResponse.ideas) {
          rawIdeas = parsedResponse.ideas;
      } else {
          console.error("Failed to parse ideas from AI response:", responseContent);
          // Handle fallback or throw error
      }

    } catch (aiError) {
        console.error("Error calling AI for idea generation:", aiError);
        throw new Error(`AI interaction failed during idea generation: ${aiError.message}`);
    }
    // --- END ADAPTATION --- 

    // Convert raw ideas to Idea models
    const ideas = rawIdeas.map(idea => {
      const metadata = {
        generatedAt: new Date().toISOString(),
        topic,
        generationOptions: mergedOptions
      };
      
      return new Idea(
        idea.title || `Idea about ${topic}`,
        idea.description || '',
        {
          tags: idea.tags || [topic],
          metadata
        }
      );
    });
    
    // Save ideas if storage provider exists
    if (this.storageProvider) {
      try {
        // TODO: Ensure storageProvider interface matches if used
        const savedId = await this.storageProvider.saveIdeas(topic, ideas.map(i => i.toObject())); // Save plain objects
        
        // Add storage reference to each idea
        ideas.forEach(idea => {
          idea.addMetadata({
            storageId: savedId,
            isSaved: true
          });
        });
      } catch (error) {
        console.error('Error saving ideas:', error);
        
        // Add flag indicating the ideas weren't saved
        ideas.forEach(idea => {
          idea.addMetadata({
            isSaved: false,
            saveError: error.message
          });
        });
      }
    }
    
    return ideas;
  }

  /**
   * Get previously generated ideas
   * @param {string} topic - The topic to get ideas for
   * @returns {Promise<Array<Idea>>} - Array of ideas
   */
  async getSavedIdeas(topic) {
    if (!this.storageProvider) {
      throw new Error('No storage provider available');
    }
    
    // TODO: Ensure storageProvider interface matches if used
    const rawIdeas = await this.storageProvider.getIdeas(topic);
    
    if (!rawIdeas || rawIdeas.length === 0) {
      return [];
    }
    
    // Convert raw ideas to Idea models
    return rawIdeas.map(idea => Idea.fromObject(idea));
  }

  /**
   * Rate and sort ideas
   * @param {Array<Idea>} ideas - Ideas to rate
   * @param {object} criteria - Rating criteria and weights
   * @returns {Promise<Array<Idea>>} - Rated and sorted ideas
   */
  async rateIdeas(ideas, criteria = {}) {
    // Default criteria if none provided
    const defaultCriteria = {
      novelty: 0.3,
      feasibility: 0.3,
      impact: 0.4
    };
    
    const mergedCriteria = { ...defaultCriteria, ...criteria };
    
    // Rate each idea (in a real implementation, this might use the AI)
    for (const idea of ideas) {
      // For this example, we're just assigning random scores
      // In a real implementation, this would use more sophisticated logic
      const novelty = Math.random();
      const feasibility = Math.random();
      const impact = Math.random();
      
      // Calculate weighted score
      const score = (
        novelty * mergedCriteria.novelty +
        feasibility * mergedCriteria.feasibility +
        impact * mergedCriteria.impact
      );
      
      // Add ratings to metadata
      idea.addMetadata({
        ratings: {
          novelty,
          feasibility,
          impact
        }
      });
      
      // Set the score
      idea.setScore(score);
    }
    
    // Sort ideas by score, descending
    return ideas.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate a structured product concept from an initial idea text.
   * This is intended for the initial 'ideate' step in the PRD workflow.
   * @param {string} ideaText - The initial idea or problem statement.
   * @param {object} options - Generation options (e.g., model, temperature).
   * @returns {Promise<string>} - The generated concept content as a string.
   */
  async generateConcept(ideaText, options = {}) {
    console.log('DEBUG: [IdeationService] generateConcept called.'); // Add log
    if (!ideaText || ideaText.trim().length === 0) {
      throw new Error('Initial idea text is required for concept generation');
    }
    const defaultOptions = {
      temperature: 0.7,
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219'
    };
    const mergedOptions = { ...defaultOptions, ...options };
    const systemPrompt = `You are an AI assistant helping define a new product or feature. Based on the user's initial idea, generate a structured product concept document.
The concept should cover:
1.  **Problem Statement:** Clearly define the problem this idea solves.
2.  **Proposed Solution:** Describe the core idea and how it addresses the problem.
3.  **Goals/Objectives:** What are the primary goals of this product/feature?
4.  **Target Audience:** Who is this for?
5.  **Key Features:** List the essential features or components.
6.  **Success Metrics:** How will success be measured?
Format the output clearly using Markdown. Respond ONLY with the concept document content.`;
    const userPrompt = `Expand the following idea into a structured product concept:\n\nIdea: "${ideaText}"`;
    let generatedContent = '';
    try {
      console.log('DEBUG: [IdeationService] Calling AI for concept generation...'); // Add log
      if (!this.aiProvider || typeof this.aiProvider.messages?.create !== 'function') {
          console.error('ERROR: [IdeationService] aiProvider or messages.create is invalid!', this.aiProvider);
          throw new Error('AI Provider is not configured correctly within IdeationService.');
      }
      const response = await this.aiProvider.messages.create({
        model: mergedOptions.model,
        max_tokens: 4000, 
        temperature: mergedOptions.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });
      
      // Handle potential variations in response structure
      if (response && response.content && response.content.length > 0 && response.content[0].text) {
        generatedContent = response.content[0].text;
      } else {
          // Log unexpected structure for debugging
          console.error('Unexpected AI response structure in generateConcept:', JSON.stringify(response));
          throw new Error('AI response did not contain expected text content.');
      }

      // Return only the content string
      return generatedContent;

    } catch (aiError) {
      console.error("Error calling AI for concept generation:", aiError);
      // Re-throw a more specific error
      throw new Error(`AI interaction failed during concept generation: ${aiError.message}`);
    }
  }

  /**
   * Combine multiple ideas into a new idea
   * @param {Array<Idea>} ideas - Ideas to combine
   * @param {string} theme - Optional theme for the combination
   * @returns {Promise<Idea>} - Combined idea
   */
  async combineIdeas(ideas, theme = null) {
    if (!ideas || ideas.length < 2) {
      throw new Error('At least two ideas are required for combination');
    }
    
    // Extract titles and descriptions
    const ideaTitles = ideas.map(idea => idea.title);
    const ideaDescriptions = ideas.map(idea => idea.description);
    
    // Create prompt for the AI
    const prompt = `
I have the following ideas:
${ideaTitles.map((title, i) => `${i + 1}. ${title}: ${ideaDescriptions[i]}`).join('\n')}

Please combine these ideas into a single, stronger idea${theme ? ` around the theme of ${theme}` : ''}.
Provide a title and description for this combined idea.
    `.trim();
    
    // --- ADAPTATION NEEDED --- 
    // The original code called `this.aiProvider.generateText(prompt);`
    // This assumes aiProvider has a `generateText` method.
    // We need to call `this.aiProvider.messages.create`

    let responseText = '';
    try {
        const response = await this.aiProvider.messages.create({
            model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
            max_tokens: 1000, // Adjust as needed
            temperature: 0.7,
            // Simple system prompt for text generation
            system: "You are a helpful assistant.", 
            messages: [{ role: 'user', content: prompt }]
        });
        responseText = response.content[0].text;
    } catch (aiError) {
        console.error("Error calling AI for idea combination:", aiError);
        throw new Error(`AI interaction failed during idea combination: ${aiError.message}`);
    }
    // --- END ADAPTATION --- 

    // Extract title and description from the response
    // This is a simplified extraction - a real implementation would be more robust
    let title = '';
    let description = '';
    
    const titleMatch = responseText.match(/(?:Title|Combined Idea):(.*?)(?:\n|$)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      description = responseText.replace(titleMatch[0], '').trim();
    } else {
      // If we can't clearly identify a title, use the first line
      const lines = responseText.split('\n');
      title = lines[0].trim();
      description = lines.slice(1).join('\n').trim();
    }
    
    // Create a new idea from the combination
    const combinedIdea = new Idea(title, description, {
      tags: [...new Set(ideas.flatMap(idea => idea.tags))],
      metadata: {
        combinedFrom: ideas.map(idea => idea.id),
        theme: theme,
        generatedAt: new Date().toISOString()
      }
    });
    
    return combinedIdea;
  }

  /**
   * Refine an existing product concept using discussion insights and/or a custom prompt.
   * @param {string} conceptContent - The current content of the concept document.
   * @param {string|null} discussionContent - The content of the discussion transcript (optional).
   * @param {string|null} customPrompt - A specific prompt guiding the refinement (optional).
   * @param {object} options - Generation options (e.g., model, temperature).
   * @returns {Promise<string>} - The refined concept content as a string.
   */
  async refineConcept(conceptContent, discussionContent = null, customPrompt = null, options = {}) {
    if (!conceptContent || conceptContent.trim().length === 0) {
      throw new Error('Original concept content is required for refinement.');
    }
    if (!discussionContent && !customPrompt) {
      throw new Error('Either discussion content or a custom prompt is required for refinement.');
    }

    // Set default options
    const defaultOptions = {
      temperature: 0.6, // Slightly lower temp for refinement
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219'
    };
    const mergedOptions = { ...defaultOptions, ...options };

    // Construct the system prompt
    let systemPrompt = `You are an AI assistant tasked with refining a product concept based on additional input.

The original concept is:
--- START CONCEPT ---
${conceptContent}
--- END CONCEPT ---`;

    if (discussionContent) {
        systemPrompt += `\n\nPlease refine the concept above based on the insights and recommendations from the following discussion transcript:
--- START DISCUSSION ---
${discussionContent}
--- END DISCUSSION ---`;
    }

    if (customPrompt) {
        systemPrompt += `\n\nAdditionally, consider the following specific instruction for refinement:
Instruction: "${customPrompt}"`;
    }

     systemPrompt += `\n\nRewrite the entire concept document, incorporating the necessary refinements based on the provided discussion and/or instruction. Ensure the refined concept maintains a clear structure (Problem, Solution, Goals, Features, etc.). Respond ONLY with the full refined concept document content.`;

    const userPrompt = "Refine the product concept based on the provided context.";

    let refinedContent = '';
    try {
      const response = await this.aiProvider.messages.create({
        model: mergedOptions.model,
        max_tokens: 4000, // Concept might grow
        temperature: mergedOptions.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      if (response.content && response.content.length > 0 && response.content[0].text) {
          refinedContent = response.content[0].text;
      } else {
          throw new Error('AI response did not contain expected refined concept content.');
      }

    } catch (aiError) {
      console.error("Error calling AI for concept refinement:", aiError);
      throw new Error(`AI interaction failed during concept refinement: ${aiError.message}`);
    }

    return refinedContent;
  }
} 