/**
 * Refinement Feedback Module
 * 
 * Provides real-time feedback mechanisms for the refine-concept command
 * to help users understand the impact of their refinement choices.
 */

import chalk from 'chalk';
import boxen from 'boxen';
import { log } from './utils.js';

/**
 * Generate feedback about a refinement prompt
 * @param {string} prompt - The refinement prompt
 * @returns {object} Feedback object with analysis
 */
export function analyzeRefinementPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      score: 0,
      impact: 'minimal',
      feedback: 'The empty prompt will have minimal impact on refinement.',
      suggestions: ['Provide a specific prompt to guide the refinement process.']
    };
  }
  
  // Initialize feedback object
  const feedback = {
    score: 0,
    impact: 'minimal',
    feedback: '',
    suggestions: []
  };
  
  // Calculate a basic score based on prompt characteristics
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  
  // Score based on word count (simple heuristic)
  if (wordCount < 5) {
    feedback.score += 1;
  } else if (wordCount < 10) {
    feedback.score += 2;
  } else if (wordCount < 20) {
    feedback.score += 3;
  } else {
    feedback.score += 4;
  }
  
  // Score based on specificity keywords
  const specificityKeywords = [
    'specific', 'detail', 'elaborate', 'expand', 'clarify', 
    'precisely', 'exactly', 'particular', 'concrete', 'explicitly'
  ];
  
  specificityKeywords.forEach(keyword => {
    if (prompt.toLowerCase().includes(keyword)) {
      feedback.score += 1;
    }
  });
  
  // Score based on action keywords
  const actionKeywords = [
    'add', 'create', 'improve', 'enhance', 'develop', 'refine', 
    'strengthen', 'address', 'focus on', 'prioritize', 'highlight'
  ];
  
  actionKeywords.forEach(keyword => {
    if (prompt.toLowerCase().includes(keyword)) {
      feedback.score += 1;
    }
  });
  
  // Cap the score at 10
  feedback.score = Math.min(feedback.score, 10);
  
  // Determine impact level
  if (feedback.score <= 3) {
    feedback.impact = 'minimal';
  } else if (feedback.score <= 6) {
    feedback.impact = 'moderate';
  } else if (feedback.score <= 8) {
    feedback.impact = 'significant';
  } else {
    feedback.impact = 'substantial';
  }
  
  // Generate feedback message
  if (feedback.score <= 3) {
    feedback.feedback = 'This prompt may have limited effect on the refinement.';
    feedback.suggestions.push('Add specific areas to focus on in the refinement.');
    feedback.suggestions.push('Include action words like "improve", "enhance", or "develop".');
  } else if (feedback.score <= 6) {
    feedback.feedback = 'This prompt should provide moderate guidance for refinement.';
    feedback.suggestions.push('Consider specifying particular aspects to improve.');
  } else if (feedback.score <= 8) {
    feedback.feedback = 'This prompt will effectively guide the refinement process.';
  } else {
    feedback.feedback = 'This prompt will provide excellent guidance for the refinement.';
  }
  
  return feedback;
}

/**
 * Display feedback about a refinement prompt in the console
 * @param {string} prompt - The refinement prompt
 */
export function displayPromptFeedback(prompt) {
  const feedback = analyzeRefinementPrompt(prompt);
  
  // Color based on impact
  let color = 'blue';
  if (feedback.impact === 'minimal') color = 'yellow';
  if (feedback.impact === 'moderate') color = 'cyan';
  if (feedback.impact === 'significant') color = 'green';
  if (feedback.impact === 'substantial') color = 'green';
  
  // Create box content
  let content = chalk.bold.white('Refinement Prompt Analysis') + '\n\n';
  content += `Impact: ${chalk[color](feedback.impact)} (Score: ${feedback.score}/10)\n\n`;
  content += chalk.white(feedback.feedback) + '\n';
  
  if (feedback.suggestions.length > 0) {
    content += '\nSuggestions:\n';
    feedback.suggestions.forEach(suggestion => {
      content += `• ${chalk.white(suggestion)}\n`;
    });
  }
  
  // Display feedback box
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderColor: color,
    borderStyle: 'round'
  }));
}

/**
 * Analyze a concept file and generate an impact assessment
 * @param {string} conceptContent - Content of the concept
 * @param {string} prompt - The refinement prompt
 * @returns {object} Impact assessment object
 */
export function generateConceptImpactAssessment(conceptContent, prompt) {
  // Initialize impact assessment
  const assessment = {
    affectedSections: [],
    anticipatedChanges: [],
    impactLevel: 'moderate',
    impactAreas: []
  };
  
  if (!prompt || !conceptContent) {
    assessment.impactLevel = 'unknown';
    return assessment;
  }
  
  // Extract sections from the concept (based on markdown headings)
  const sectionRegex = /^#+\s+(.+?)$/gm;
  const sections = [];
  let match;
  
  while ((match = sectionRegex.exec(conceptContent)) !== null) {
    sections.push(match[1].trim());
  }
  
  // Analyze prompt for keywords that might indicate affected sections
  const promptLower = prompt.toLowerCase();
  
  // Define impact area keywords and corresponding sections
  const impactAreas = [
    { 
      area: 'problem definition', 
      keywords: ['problem', 'issue', 'challenge', 'pain point'],
      likelySections: ['problem', 'background', 'introduction', 'overview']
    },
    { 
      area: 'solution approach', 
      keywords: ['solution', 'approach', 'methodology', 'strategy'],
      likelySections: ['solution', 'approach', 'methodology', 'strategy']
    },
    { 
      area: 'user experience', 
      keywords: ['user', 'ux', 'experience', 'interface', 'journey', 'flow'],
      likelySections: ['user experience', 'ux', 'interface', 'design']
    },
    { 
      area: 'features', 
      keywords: ['feature', 'functionality', 'capability', 'function'],
      likelySections: ['features', 'functionality', 'capabilities']
    },
    { 
      area: 'architecture', 
      keywords: ['architecture', 'system', 'technical', 'infrastructure'],
      likelySections: ['architecture', 'technical', 'system', 'infrastructure']
    },
    { 
      area: 'implementation', 
      keywords: ['implement', 'develop', 'build', 'code'],
      likelySections: ['implementation', 'development', 'roadmap', 'timeline']
    },
    { 
      area: 'market', 
      keywords: ['market', 'customer', 'competitor', 'business'],
      likelySections: ['market', 'business', 'customers', 'competition']
    }
  ];
  
  // Identify affected areas based on prompt keywords
  impactAreas.forEach(areaInfo => {
    for (const keyword of areaInfo.keywords) {
      if (promptLower.includes(keyword)) {
        assessment.impactAreas.push(areaInfo.area);
        
        // Add affected sections based on likely matches
        for (const section of sections) {
          const sectionLower = section.toLowerCase();
          
          // Check if this section is likely to be affected
          for (const likelySection of areaInfo.likelySections) {
            if (sectionLower.includes(likelySection)) {
              if (!assessment.affectedSections.includes(section)) {
                assessment.affectedSections.push(section);
              }
              break;
            }
          }
        }
        
        break; // Break once we've found a keyword match for this area
      }
    }
  });
  
  // Add some anticipated changes based on the prompt
  if (promptLower.includes('add') || promptLower.includes('include')) {
    assessment.anticipatedChanges.push('New content will be added');
  }
  if (promptLower.includes('enhance') || promptLower.includes('improve')) {
    assessment.anticipatedChanges.push('Existing content will be enhanced');
  }
  if (promptLower.includes('reorganize') || promptLower.includes('restructure')) {
    assessment.anticipatedChanges.push('Content structure may be reorganized');
  }
  if (promptLower.includes('remove') || promptLower.includes('eliminate')) {
    assessment.anticipatedChanges.push('Some content may be removed');
  }
  
  // Default anticipated change if none were identified
  if (assessment.anticipatedChanges.length === 0) {
    assessment.anticipatedChanges.push('Content will be refined based on the prompt');
  }
  
  // Determine overall impact level
  if (assessment.affectedSections.length > Math.max(3, sections.length / 2)) {
    assessment.impactLevel = 'major';
  } else if (assessment.affectedSections.length > 1) {
    assessment.impactLevel = 'moderate';
  } else {
    assessment.impactLevel = 'minor';
  }
  
  // Ensure we have at least one affected section
  if (assessment.affectedSections.length === 0 && sections.length > 0) {
    // If we couldn't identify specific sections, just assume the first section might be affected
    assessment.affectedSections.push(sections[0]);
  }
  
  // Remove duplicates
  assessment.impactAreas = [...new Set(assessment.impactAreas)];
  assessment.affectedSections = [...new Set(assessment.affectedSections)];
  
  return assessment;
}

/**
 * Display impact assessment in the console
 * @param {object} assessment - The impact assessment object
 */
export function displayImpactAssessment(assessment) {
  // Color based on impact level
  let color = 'blue';
  if (assessment.impactLevel === 'minor') color = 'cyan';
  if (assessment.impactLevel === 'moderate') color = 'yellow';
  if (assessment.impactLevel === 'major') color = 'green';
  
  // Create box content
  let content = chalk.bold.white('Refinement Impact Assessment') + '\n\n';
  content += `Impact Level: ${chalk[color](assessment.impactLevel)}\n\n`;
  
  if (assessment.impactAreas.length > 0) {
    content += 'Impact Areas:\n';
    assessment.impactAreas.forEach(area => {
      content += `• ${chalk.white(area)}\n`;
    });
    content += '\n';
  }
  
  if (assessment.affectedSections.length > 0) {
    content += 'Affected Sections:\n';
    assessment.affectedSections.forEach(section => {
      content += `• ${chalk.white(section)}\n`;
    });
    content += '\n';
  }
  
  if (assessment.anticipatedChanges.length > 0) {
    content += 'Anticipated Changes:\n';
    assessment.anticipatedChanges.forEach(change => {
      content += `• ${chalk.white(change)}\n`;
    });
  }
  
  // Display feedback box
  console.log(boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderColor: color,
    borderStyle: 'round'
  }));
}

/**
 * Provide real-time feedback for a refinement session
 * @param {string} conceptContent - Content of the concept file
 * @param {string} prompt - Refinement prompt
 * @param {object} options - Additional options
 */
export function provideRefinementFeedback(conceptContent, prompt, options = {}) {
  try {
    // Start with prompt analysis
    displayPromptFeedback(prompt);
    
    // Show concept impact assessment if concept content is available
    if (conceptContent) {
      const assessment = generateConceptImpactAssessment(conceptContent, prompt);
      displayImpactAssessment(assessment);
    }
  } catch (error) {
    log('warn', `Error providing refinement feedback: ${error.message}`);
    // Don't throw - this is a non-critical feature
  }
}

export default {
  analyzeRefinementPrompt,
  displayPromptFeedback,
  generateConceptImpactAssessment,
  displayImpactAssessment,
  provideRefinementFeedback
}; 