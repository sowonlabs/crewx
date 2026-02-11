import { Logger } from '@nestjs/common';
import { CliOptions } from '../cli-options';
import { SkillService } from '../services/skill.service';
import { TracingService, SpanKind } from '../services/tracing.service';

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

  // Issue #97: Execute skill command (execute/x)
  if (action === 'execute' || action === 'x') {
    const skillName = args.skillTarget;
    if (!skillName) {
      console.log('Usage: crewx skill execute <name> \'<command>\'');
      process.exit(1);
    }

    // Command should be the first parameter in skillParams
    // e.g. crewx skill execute memory-v2 'node $SKILL_DIR/memory-v2.js'
    // skillParams = ['node $SKILL_DIR/memory-v2.js']
    const command = args.skillParams && args.skillParams.length > 0 ? args.skillParams[0] : undefined;

    if (!command) {
      console.log('Usage: crewx skill execute <name> \'<command>\'');
      console.log('Error: Missing command to execute.');
      process.exit(1);
    }

    // Issue #84: Create span for CLI subprocess tracking
    const taskId = process.env.CREWX_TASK_ID;
    let tracingService: TracingService | null = null;
    let spanId: string | null = null;

    if (taskId) {
      try {
        tracingService = new TracingService();
        tracingService.onModuleInit();

        if (tracingService.isEnabled()) {
          spanId = tracingService.createSpan({
            task_id: taskId,
            name: `skill:exec:${skillName}`,
            kind: SpanKind.INTERNAL,
            input: JSON.stringify({ skill: skillName, command: command }),
            attributes: {
              source: 'cli',
              command: `crewx skill x ${skillName} '${command}'`,
            },
          });

          // Mark that span was created by CLI handler
          if (spanId) {
            process.env.CREWX_SKILL_SPAN_CREATED = 'true';
          }
        }
      } catch (error) {
        logger.warn(`Failed to initialize tracing for skill: ${error}`);
      }
    }

    try {
      const result = await skillService.executeShell(skillName, command);

      // Complete span on success
      if (spanId && tracingService) {
        tracingService.completeSpan(spanId, JSON.stringify({
          code: result.code,
        }));
      }
      process.exit(result.code);
    } catch (error) {
      // Fail span on error
      if (spanId && tracingService) {
        tracingService.failSpan(spanId, String(error));
      }
      logger.error(`Failed to execute skill '${skillName}': ${error}`);
      process.exit(1);
    }
    return;
  }

  // Execute skill
  let skillName: string | undefined;
  let isRunCommand = false;

  if (action === 'run') {
    isRunCommand = true;
    skillName = args.skillTarget;
    if (!skillName) {
      logger.error('Usage: crewx skill run <name> [args...]');
      process.exit(1);
    }
  } else {
    // Deprecated mode: use action as skill name
    skillName = action;
    console.warn(`\x1b[33mWarning: "crewx skill ${skillName}" is deprecated. Please use "crewx skill run ${skillName}" instead.\x1b[0m`);
  }
  
  // Use rawArgs to get accurate arguments including flags like --help
  let skillArgs: string[] = [];
  if (args.rawArgs) {
      const skillIndex = args.rawArgs.indexOf('skill');
      
      if (skillIndex !== -1) {
          if (isRunCommand) {
              // crewx skill run <name> [args]
              // args.rawArgs[skillIndex] == 'skill'
              // args.rawArgs[skillIndex+1] == 'run'
              // args.rawArgs[skillIndex+2] == skillName
              if (args.rawArgs.length > skillIndex + 2 && 
                  args.rawArgs[skillIndex + 1] === 'run' && 
                  args.rawArgs[skillIndex + 2] === skillName) {
                  skillArgs = args.rawArgs.slice(skillIndex + 3);
              }
          } else {
               // crewx skill <name> [args]
               // args.rawArgs[skillIndex] == 'skill'
               // args.rawArgs[skillIndex+1] == skillName
               if (args.rawArgs.length > skillIndex + 1 && 
                   args.rawArgs[skillIndex + 1] === skillName) {
                   skillArgs = args.rawArgs.slice(skillIndex + 2);
               }
          }
      }
  }

  // Fallback to parsed params if rawArgs extraction didn't produce anything
  // Note: This fallback might still miss flags if yargs consumed them, but it's safe default
  if (skillArgs.length === 0) {
      if (isRunCommand) {
        skillArgs = (args.skillParams || []).filter(x => x !== undefined && x !== null) as string[];
      } else {
        const parts = [args.skillTarget, ...(args.skillParams || [])];
        skillArgs = parts.filter(x => x !== undefined && x !== null) as string[];
      }
  }

  // Issue #84: Create span for CLI subprocess tracking
  // When agent runs `crewx skill run <name>`, create span if CREWX_TASK_ID is set
  const taskId = process.env.CREWX_TASK_ID;
  let tracingService: TracingService | null = null;
  let spanId: string | null = null;

  if (taskId) {
    try {
      tracingService = new TracingService();
      tracingService.onModuleInit();

      if (tracingService.isEnabled()) {
        spanId = tracingService.createSpan({
          task_id: taskId,
          name: `skill:${skillName}`,
          kind: SpanKind.INTERNAL,
          input: JSON.stringify({ skill: skillName, args: skillArgs }),
          attributes: {
            source: 'cli',
            command: `crewx skill run ${skillName} ${skillArgs.join(' ')}`.trim(),
          },
        });

        // Mark that span was created by CLI handler to prevent duplicate in skill.service.ts
        if (spanId) {
          process.env.CREWX_SKILL_SPAN_CREATED = 'true';
        }
      }
    } catch (error) {
      logger.warn(`Failed to initialize tracing for skill: ${error}`);
    }
  }

  try {
    const result = await skillService.execute(skillName!, skillArgs);

    // Complete span on success
    if (spanId && tracingService) {
      tracingService.completeSpan(spanId, JSON.stringify({
        code: result.code,
        output_length: result.output?.length || 0,
      }));
    }
  } catch (error) {
    // Fail span on error
    if (spanId && tracingService) {
      tracingService.failSpan(spanId, String(error));
    }
    logger.error(`Failed to execute skill '${skillName}': ${error}`);
    process.exit(1);
  }
}
