import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { SkillService } from '../services/skill.service';

export async function handleSkill(app: any, args: CliOptions) {
  const logger = new Logger('SkillHandler');
  const skillService = app.get(SkillService);

  const action = args.skillAction;

  if (!action || action === 'list' || action === 'ls') {
    // List skills
    const skills = await skillService.discover();
    const registry = skillService.getRegistry();

    if (skills.length === 0) {
      console.log('No skills found.');
      console.log('\nTo add skills:');
      console.log('  crewx skill add npm:<package>     # Install from npm');
      console.log('  crewx skill add template:<name>   # Create from template');
      console.log('\nAvailable templates: ' + skillService.getAvailableTemplates().join(', '));
      return;
    }

    console.log('\nAvailable Skills:\n');
    console.log('| Name | Version | Source | Description |');
    console.log('|------|---------|--------|-------------|');

    for (const skill of skills) {
      // Determine source
      let source = 'custom';
      if (registry.skills[skill.name]) {
        const entry = registry.skills[skill.name];
        source = entry.source === 'npm' ? `npm:${entry.package}` :
                 entry.source === 'template' ? `template:${entry.template}` : entry.source;
      }
      console.log(`| ${skill.name} | ${skill.version} | ${source} | ${skill.description} |`);
    }
    console.log('');
    return;
  }

  if (action === 'info') {
    // Show info
    const skillName = args.skillTarget;
    if (!skillName) {
      logger.error('Please specify a skill name for info command.');
      return;
    }

    const skill = await skillService.getSkill(skillName);
    if (!skill) {
      logger.error(`Skill '${skillName}' not found.`);
      process.exit(1);
    }

    const registry = skillService.getRegistry();
    const regEntry = registry.skills[skillName];

    console.log(`\n${skill.name} (v${skill.version})`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Description: ${skill.description}`);
    console.log(`Entry Point: ${skill.entryPoint}`);
    console.log(`Path: ${skill.path}`);
    if (regEntry) {
      console.log(`Source: ${regEntry.source}${regEntry.package ? `:${regEntry.package}` : regEntry.template ? `:${regEntry.template}` : ''}`);
      console.log(`Installed: ${regEntry.installed}`);
    } else {
      console.log(`Source: custom (skills/ directory)`);
    }
    console.log('');
    return;
  }

  // skill add <source>
  if (action === 'add') {
    const source = args.skillTarget;
    if (!source) {
      console.log('Usage: crewx skill add <source>');
      console.log('');
      console.log('Sources:');
      console.log('  npm:<package>     Install skill from npm package');
      console.log('  template:<name>   Create skill from built-in template');
      console.log('  github:<repo>     (Coming in v0.8.1) Install from GitHub');
      console.log('');
      console.log('Available templates: ' + skillService.getAvailableTemplates().join(', '));
      console.log('');
      console.log('Examples:');
      console.log('  crewx skill add npm:@crewx/memory');
      console.log('  crewx skill add template:hello');
      return;
    }

    const result = await skillService.add(source);
    if (result.success) {
      console.log(`✓ ${result.message}`);
      console.log(`\nRun 'crewx skill list' to see installed skills.`);
    } else {
      console.error(`✗ ${result.message}`);
      process.exit(1);
    }
    return;
  }

  // skill remove <name>
  if (action === 'remove' || action === 'rm') {
    const skillName = args.skillTarget;
    if (!skillName) {
      console.log('Usage: crewx skill remove <name>');
      console.log('');
      console.log('Removes an installed skill from .crewx/skills/');
      console.log('Note: Custom skills in skills/ directory must be removed manually.');
      return;
    }

    const result = await skillService.remove(skillName);
    if (result.success) {
      console.log(`✓ ${result.message}`);
    } else {
      console.error(`✗ ${result.message}`);
      process.exit(1);
    }
    return;
  }

  // skill templates - list available templates
  if (action === 'templates') {
    console.log('\nAvailable Templates:\n');
    console.log('| Name | Description |');
    console.log('|------|-------------|');
    console.log('| hello | Simple greeting demo skill |');
    console.log('| memory | Key-value memory storage skill |');
    console.log('| api | HTTP API client skill |');
    console.log('');
    console.log('Usage: crewx skill add template:<name>');
    return;
  }

  // Execute skill
  const skillName = action;
  
  // Use rawArgs to get accurate arguments including flags like --help
  let skillArgs: string[] = [];
  if (args.rawArgs) {
      const skillIndex = args.rawArgs.indexOf('skill');
      // args.rawArgs[skillIndex] == 'skill'
      // args.rawArgs[skillIndex+1] == skillName
      // args start from skillIndex + 2
      if (skillIndex !== -1 && args.rawArgs.length > skillIndex + 1) {
          // Verify that the next arg is indeed the skill name
          if (args.rawArgs[skillIndex + 1] === skillName) {
              skillArgs = args.rawArgs.slice(skillIndex + 2);
          }
      }
  }

  // Fallback to parsed params if rawArgs extraction didn't produce anything
  // Note: This fallback might still miss flags if yargs consumed them, but it's safe default
  if (skillArgs.length === 0 && (args.skillTarget || (args.skillParams && args.skillParams.length > 0))) {
      skillArgs = [args.skillTarget, ...(args.skillParams || [])].filter(x => x !== undefined && x !== null) as string[];
  }

  try {
    await skillService.execute(skillName, skillArgs);
  } catch (error) {
    logger.error(`Failed to execute skill '${skillName}': ${error}`);
    process.exit(1);
  }
}
