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
    if (skills.length === 0) {
      console.log('No skills found in skills/ directory.');
      return;
    }

    console.log('\nAvailable Skills:\n');
    console.log('| Name | Version | Description |');
    console.log('|------|---------|-------------|');

    for (const skill of skills) {
      console.log(`| ${skill.name} | ${skill.version} | ${skill.description} |`);
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

    console.log(`\n${skill.name} (v${skill.version})`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Description: ${skill.description}`);
    console.log(`Entry Point: ${skill.entryPoint}`);
    console.log(`Path: ${skill.path}`);
    console.log('');
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
