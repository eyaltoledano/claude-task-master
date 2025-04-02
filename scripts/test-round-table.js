import { interactiveRoundTable, processDiscussion } from './modules/round-table-command.js';
import chalk from 'chalk';

async function testExtractInsights() {
  try {
    console.log(chalk.blue('Testing discussion extraction functionality...'));
    
    // Sample discussion content
    const sampleDiscussion = `
# Expert Round Table Discussion: Task Management System for Software Development

## Participants
- Senior Software Engineer (SSE)
- Product Manager (PM)
- UX Designer (UXD)

## Discussion Summary

**PM**: Thank you all for joining this discussion about our proposed task management system for software development teams. Let's start by discussing what you see as the core strengths and weaknesses of the concept.

**SSE**: I appreciate the focus on Git integration and CLI interface. Most developers would find that very natural to their workflow. However, I'm concerned about how the dependency tracking will actually work in practice. Will it analyze code dependencies automatically or just rely on manual linking?

**UXD**: The dashboard functionality sounds promising, but we need to be careful about information overload. I've seen many tools that provide too much data without actionable insights. I think we should focus on simplifying the visualization while still conveying the critical information.

**PM**: Those are excellent points. I also think we should consider the onboarding experience more carefully. The success of this tool will depend on team adoption, and if it's too complex to set up or learn, teams might resist using it.

## Key Recommendations

1. **Dependency Management Enhancement**
   - Implement both manual and automatic dependency detection
   - Provide visual warnings for circular dependencies
   - Allow different dependency types (blocks, informs, relates to)

2. **Simplified Dashboard**
   - Focus on actionable insights rather than raw data
   - Provide customizable views for different team roles
   - Include time tracking visualizations
`;
    
    // Test processing
    console.log(chalk.blue('Processing the sample discussion...'));
    const insights = await processDiscussion(sampleDiscussion);
    
    // Display results
    console.log(chalk.green('\nExtracted Results:'));
    console.log(chalk.white('\nSummary:'));
    console.log(chalk.white(insights.summary));
    
    console.log(chalk.white('\nKey Insights:'));
    insights.keyInsights.forEach((insight, i) => {
      console.log(chalk.white(`${i+1}. ${insight}`));
    });
    
    console.log(chalk.white('\nChallenges:'));
    insights.challenges.forEach((challenge, i) => {
      console.log(chalk.white(`${i+1}. ${challenge}`));
    });
    
    if (insights.actionItems && insights.actionItems.length > 0) {
      console.log(chalk.white('\nAction Items:'));
      insights.actionItems.forEach((item, i) => {
        console.log(chalk.white(`${i+1}. ${item}`));
      });
    }
    
    console.log(chalk.green('\nTest completed successfully!'));
  } catch (error) {
    console.error(chalk.red(`Error during test: ${error.message}`));
    console.error(error.stack);
  }
}

// Run the test
testExtractInsights(); 