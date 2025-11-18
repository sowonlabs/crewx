import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { TemplateService } from '../services/template.service';

const logger = new Logger('TemplateHandler');

/**
 * Handle template command: crewx template [init|list|show]
 * Download and scaffold project templates from Git repositories
 */
export async function handleTemplate(app: any, args: CliOptions) {
  logger.log('Template command received');

  try {
    const templateService = app.get(TemplateService);
    const subCommand = process.argv[3]; // Get subcommand (init, list, show)

    switch (subCommand) {
      case 'init':
        await handleTemplateInit(templateService, args);
        break;

      case 'list':
        await handleTemplateList(templateService);
        break;

      case 'show':
        await handleTemplateShow(templateService, args);
        break;

      default:
        showTemplateHelp();
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Template command failed:\n${errorMessage}\n`);
    logger.error(`Template command failed: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * Initialize a new project from template
 * Usage: crewx template init <template-name>
 */
async function handleTemplateInit(templateService: TemplateService, args: CliOptions) {
  // Get template name from command line arguments
  const templateName = process.argv[4];

  if (!templateName) {
    console.error('\n❌ Error: Template name is required\n');
    console.log('Usage: crewx template init <template-name>\n');
    console.log('Example:');
    console.log('  mkdir my-project && cd my-project');
    console.log('  crewx template init wbs-automation\n');
    process.exit(1);
  }

  // Show repository information
  const repo =
    process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates';

  console.log(`\n📦 Downloading template: ${templateName}`);
  console.log(`📋 Repository: ${repo}\n`);

  // Download template to current directory
  await templateService.scaffoldProject(templateName, process.cwd());

  console.log(`\n✅ Template initialized successfully!\n`);
  console.log('Next steps:');
  console.log('  1. Review the generated files (especially crewx.yaml)');
  console.log('  2. Configure your agents and settings');
  console.log('  3. Start using your CrewX project\n');

  console.log('Environment variable (optional):');
  console.log('  export CREWX_TEMPLATE_REPO=https://github.com/your-org/your-templates');
  console.log('  # Use this to download templates from your own repository\n');
}

/**
 * List available templates
 * Usage: crewx template list
 */
async function handleTemplateList(templateService: TemplateService) {
  const repo =
    process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates';

  console.log(`\n📦 Template Repository: ${repo}\n`);

  console.log('Available templates:\n');
  console.log('  • wbs-automation     - WBS project automation template');
  console.log('  • docusaurus-admin   - Documentation management template (coming soon)');
  console.log('  • dev-team           - Development team template (coming soon)\n');

  console.log('Usage:');
  console.log('  mkdir my-project && cd my-project');
  console.log('  crewx template init <template-name>\n');

  console.log('To use your own template repository:');
  console.log('  export CREWX_TEMPLATE_REPO=https://github.com/your-org/your-templates\n');
}

/**
 * Show template details
 * Usage: crewx template show <template-name>
 */
async function handleTemplateShow(templateService: TemplateService, args: CliOptions) {
  const templateName = process.argv[4];

  if (!templateName) {
    console.error('\n❌ Error: Template name is required\n');
    console.log('Usage: crewx template show <template-name>\n');
    process.exit(1);
  }

  console.log(`\n📦 Template: ${templateName}\n`);

  // Show template-specific information
  switch (templateName) {
    case 'wbs-automation':
      console.log('Description:');
      console.log('  WBS (Work Breakdown Structure) automation template');
      console.log('  Automatically tracks and manages project tasks\n');

      console.log('Features:');
      console.log('  • Coordinator agent for WBS management');
      console.log('  • Automated task tracking');
      console.log('  • 5-minute loop for continuous monitoring');
      console.log('  • Git integration for progress tracking\n');

      console.log('Files included:');
      console.log('  • crewx.yaml      - Agent configuration');
      console.log('  • wbs.md          - WBS document template');
      console.log('  • wbs-loop.sh     - Automation script');
      console.log('  • README.md       - Setup instructions\n');
      break;

    default:
      console.log(`Template "${templateName}" details not available.`);
      console.log(`Use "crewx template list" to see available templates.\n`);
      break;
  }

  console.log('To initialize:');
  console.log(`  mkdir my-project && cd my-project`);
  console.log(`  crewx template init ${templateName}\n`);
}

/**
 * Show template command help
 */
function showTemplateHelp() {
  console.log(`
📦 CrewX Template Manager

Download and scaffold project templates from Git repositories.

Available commands:
  crewx template init <name>   - Download and initialize a template
  crewx template list           - List available templates
  crewx template show <name>    - Show template details

Templates are downloaded from:
  ${process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates'}

Examples:
  # Initialize a new WBS automation project
  mkdir my-wbs-bot && cd my-wbs-bot
  crewx template init wbs-automation

  # List available templates
  crewx template list

  # Show template details
  crewx template show wbs-automation

Environment variable (optional):
  export CREWX_TEMPLATE_REPO=https://github.com/your-org/your-templates
  # Download templates from your own repository (must be publicly accessible)
  `);
}
