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
    this.storageProvider = config.storageProvider || null;
    // Initialize AI provider internally if not provided
    this.aiProvider = config.aiProvider || this._initializeAIProvider();
    
    if (!this.aiProvider) {
        throw new Error('AI Provider could not be initialized. Check ANTHROPIC_API_KEY environment variable.');
    }
  }
  
  /**
   * Initializes the default AI provider (Anthropic)
   * @private
   */
  _initializeAIProvider() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('ANTHROPIC_API_KEY not found in environment variables.');
        return null;
    }
    // This assumes the ai-services structure might be needed later or adapted
    // For now, just return a basic Anthropic client instance
    // TODO: Adapt this to match the actual AI provider interface/adapter used by ChatPRD if needed
    // Or integrate with the existing ai-services.js from claude-task-master 
    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultHeaders: {
            'anthropic-beta': 'output-128k-2025-02-19' // Example header, adjust if needed
        }
    });
    // Placeholder for the actual methods needed by generateIdeas/combineIdeas
    // This client needs methods like `generateIdeas` and `generateText` or we adapt the calls below
    // For now, we assume the Anthropic client directly might work or needs adaptation later
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
} 