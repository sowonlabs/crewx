import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { TemplateService } from '../services/template.service';

const logger = new Logger('TemplatesHandler');

/**
 * Handle templates command: crewcode templates [list|update]
 * Manage agent templates from GitHub
 */
export async function handleTemplates(app: any, args: CliOptions) {
  logger.log('Templates command received');

  try {
    const templateService = app.get(TemplateService);
    const subCommand = process.argv[3]; // Get subcommand (list, update)

    switch (subCommand) {
      case 'list':
        await handleTemplatesList(templateService);
        break;
      
      case 'update':
        await handleTemplatesUpdate(templateService);
        break;
      
      default:
        console.log(`
📦 **CodeCrew Template Manager**

Available commands:
  crewcode templates list    - List available templates from GitHub
  crewcode templates update  - Clear cache and re-download templates

Templates are downloaded from:
  https://github.com/sowonlabs/crewx/tree/main/templates

Examples:
  # List available templates
  crewcode templates list
  
  # Update template cache
  crewcode templates update
  
  # Use a specific template during init
  crewcode init --template minimal
  crewcode init --template development --version v0.1.8
        `);
        break;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Templates command failed: ${errorMessage}`);
    logger.error(`Templates command failed: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * List available templates
 */
async function handleTemplatesList(templateService: TemplateService) {
  console.log('📦 Fetching available templates...\n');

  try {
    // Get versions info
    const versions = await templateService.getVersions();
    
    if (!versions) {
      console.log('⚠️  Could not fetch template information from GitHub.');
      console.log('Using local templates only.\n');
      console.log('Available templates:');
      console.log('  • default    - Full setup with @crewcode assistant');
      console.log('  • minimal    - Basic agents only (claude, gemini, copilot)');
      return;
    }

    console.log('✅ **Available Templates**\n');
    console.log(`Latest version: ${versions.latest}\n`);

    // List templates for each version
    for (const [versionTag, versionInfo] of Object.entries(versions.versions)) {
      console.log(`📌 **${versionTag}** (${versionInfo.released})`);
      if (versionInfo.description) {
        console.log(`   ${versionInfo.description}`);
      }
      if (versionInfo.minCodeCrewVersion) {
        console.log(`   Requires: CodeCrew >= ${versionInfo.minCodeCrewVersion}`);
      }
      console.log(`   Templates: ${versionInfo.templates.join(', ')}`);
      console.log('');
    }

    console.log('**Usage:**');
    console.log('  crewcode init --template <name> --version <version>');
    console.log('  crewcode init --template minimal  # Use latest version');
    console.log('  crewcode init --template default --version v0.1.8\n');

  } catch (error: any) {
    console.error(`❌ Failed to list templates: ${error?.message || error}`);
    console.log('\n⚠️  Using local templates as fallback:');
    console.log('  • default    - Full setup with @crewcode assistant');
    console.log('  • minimal    - Basic agents only (claude, gemini, copilot)\n');
  }
}

/**
 * Update template cache
 */
async function handleTemplatesUpdate(templateService: TemplateService) {
  console.log('🔄 Clearing template cache...\n');

  try {
    await templateService.clearCache();
    console.log('✅ Template cache cleared successfully!');
    console.log('\nNext time you run `crewcode init`, templates will be freshly downloaded from GitHub.\n');
  } catch (error: any) {
    console.error(`❌ Failed to clear cache: ${error?.message || error}`);
    process.exit(1);
  }
}
