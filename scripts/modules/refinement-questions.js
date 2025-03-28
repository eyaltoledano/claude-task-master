/**
 * Refinement Questions Module
 * 
 * Provides structured question templates for the refine-concept command
 * to guide users through effective concept refinement.
 */

/**
 * Core refinement question categories
 * Each category contains relevant questions for different aspects of concept refinement
 */
export const refinementCategories = [
  {
    id: 'problem',
    name: 'Problem Statement',
    description: 'Refine the problem being solved',
    questions: [
      {
        id: 'problem_clarity',
        text: 'How could the problem statement be made clearer or more specific?',
        defaultPrompt: 'Make the problem statement more specific and actionable.'
      },
      {
        id: 'problem_evidence',
        text: 'What evidence supports that this is a real and significant problem?',
        defaultPrompt: 'Strengthen the problem statement with specific evidence or data points.'
      },
      {
        id: 'target_users',
        text: 'Are the target users/customers clearly defined? How could this be improved?',
        defaultPrompt: 'Define target users more precisely with detailed personas or segments.'
      }
    ]
  },
  {
    id: 'solution',
    name: 'Solution Approach',
    description: 'Refine the proposed solution',
    questions: [
      {
        id: 'solution_clarity',
        text: 'How could the proposed solution be described more clearly?',
        defaultPrompt: 'Make the solution description more concrete and specific.'
      },
      {
        id: 'solution_differentiation',
        text: 'What makes this solution unique or differentiated from alternatives?',
        defaultPrompt: 'Strengthen the differentiation factors of the proposed solution.'
      },
      {
        id: 'solution_feasibility',
        text: 'Are there technical or implementation concerns to address?',
        defaultPrompt: 'Address technical feasibility concerns and implementation challenges.'
      }
    ]
  },
  {
    id: 'features',
    name: 'Feature Refinement',
    description: 'Refine the features and capabilities',
    questions: [
      {
        id: 'feature_prioritization',
        text: 'How could the feature prioritization be improved?',
        defaultPrompt: 'Clarify which features are must-haves vs. nice-to-haves and why.'
      },
      {
        id: 'feature_details',
        text: 'Which features need more detailed specifications?',
        defaultPrompt: 'Add more detailed specifications for the core features.'
      },
      {
        id: 'feature_scope',
        text: 'Are there features that should be added or removed from the scope?',
        defaultPrompt: 'Refine the feature scope to focus on the most impactful capabilities.'
      }
    ]
  },
  {
    id: 'market',
    name: 'Market Considerations',
    description: 'Refine market and business aspects',
    questions: [
      {
        id: 'market_size',
        text: 'Is the market size and opportunity clearly articulated?',
        defaultPrompt: 'Strengthen the market opportunity description with specific metrics.'
      },
      {
        id: 'business_model',
        text: 'How could the business model or monetization strategy be refined?',
        defaultPrompt: 'Develop a more detailed monetization strategy and business model.'
      },
      {
        id: 'competition',
        text: 'Is the competitive landscape adequately analyzed?',
        defaultPrompt: 'Enhance the competitive analysis with specific competitors and positioning.'
      }
    ]
  },
  {
    id: 'user_experience',
    name: 'User Experience',
    description: 'Refine user experience aspects',
    questions: [
      {
        id: 'user_flows',
        text: 'How could the user workflows or journeys be improved?',
        defaultPrompt: 'Develop more detailed user flows and journey descriptions.'
      },
      {
        id: 'usability',
        text: 'Are there usability considerations that should be addressed?',
        defaultPrompt: 'Address potential usability challenges and accessibility requirements.'
      },
      {
        id: 'user_value',
        text: 'How could the user value proposition be strengthened?',
        defaultPrompt: 'Clarify and strengthen the core user value proposition.'
      }
    ]
  },
  {
    id: 'technical',
    name: 'Technical Considerations',
    description: 'Refine technical aspects',
    questions: [
      {
        id: 'architecture',
        text: 'Does the concept address system architecture considerations?',
        defaultPrompt: 'Develop a clearer high-level architecture to support the concept.'
      },
      {
        id: 'scalability',
        text: 'How could scalability and performance considerations be improved?',
        defaultPrompt: 'Address scalability and performance considerations more explicitly.'
      },
      {
        id: 'integration',
        text: 'Are integration requirements with external systems clear?',
        defaultPrompt: 'Clarify integration requirements with existing systems and services.'
      }
    ]
  },
  {
    id: 'implementation',
    name: 'Implementation Path',
    description: 'Refine implementation strategy',
    questions: [
      {
        id: 'roadmap',
        text: 'Is the development roadmap or phasing strategy clear?',
        defaultPrompt: 'Develop a clearer phased implementation approach with milestones.'
      },
      {
        id: 'mvp',
        text: 'Is the MVP (Minimum Viable Product) definition appropriate?',
        defaultPrompt: 'Refine the MVP definition to better balance value delivery and time-to-market.'
      },
      {
        id: 'resources',
        text: 'Are resource requirements and constraints addressed?',
        defaultPrompt: 'Address resource requirements and constraints more explicitly.'
      }
    ]
  },
  {
    id: 'risks',
    name: 'Risk Assessment',
    description: 'Refine risk identification and mitigation',
    questions: [
      {
        id: 'key_risks',
        text: 'What are the key risks that should be addressed more thoroughly?',
        defaultPrompt: 'Identify and address key project risks more comprehensively.'
      },
      {
        id: 'risk_mitigation',
        text: 'How could risk mitigation strategies be strengthened?',
        defaultPrompt: 'Develop more robust risk mitigation strategies for the identified risks.'
      },
      {
        id: 'assumptions',
        text: 'Are key assumptions clearly stated and validated?',
        defaultPrompt: 'Clarify key assumptions and how they will be validated.'
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Refinement',
    description: 'Create a custom refinement prompt',
    questions: [
      {
        id: 'custom_prompt',
        text: 'What specific aspects would you like to refine?',
        defaultPrompt: '',
        isCustom: true
      }
    ]
  }
];

/**
 * Common refinement prompt templates for different concept types
 */
export const refinementPromptTemplates = {
  software: [
    'Enhance the technical architecture details and implementation approach',
    'Improve the user flow descriptions and experience considerations',
    'Strengthen the scalability and performance aspects of the solution',
    'Develop more detailed integration requirements with existing systems',
    'Refine the feature prioritization and MVP definition'
  ],
  product: [
    'Sharpen the product positioning and market differentiation',
    'Develop more detailed user personas and customer segments',
    'Strengthen the value proposition and key benefits',
    'Clarify the go-to-market strategy and rollout approach',
    'Refine the product roadmap and feature prioritization'
  ],
  service: [
    'Enhance the service delivery model and operational requirements',
    'Improve the customer journey mapping and touchpoints',
    'Strengthen the service level agreements and quality metrics',
    'Develop more detailed resource requirements and scaling approach',
    'Refine the service pricing model and monetization strategy'
  ],
  business: [
    'Sharpen the business model and revenue streams',
    'Develop more detailed market size analysis and growth projections',
    'Strengthen the competitive landscape assessment',
    'Clarify the customer acquisition strategy and channels',
    'Refine the resource requirements and organizational structure'
  ]
};

/**
 * Suggested participants for round-table discussions by concept type
 */
export const suggestedParticipants = {
  software: [
    'Software Architect',
    'Lead Developer',
    'UX Designer',
    'Product Manager',
    'QA Engineer',
    'DevOps Specialist',
    'Security Expert'
  ],
  product: [
    'Product Manager',
    'UX Designer',
    'Marketing Director',
    'Sales Director',
    'Customer Support Lead',
    'Technical Lead',
    'Industry Expert'
  ],
  service: [
    'Service Designer',
    'Operations Manager',
    'Customer Experience Lead',
    'Account Manager',
    'Finance Director',
    'Quality Assurance Lead',
    'Training Specialist'
  ],
  business: [
    'Business Strategist',
    'Market Researcher',
    'Financial Analyst',
    'Business Development Lead',
    'Legal Counsel',
    'Operations Director',
    'Industry Expert'
  ]
};

/**
 * Generate a custom refinement prompt based on concept analysis
 * @param {string} conceptContent - Content of the concept
 * @returns {string} Suggested refinement prompt
 */
export function generateSuggestedPrompt(conceptContent) {
  // Detect concept type based on content keywords
  const conceptType = detectConceptType(conceptContent);
  
  // Get prompt templates for the concept type
  const templates = refinementPromptTemplates[conceptType] || refinementPromptTemplates.software;
  
  // Detect potential improvement areas
  const weakAreas = detectWeakAreas(conceptContent);
  
  // Select the most relevant template based on weak areas
  let suggestedPrompt = templates[0]; // Default to first template
  
  // If we found weak areas, use a template that addresses them
  if (weakAreas.length > 0) {
    // For demo purposes, just use the first weak area to select a template
    const area = weakAreas[0];
    
    switch (area) {
      case 'technical':
        suggestedPrompt = templates.find(t => 
          t.includes('technical') || 
          t.includes('architecture') || 
          t.includes('implementation')) || templates[0];
        break;
      case 'market':
        suggestedPrompt = templates.find(t => 
          t.includes('market') || 
          t.includes('positioning') || 
          t.includes('competitive')) || templates[0];
        break;
      case 'user':
        suggestedPrompt = templates.find(t => 
          t.includes('user') || 
          t.includes('experience') || 
          t.includes('journey') || 
          t.includes('persona')) || templates[0];
        break;
      case 'features':
        suggestedPrompt = templates.find(t => 
          t.includes('feature') || 
          t.includes('MVP') || 
          t.includes('prioritization')) || templates[0];
        break;
      default:
        suggestedPrompt = templates[0];
    }
  }
  
  return suggestedPrompt;
}

/**
 * Detect the type of concept based on content analysis
 * @param {string} content - Concept content
 * @returns {string} Concept type (software, product, service, business)
 */
function detectConceptType(content) {
  const contentLower = content.toLowerCase();
  
  // Count keywords for each type
  const counts = {
    software: 0,
    product: 0,
    service: 0,
    business: 0
  };
  
  // Software-related keywords
  ['software', 'code', 'developer', 'programming', 'library', 'framework', 'api', 
   'database', 'backend', 'frontend', 'algorithm', 'application', 'app', 'system', 
   'architecture', 'interface'].forEach(word => {
    if (contentLower.includes(word)) counts.software++;
  });
  
  // Product-related keywords
  ['product', 'user', 'customer', 'feature', 'market', 'competitor', 'pricing', 
   'packaging', 'release', 'roadmap', 'upsell', 'adoption'].forEach(word => {
    if (contentLower.includes(word)) counts.product++;
  });
  
  // Service-related keywords
  ['service', 'offering', 'support', 'delivery', 'client', 'sla', 'operations', 
   'quality', 'customer service', 'support', 'helpdesk', 'consulting'].forEach(word => {
    if (contentLower.includes(word)) counts.service++;
  });
  
  // Business-related keywords
  ['business', 'revenue', 'profit', 'market', 'strategy', 'competitive', 'financials', 
   'investment', 'monetization', 'growth', 'scaling', 'acquisition'].forEach(word => {
    if (contentLower.includes(word)) counts.business++;
  });
  
  // Determine the type with the highest count
  let maxCount = 0;
  let conceptType = 'software'; // Default
  
  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      conceptType = type;
    }
  }
  
  return conceptType;
}

/**
 * Detect potential areas for improvement in the concept
 * @param {string} content - Concept content
 * @returns {string[]} Array of weak areas
 */
function detectWeakAreas(content) {
  const contentLower = content.toLowerCase();
  const weakAreas = [];
  
  // Check for weak technical details
  if (!contentLower.includes('architecture') && 
      !contentLower.includes('technical') && 
      !contentLower.includes('implementation')) {
    weakAreas.push('technical');
  }
  
  // Check for weak market analysis
  if (!contentLower.includes('market') && 
      !contentLower.includes('competitor') && 
      !contentLower.includes('competition')) {
    weakAreas.push('market');
  }
  
  // Check for weak user experience details
  if (!contentLower.includes('user experience') && 
      !contentLower.includes('ux') && 
      !contentLower.includes('usability')) {
    weakAreas.push('user');
  }
  
  // Check for weak feature descriptions
  if (!contentLower.includes('feature') && 
      !contentLower.includes('capability') && 
      !contentLower.includes('functionality')) {
    weakAreas.push('features');
  }
  
  return weakAreas;
}

export default {
  refinementCategories,
  refinementPromptTemplates,
  suggestedParticipants,
  generateSuggestedPrompt
}; 