/**
 * PRD Parameter Collection Module
 * Contains structured questions for PRD generation
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { log } from './logger.js';

/**
 * PRD structure sections
 */
const PRD_SECTIONS = {
  OVERVIEW: 'overview',
  FEATURES: 'features',
  USERS: 'users',
  ICP: 'icp',
  TECHNICAL: 'technical',
  ROADMAP: 'roadmap',
  RISKS: 'risks'
};

/**
 * Collects detailed information about a product for PRD generation
 * @param {Object} options - Basic PRD options
 * @returns {Promise<Object>} Enhanced PRD parameters
 */
export async function collectPRDParameters(options) {
  try {
    log('info', 'Collecting detailed PRD parameters');
    
    console.log(chalk.blue('\nLet\'s collect some details to enhance your PRD:'));
    console.log(chalk.gray('(You can skip any question by pressing Enter)'));
    
    // First, determine which sections the user wants to define parameters for
    const sectionsResponse = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'sections',
        message: 'Which sections would you like to provide detailed inputs for?',
        choices: [
          { name: 'Product Overview & Goals', value: PRD_SECTIONS.OVERVIEW, checked: true },
          { name: 'Core Features', value: PRD_SECTIONS.FEATURES, checked: true },
          { name: 'User Experience & Target Audience', value: PRD_SECTIONS.USERS },
          { name: 'Ideal Customer Profile', value: PRD_SECTIONS.ICP, checked: true },
          { name: 'Technical Architecture', value: PRD_SECTIONS.TECHNICAL },
          { name: 'Development Roadmap', value: PRD_SECTIONS.ROADMAP },
          { name: 'Risks & Mitigations', value: PRD_SECTIONS.RISKS }
        ]
      }
    ]);
    
    const selectedSections = sectionsResponse.sections;
    const prdParams = { sections: {} };
    
    // Collect details for each selected section
    for (const section of selectedSections) {
      switch (section) {
        case PRD_SECTIONS.OVERVIEW:
          prdParams.sections.overview = await collectOverviewDetails();
          break;
        case PRD_SECTIONS.FEATURES:
          prdParams.sections.features = await collectFeatureDetails();
          break;
        case PRD_SECTIONS.USERS:
          prdParams.sections.users = await collectUserDetails();
          break;
        case PRD_SECTIONS.ICP:
          prdParams.sections.icp = await collectICPDetails();
          break;
        case PRD_SECTIONS.TECHNICAL:
          prdParams.sections.technical = await collectTechnicalDetails();
          break;
        case PRD_SECTIONS.ROADMAP:
          prdParams.sections.roadmap = await collectRoadmapDetails();
          break;
        case PRD_SECTIONS.RISKS:
          prdParams.sections.risks = await collectRiskDetails();
          break;
      }
    }
    
    return prdParams;
  } catch (error) {
    log('error', `Error collecting PRD parameters: ${error.message}`);
    throw error;
  }
}

/**
 * Collects product overview details
 * @returns {Promise<Object>} Overview details
 */
async function collectOverviewDetails() {
  console.log(chalk.blue('\nProduct Overview & Goals'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'problem',
      message: 'What problem does this product solve?'
    },
    {
      type: 'input',
      name: 'goals',
      message: 'What are the primary goals of this product?'
    },
    {
      type: 'input',
      name: 'success',
      message: 'How will you measure success?'
    }
  ]);
  
  return answers;
}

/**
 * Collects feature details
 * @returns {Promise<Object>} Feature details
 */
async function collectFeatureDetails() {
  console.log(chalk.blue('\nCore Features'));
  
  // Ask how many features to define
  const featureCountAnswer = await inquirer.prompt([
    {
      type: 'number',
      name: 'count',
      message: 'How many key features would you like to define?',
      default: 3,
      validate: (value) => {
        return value > 0 && value <= 10 ? true : 'Please enter a number between 1 and 10';
      }
    }
  ]);
  
  const features = [];
  
  // Collect details for each feature
  for (let i = 0; i < featureCountAnswer.count; i++) {
    console.log(chalk.gray(`\nFeature ${i + 1}:`));
    
    const featureAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Feature name:'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Brief description:'
      },
      {
        type: 'input',
        name: 'importance',
        message: 'Why is this important?'
      }
    ]);
    
    features.push(featureAnswer);
  }
  
  return { features };
}

/**
 * Collects user experience details
 * @returns {Promise<Object>} User details
 */
async function collectUserDetails() {
  console.log(chalk.blue('\nUser Experience & Target Audience'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'targetUsers',
      message: 'Who are the target users?'
    },
    {
      type: 'input',
      name: 'primaryPersona',
      message: 'Describe the primary user persona:'
    },
    {
      type: 'input',
      name: 'userJourney',
      message: 'Outline a key user journey:'
    }
  ]);
  
  return answers;
}

/**
 * Collects Ideal Customer Profile details
 * @returns {Promise<Object>} ICP details
 */
async function collectICPDetails() {
  console.log(chalk.blue('\nIdeal Customer Profile'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'industry',
      message: 'What industry or industries does your ideal customer belong to?'
    },
    {
      type: 'input',
      name: 'companySize',
      message: 'What is the ideal company size (employees/revenue)?'
    },
    {
      type: 'input',
      name: 'decisionMakers',
      message: 'Who are the key decision makers and influencers?'
    },
    {
      type: 'input',
      name: 'painPoints',
      message: 'What specific pain points does your product address for this customer?'
    },
    {
      type: 'input',
      name: 'buyingCriteria',
      message: 'What are their key buying criteria?'
    }
  ]);
  
  return answers;
}

/**
 * Collects technical architecture details
 * @returns {Promise<Object>} Technical details
 */
async function collectTechnicalDetails() {
  console.log(chalk.blue('\nTechnical Architecture'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'stack',
      message: 'What technology stack will be used?'
    },
    {
      type: 'input',
      name: 'apis',
      message: 'Are there any external APIs or services required?'
    },
    {
      type: 'input',
      name: 'dataModel',
      message: 'Describe the core data model:'
    }
  ]);
  
  return answers;
}

/**
 * Collects development roadmap details
 * @returns {Promise<Object>} Roadmap details
 */
async function collectRoadmapDetails() {
  console.log(chalk.blue('\nDevelopment Roadmap'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'mvpFeatures',
      message: 'What features are essential for MVP?'
    },
    {
      type: 'input',
      name: 'phases',
      message: 'Outline the development phases:'
    },
    {
      type: 'input',
      name: 'dependencies',
      message: 'Are there any critical development dependencies?'
    }
  ]);
  
  return answers;
}

/**
 * Collects risk and mitigation details
 * @returns {Promise<Object>} Risk details
 */
async function collectRiskDetails() {
  console.log(chalk.blue('\nRisks & Mitigations'));
  
  // Ask how many risks to define
  const riskCountAnswer = await inquirer.prompt([
    {
      type: 'number',
      name: 'count',
      message: 'How many key risks would you like to identify?',
      default: 2,
      validate: (value) => {
        return value > 0 && value <= 5 ? true : 'Please enter a number between 1 and 5';
      }
    }
  ]);
  
  const risks = [];
  
  // Collect details for each risk
  for (let i = 0; i < riskCountAnswer.count; i++) {
    console.log(chalk.gray(`\nRisk ${i + 1}:`));
    
    const riskAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Risk description:'
      },
      {
        type: 'list',
        name: 'severity',
        message: 'Risk severity:',
        choices: ['Low', 'Medium', 'High', 'Critical']
      },
      {
        type: 'input',
        name: 'mitigation',
        message: 'Mitigation strategy:'
      }
    ]);
    
    risks.push(riskAnswer);
  }
  
  return { risks };
} 