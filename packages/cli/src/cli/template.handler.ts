import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { TemplateListItem, TemplateService } from '../services/template.service';

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
 * Usage: crewx template init <template-name> [--force]
 */
async function handleTemplateInit(templateService: TemplateService, args: CliOptions) {
  // Get template name from command line arguments
  const templateName = process.argv[4];

  if (!templateName) {
    console.error('\n❌ Error: Template name is required\n');
    console.log('Usage: crewx template init <template-name> [--force]\n');
    console.log('Options:');
    console.log('  --force    Overwrite existing files\n');
    console.log('Example:');
    console.log('  mkdir my-project && cd my-project');
    console.log('  crewx template init wbs-automation\n');
    process.exit(1);
  }

  // Check for --force flag
  const force = process.argv.includes('--force');

  // Show repository information
  const repo =
    process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates';

  console.log(`\n📦 Downloading template: ${templateName}`);
  console.log(`📋 Repository: ${repo}`);
  if (force) {
    console.log(`⚠️  Force mode: Existing files will be overwritten`);
  }
  console.log('');

  // Download template to current directory
  const result = await templateService.scaffoldProject(templateName, process.cwd(), force);

  // Display summary
  console.log(`\n📊 Summary:`);
  if (result.created > 0) {
    console.log(`  Created: ${result.created} file${result.created > 1 ? 's' : ''}`);
  }
  if (result.skipped > 0) {
    console.log(`  Skipped: ${result.skipped} file${result.skipped > 1 ? 's' : ''}`);
  }

  if (result.skipped > 0 && !force) {
    console.log(`\nℹ️  Some files were skipped. Use --force to overwrite existing files.`);
  }

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

  const templates = await templateService.fetchTemplateList();

  if (!templates.length) {
    console.log('⚠️ No templates found in templates.json or the repository is unreachable.');
    console.log('Add entries to templates.json or check your CREWX_TEMPLATE_REPO setting.\n');
  } else {
    const grouped = new Map<string, TemplateListItem[]>();
    for (const template of templates) {
      const category = template.category || 'General';
      const list = grouped.get(category) || [];
      list.push(template);
      grouped.set(category, list);
    }

    const longestName = templates.reduce(
      (max, template) => Math.max(max, (template.id || template.name || '').length),
      0
    );
    const nameWidth = Math.max(longestName, 18);

    console.log('Available templates:\n');
    for (const category of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
      console.log(`${category}:`);
      const entries = grouped.get(category) || [];
      entries
        .sort((a, b) => (a.id || a.name || '').localeCompare(b.id || b.name || ''))
        .forEach((template) => {
          const name = (template.id || template.name || '').padEnd(nameWidth, ' ');
          const description = template.description || 'No description provided';
          console.log(`  • ${name} - ${description}`);
        });
      console.log('');
    }
  }

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

  const templates = await templateService.fetchTemplateList();
  const normalized = templateName.toLowerCase();
  const template = templates.find((entry) => (entry.id || entry.name || '').toLowerCase() === normalized);

  if (!template) {
    console.log(`\n⚠️ Template "${templateName}" not found in templates.json.`);
    console.log('Use "crewx template list" to see available templates.\n');
    return;
  }

  const repo = template.repo || process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates';
  console.log(`\n📦 Template: ${template.displayName || template.id || template.name}`);
  console.log(`ID: ${template.id || template.name}`);
  console.log(`Repository: ${repo}`);
  if (template.category) {
    console.log(`Category: ${template.category}`);
  }
  if (template.tags?.length) {
    console.log(`Tags: ${template.tags.join(', ')}`);
  }
  console.log('');

  if (template.description) {
    console.log('Description:');
    console.log(`  ${template.description}\n`);
  }

  if (template.readme) {
    console.log('Documentation:');
    console.log(`  ${template.readme}\n`);
  }

  console.log('To initialize:');
  console.log(`  mkdir my-project && cd my-project`);
  console.log(`  crewx template init ${template.id || template.name}\n`);
}

/**
 * Show template command help
 */
function showTemplateHelp() {
  console.log(`
📦 CrewX Template Manager

Download and scaffold project templates from Git repositories.

Available commands:
  crewx template init <name> [--force]   - Download and initialize a template
  crewx template list                     - List available templates
  crewx template show <name>              - Show template details

Options:
  --force    Overwrite existing files (default: skip existing files)

Templates are downloaded from:
  ${process.env.CREWX_TEMPLATE_REPO || 'https://github.com/sowonlabs/crewx-templates'}

Examples:
  # Initialize a new WBS automation project
  mkdir my-wbs-bot && cd my-wbs-bot
  crewx template init wbs-automation

  # Overwrite existing files
  crewx template init wbs-automation --force

  # List available templates
  crewx template list

  # Show template details
  crewx template show wbs-automation

Environment variable (optional):
  export CREWX_TEMPLATE_REPO=https://github.com/your-org/your-templates
  # Download templates from your own repository (must be publicly accessible)
  `);
}
