/**
 * Service for generating and managing expert discussions
 */
import { Discussion } from './models/discussion.js';
// Attempt to import the Anthropic client - might need adjustment based on actual export
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config(); // Ensure env variables are loaded

/**
 * Service for generating and managing expert discussions
 */
export class DiscussionService {
  /**
   * Create a new discussion service
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
    return new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultHeaders: {
        'anthropic-beta': 'output-128k-2025-02-19' // Example header, adjust if needed
      }
    });
    // Placeholder for the actual methods needed
  }

  /**
   * Generate an expert discussion about a concept
   * @param {string} concept - The concept to discuss
   * @param {Array<string>} participants - The participants/roles for the discussion
   * @param {object} options - Generation options
   * @returns {Promise<Discussion>} - The generated discussion
   */
  async generateDiscussion(concept, participants, options = {}) {
    if (!concept || concept.trim().length === 0) {
      throw new Error('Concept is required for discussion generation');
    }
    
    if (!participants || participants.length < 2) {
      throw new Error('At least two participants are required for a discussion');
    }
    
    // Set default options
    const defaultOptions = {
      temperature: 0.8,
      extractInsights: true,
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219' // Use model from env or default
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // --- ADAPTATION NEEDED --- 
    // Original called `this.aiProvider.generateDiscussion(concept, participants, mergedOptions);`
    // Assumes aiProvider has `generateDiscussion`. Basic Anthropic client needs `messages.create`.
    
    const systemPrompt = `You are facilitating a round table discussion between the following experts: ${participants.join(', ')}.
The topic is the following product concept:
${concept}

Simulate a realistic, insightful discussion where the experts analyze the concept, identify strengths, weaknesses, potential issues, and suggest improvements. Each expert should contribute from their unique perspective. Ensure the discussion flows naturally and covers key aspects of the concept. Format the output as a transcript.`;
    const userPrompt = `Start the discussion about the product concept.`;

    let discussionContent = '';
    try {
        const response = await this.aiProvider.messages.create({
            model: mergedOptions.model,
            max_tokens: 4000, // Adjust as needed
            temperature: mergedOptions.temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        });
        discussionContent = response.content[0].text;
    } catch (aiError) {
        console.error("Error calling AI for discussion generation:", aiError);
        throw new Error(`AI interaction failed during discussion generation: ${aiError.message}`);
    }
    // --- END ADAPTATION --- 

    // Create Discussion model
    const discussion = new Discussion(
      discussionContent,
      participants,
      {
        sourceConceptId: options.sourceConceptId,
        metadata: {
          generatedAt: new Date().toISOString(),
          generationOptions: mergedOptions
        }
      }
    );
    
    // Extract insights if requested
    if (mergedOptions.extractInsights) {
      try {
        const insights = await this.extractInsights(discussionContent);
        discussion.updateInsights(insights);
      } catch (error) {
        console.error('Error extracting insights:', error);
        discussion.addMetadata({
          insightsError: error.message
        });
      }
    }
    
    // Save discussion if storage provider exists
    if (this.storageProvider) {
      try {
        // TODO: Ensure storageProvider interface matches
        const savedId = await this.storageProvider.saveDiscussion(
          discussion.toObject() // Save plain object
        );
        
        discussion.addMetadata({
          storageId: savedId,
          isSaved: true
        });
      } catch (error) {
        console.error('Error saving discussion:', error);
        discussion.addMetadata({
          isSaved: false,
          saveError: error.message
        });
      }
    }
    
    return discussion;
  }

  /**
   * Extract insights from a discussion
   * @param {string} discussionContent - The discussion content
   * @param {object} options - Extraction options
   * @returns {Promise<object>} - Extracted insights
   */
  async extractInsights(discussionContent, options = {}) {
    if (!discussionContent || discussionContent.trim().length === 0) {
      throw new Error('Discussion content is required for insight extraction');
    }
    
    // Set default options
    const defaultOptions = {
      comprehensive: true,
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219'
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // --- ADAPTATION NEEDED --- 
    // Original called `this.aiProvider.extractInsights(discussionContent, mergedOptions);`
    // Assumes aiProvider has `extractInsights`. Basic Anthropic client needs `messages.create`.
    
    const systemPrompt = `You are an AI assistant skilled at analyzing discussion transcripts. Analyze the following discussion and extract key information. Respond in JSON format: { summary: "...", keyInsights: ["..."], challenges: ["..."], actionItems: ["..."] }`;
    const userPrompt = `Extract insights from this discussion:
${discussionContent}`; 

    let insights = {};
    try {
        const response = await this.aiProvider.messages.create({
            model: mergedOptions.model,
            max_tokens: 1000, // Adjust as needed
            temperature: 0.5, // Lower temp for extraction
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        });
        
        // Attempt to parse the JSON response
        // TODO: Add robust error handling for JSON parsing and response structure
        const responseContent = response.content[0].text;
        insights = JSON.parse(responseContent);

    } catch (aiError) {
        console.error("Error calling AI for insight extraction:", aiError);
        throw new Error(`AI interaction failed during insight extraction: ${aiError.message}`);
    }
    // --- END ADAPTATION --- 

    return insights;
  }

  /**
   * Get a saved discussion
   * @param {string} id - The discussion ID
   * @returns {Promise<Discussion>} - The discussion
   */
  async getDiscussion(id) {
    if (!this.storageProvider) {
      throw new Error('No storage provider available');
    }
    
    // TODO: Ensure storageProvider interface matches
    const rawDiscussion = await this.storageProvider.getDiscussion(id);
    
    if (!rawDiscussion) {
      throw new Error(`Discussion with ID ${id} not found`);
    }
    
    // Convert raw discussion to Discussion model
    return Discussion.fromObject(rawDiscussion);
  }

  /**
   * List all saved discussions
   * @returns {Promise<Array>} - Array of discussion summaries
   */
  async listDiscussions() {
    if (!this.storageProvider) {
      throw new Error('No storage provider available');
    }
    
    // TODO: Ensure storageProvider interface matches
    return await this.storageProvider.list('discussions');
  }

  /**
   * Delete a discussion
   * @param {string} id - The discussion ID
   * @returns {Promise<boolean>} - Whether the deletion was successful
   */
  async deleteDiscussion(id) {
    if (!this.storageProvider) {
      throw new Error('No storage provider available');
    }
    
    // TODO: Ensure storageProvider interface matches
    return await this.storageProvider.delete('discussions', id);
  }

  /**
   * Compare multiple discussions to identify common themes
   * @param {Array<Discussion>} discussions - Discussions to compare
   * @returns {Promise<object>} - Common themes and unique insights
   */
  async compareDiscussions(discussions) {
    if (!discussions || discussions.length < 2) {
      throw new Error('At least two discussions are required for comparison');
    }
    
    // Extract insights if not already done
    for (const discussion of discussions) {
      if (!discussion.hasInsights()) {
        const insights = await this.extractInsights(discussion.content);
        discussion.updateInsights(insights);
      }
    }
    
    // Create a prompt for the AI to compare the discussions
    const prompt = `
I have ${discussions.length} expert discussions about related concepts.
Here are the key insights from each:

${discussions.map((discussion, index) => `
Discussion ${index + 1}:
- Summary: ${discussion.summary}
- Key Insights: ${discussion.keyInsights.join(', ')}
- Challenges: ${discussion.challenges.join(', ')}
- Action Items: ${discussion.actionItems.join(', ')}
`).join('\n')}

Please analyze these discussions and identify:
1. Common themes and insights that appear across multiple discussions
2. Unique valuable insights that only appear in one discussion
3. Contradictions or disagreements between the discussions
4. A synthesis of the most important points considering all discussions
    `.trim();
    
    // --- ADAPTATION NEEDED --- 
    // Original called `this.aiProvider.generateText(prompt, { systemPrompt: ... });`
    // Assumes aiProvider has `generateText`. Basic Anthropic client needs `messages.create`.
    
    const systemPromptCompare = "You are an AI assistant specializing in analyzing and synthesizing insights from multiple expert discussions. Provide a structured, insightful analysis that identifies patterns, unique contributions, and key takeaways.";

    let analysisText = '';
    try {
        const response = await this.aiProvider.messages.create({
            model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
            max_tokens: 2000, // Adjust as needed
            temperature: 0.6,
            system: systemPromptCompare,
            messages: [{ role: 'user', content: prompt }]
        });
        analysisText = response.content[0].text;
    } catch (aiError) {
        console.error("Error calling AI for discussion comparison:", aiError);
        throw new Error(`AI interaction failed during discussion comparison: ${aiError.message}`);
    }
    // --- END ADAPTATION --- 

    // This is a simplified approach - a real implementation would parse the response more robustly
    // For now, we're returning the raw text with some basic structure
    return {
      raw: analysisText,
      discussions: discussions.map(d => d.id)
    };
  }
} 