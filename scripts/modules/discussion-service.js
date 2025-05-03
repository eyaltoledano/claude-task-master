/**
 * Service for generating and managing expert discussions
 */
import { Discussion } from './models/discussion.js';
// Attempt to import the Anthropic client - might need adjustment based on actual export
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { CONFIG, log } from './utils.js';

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
   * @param {object} options - Generation options (can include 'topics', 'focusTopics', 'temperature', 'model', etc.)
   * @returns {Promise<Discussion>} - The generated discussion
   */
  async generateDiscussion(concept, participants, options = {}) {
    if (!concept || concept.trim().length === 0) {
      throw new Error('Concept is required for discussion generation');
    }
    
    if (!participants || participants.length < 2) {
      throw new Error('At least two participants are required for a discussion');
    }
    
    const defaultOptions = {
      temperature: 0.8,
      extractInsights: true,
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219',
      focusTopics: false // Default focus to false
    };
    const mergedOptions = { ...defaultOptions, ...options };
    const topicsToDiscuss = mergedOptions.topics || [];
    const focusOnTopics = mergedOptions.focusTopics; // Get the focus flag
    
    let systemPrompt = `You are facilitating a round table discussion between the following experts: ${participants.join(', ')}.`;

    if (topicsToDiscuss.length > 0 && focusOnTopics) {
        // Scenario 1: Focus primarily on specific topics
        systemPrompt += `\nThe main goal is to discuss the following specific topics in the context of the product concept provided below:
- ${topicsToDiscuss.join('\n- ')}

Use the product concept as background information and context for this focused discussion. Analyze these topics from the experts' unique perspectives, identify challenges, and suggest improvements related to these specific points. Format the output as a transcript.

Product Concept Context:
${concept}`;
    } else {
        // Scenario 2 & 3: General discussion about the concept (potentially including topics)
        systemPrompt += `\nThe topic is the following product concept:
${concept}

Simulate a realistic, insightful discussion where the experts analyze the concept, identify strengths, weaknesses, potential issues, and suggest improvements. Each expert should contribute from their unique perspective. Ensure the discussion flows naturally and covers key aspects of the concept.`;
        
        if (topicsToDiscuss.length > 0) {
            // Scenario 2: General discussion, but ensure topics are included
            systemPrompt += `\n\nDuring the general analysis, please also make sure the discussion touches upon the following specific points:
- ${topicsToDiscuss.join('\n- ')}`;
        }
        // Scenario 3: No specific topics, just general discussion (prompt remains as is)
        
        systemPrompt += `\n\nFormat the output as a transcript.`;
    }

    // Determine user prompt based on focus
    let userPrompt = 'Start the discussion.';
    if (topicsToDiscuss.length > 0) {
        userPrompt = `Start the discussion, ${focusOnTopics ? 'focusing primarily on the specified topics' : 'making sure to cover the specified points'}.`;
    }

    let discussionContent = '';
    try {
        const response = await this.aiProvider.messages.create({
            model: mergedOptions.model,
            max_tokens: 4000,
            temperature: mergedOptions.temperature,
            system: systemPrompt, // Use the dynamically generated system prompt
            messages: [{ role: 'user', content: userPrompt }]
        });
        discussionContent = response.content[0].text;
    } catch (aiError) {
        console.error("Error calling AI for discussion generation:", aiError);
        throw new Error(`AI interaction failed during discussion generation: ${aiError.message}`);
    }

    // Create Discussion model
    const discussion = new Discussion(
      `Discussion about Concept (Participants: ${participants.join(', ')})`, // Title
      [], // Messages array (kept empty for now)
      { // Options object
        participants: participants, // Participants now inside options
        sourceConceptId: options.sourceConceptId,
        metadata: {
          generatedAt: new Date().toISOString(),
          generationOptions: mergedOptions,
          rawContent: discussionContent
        }
      }
    );
    
    // Extract insights if requested
    if (mergedOptions.extractInsights) {
      try {
        const insights = await this.extractInsights(discussionContent);
        discussion.addMetadata({ insights: insights });
      } catch (error) {
        console.error('Error extracting insights:', error);
        const errorMessage = error?.message || "Unknown insight extraction error"; // Fallback message
        discussion.addMetadata({
          insightsError: errorMessage, // Use the potentially defaulted message
          insights: { summary: 'Insight extraction failed', keyInsights: [], challenges: [], actionItems: [] } 
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
    
    // Improved system prompt to strongly encourage proper JSON format
    const systemPrompt = `You are an AI assistant skilled at analyzing discussion transcripts. 
Analyze the following discussion and extract key information. 

YOU MUST RESPOND USING THIS EXACT JSON FORMAT:
{
  "summary": "Brief summary of the overall discussion",
  "keyInsights": [
    "Key insight 1",
    "Key insight 2",
    "etc."
  ],
  "challenges": [
    "Challenge 1",
    "Challenge 2",
    "etc."
  ],
  "actionItems": [
    "Action item 1",
    "Action item 2",
    "etc."
  ]
}

IMPORTANT: Your entire response should be valid JSON without any other text before or after it.`;

    const userPrompt = `Extract insights from this discussion:
${discussionContent}`; 

    let insights = {
      summary: "",
      keyInsights: [],
      challenges: [],
      actionItems: []
    };
    
    try {
        const response = await this.aiProvider.messages.create({
            model: mergedOptions.model,
            max_tokens: 1000, // Adjust as needed
            temperature: 0.5, // Lower temp for extraction
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
        });
        
        // Get the response content
        const responseContent = response.content[0].text;
        
        // --- IMPROVED EXTRACTION LOGIC ---
        let jsonStringToParse = responseContent.trim(); // Trim whitespace first
        
        // Check if it's wrapped in ```json ... ```
        if (jsonStringToParse.includes('```json') && jsonStringToParse.includes('```')) {
            log('info', '[extractInsights] Detected JSON markdown block. Attempting to extract content.');
            // Find the start and end of the json block
            const startIndex = jsonStringToParse.indexOf('```json') + 7;
            const endIndex = jsonStringToParse.lastIndexOf('```');
            if (startIndex < endIndex) {
                jsonStringToParse = jsonStringToParse.substring(startIndex, endIndex).trim();
            }
        } else if (jsonStringToParse.includes('{') && jsonStringToParse.includes('}')) {
            // Try to find and extract just the JSON object if there's other text
            log('info', '[extractInsights] No JSON markdown block detected, trying to extract JSON object.');
            const startIndex = jsonStringToParse.indexOf('{');
            const endIndex = jsonStringToParse.lastIndexOf('}') + 1;
            if (startIndex < endIndex) {
                jsonStringToParse = jsonStringToParse.substring(startIndex, endIndex).trim();
            }
        } else {
             log('info', '[extractInsights] No JSON format detected. Will attempt to create insights from text.');
        }
        
        // Try to parse the JSON
        try {
            const parsedInsights = JSON.parse(jsonStringToParse);
            
            // Validate that we got the expected structure
            if (parsedInsights && typeof parsedInsights === 'object') {
                insights = {
                    summary: parsedInsights.summary || "",
                    keyInsights: Array.isArray(parsedInsights.keyInsights) ? parsedInsights.keyInsights : [],
                    challenges: Array.isArray(parsedInsights.challenges) ? parsedInsights.challenges : [],
                    actionItems: Array.isArray(parsedInsights.actionItems) ? parsedInsights.actionItems : []
                };
                log('info', '[extractInsights] Successfully parsed JSON insights');
            } else {
                throw new Error('Parsed result is not a valid insights object');
            }
        } catch (parseError) {
            // Fallback: If JSON parsing fails, try to extract insights directly from text
            log('warn', `[extractInsights] JSON parsing failed: ${parseError.message}. Using fallback extraction.`);
            console.error("Raw content received:", responseContent.substring(0, 200) + "..."); 
            
            // Use a simple fallback to extract some insights
            insights = this._extractInsightsFallback(responseContent);
        }

    } catch (aiError) {
        console.error("Error calling AI for insight extraction:", aiError);
        log('error', `AI interaction failed during insight extraction: ${aiError.message}`);
        // Still return a valid insights object even on error
        return {
            summary: "Error extracting insights. Please check the discussion manually.",
            keyInsights: ["Error occurred during automated analysis"],
            challenges: [],
            actionItems: ["Review the discussion transcript manually"]
        };
    }

    return insights;
  }

  /**
   * Fallback method to extract insights when JSON parsing fails
   * @private
   * @param {string} text - Raw text to extract insights from
   * @returns {object} - Basic insights object with extracted information
   */
  _extractInsightsFallback(text) {
    // Simple fallback extraction logic
    const insights = {
      summary: "",
      keyInsights: [],
      challenges: [],
      actionItems: []
    };

    // Try to identify the summary section
    const summaryMatch = text.match(/summary:?\s*([^]*?)(?=key insights|challenges|action items|$)/i);
    if (summaryMatch && summaryMatch[1]) {
      insights.summary = summaryMatch[1].trim();
    }

    // Extract key insights
    const keyInsightsMatch = text.match(/key insights:?\s*([^]*?)(?=challenges|action items|$)/i);
    if (keyInsightsMatch && keyInsightsMatch[1]) {
      // Look for list items (bullets, numbers, or just new lines)
      const items = keyInsightsMatch[1].split(/[\n\r]+/).map(item => 
        item.replace(/^[•\-*\d\.\s]+/, '').trim()
      ).filter(item => item.length > 0);
      
      if (items.length > 0) {
        insights.keyInsights = items;
      }
    }

    // Extract challenges with similar approach
    const challengesMatch = text.match(/challenges:?\s*([^]*?)(?=action items|$)/i);
    if (challengesMatch && challengesMatch[1]) {
      const items = challengesMatch[1].split(/[\n\r]+/).map(item => 
        item.replace(/^[•\-*\d\.\s]+/, '').trim()
      ).filter(item => item.length > 0);
      
      if (items.length > 0) {
        insights.challenges = items;
      }
    }

    // Extract action items
    const actionItemsMatch = text.match(/action items:?\s*([^]*?)(?=$)/i);
    if (actionItemsMatch && actionItemsMatch[1]) {
      const items = actionItemsMatch[1].split(/[\n\r]+/).map(item => 
        item.replace(/^[•\-*\d\.\s]+/, '').trim()
      ).filter(item => item.length > 0);
      
      if (items.length > 0) {
        insights.actionItems = items;
      }
    }

    // If we couldn't extract anything meaningful, use basic fallback
    if (!insights.summary && insights.keyInsights.length === 0) {
      insights.summary = "Automated insight extraction failed. Manual review recommended.";
      // Just add the first few lines as a basic insight
      const firstLines = text.split(/[\n\r]+/).slice(0, 3).join(' ').trim();
      if (firstLines) {
        insights.keyInsights.push(firstLines);
      }
    }

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
   * Synthesize multiple discussion transcripts into a single, refined summary.
   * @param {string[]} discussionContents - An array of strings, each containing a discussion transcript.
   * @param {object} options - Synthesis options (e.g., model, temperature).
   * @returns {Promise<string>} - The synthesized discussion summary as a string (Markdown recommended).
   */
  async synthesizeDiscussions(discussionContents, options = {}) {
    if (!discussionContents || discussionContents.length === 0) {
      throw new Error('At least one discussion content is required for synthesis.');
    }
    if (discussionContents.length === 1) {
        console.warn("Synthesizing only one discussion. The result will be similar to the input.");
    }

    // Set default options
    const defaultOptions = {
      temperature: 0.6, // Slightly lower temp for more focused synthesis
      model: process.env.MODEL || 'claude-3-7-sonnet-20250219' 
    };
    const mergedOptions = { ...defaultOptions, ...options };

    // Construct the prompt for synthesis
    let systemPrompt = `You are an AI assistant specialized in analyzing and synthesizing information from multiple sources. You will be given ${discussionContents.length} simulated discussion transcripts about the same product concept.

Your task is to:
1.  Read and understand all provided discussion transcripts.
2.  Identify the most important and consistently mentioned:
    *   Key Strengths of the concept.
    *   Significant Weaknesses or Concerns raised.
    *   Potential Challenges in implementation or adoption.
    *   Key Action Items or Recommendations suggested.
    *   Any major points of Disagreement or differing perspectives.
3.  Generate a consolidated synthesis report in clear Markdown format. Structure the report with distinct sections for each of the points above (Strengths, Weaknesses, Challenges, Recommendations, Disagreements).
4.  Focus on information that appears across multiple discussions or represents significant insights. Avoid simply concatenating the discussions; provide a true synthesis.
5.  Be objective and accurately represent the perspectives from the discussions.`;

    // Prepare the user message containing all discussions
    let userPrompt = "Please synthesize the following discussion transcripts:\n\n";
    discussionContents.forEach((content, index) => {
        userPrompt += `--- Discussion Transcript ${index + 1} ---\n${content}\n\n`;
    });
    userPrompt += "--- End of Transcripts ---";

    let synthesizedContent = '';
    try {
      // Note: This might require a model with a large context window if discussions are long
      const response = await this.aiProvider.messages.create({
        model: mergedOptions.model,
        max_tokens: 4000, // Adjust as needed for the synthesis report
        temperature: mergedOptions.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      if (response.content && response.content.length > 0 && response.content[0].text) {
          synthesizedContent = response.content[0].text;
      } else {
          throw new Error('AI response did not contain expected synthesized text content.');
      }

    } catch (aiError) {
      console.error("Error calling AI for discussion synthesis:", aiError);
      // Consider adding more context about potential large input size issues
      throw new Error(`AI interaction failed during discussion synthesis: ${aiError.message}`);
    }

    return synthesizedContent;
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