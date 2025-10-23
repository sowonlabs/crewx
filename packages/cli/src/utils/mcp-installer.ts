import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface MCPRegistrationResult {
  claude: { success: boolean; message: string };
  gemini: { success: boolean; message: string };
  copilot: { success: boolean; message: string };
}

/**
 * Register CrewX as MCP server for all available AI CLIs
 */
export async function registerCrewXMCP(): Promise<MCPRegistrationResult> {
  const result: MCPRegistrationResult = {
    claude: { success: false, message: '' },
    gemini: { success: false, message: '' },
    copilot: { success: false, message: '' },
  };

  // Check which CLI tools are available
  const claudeAvailable = await checkCommandAvailable('claude');
  const geminiAvailable = await checkCommandAvailable('gemini');
  const copilotAvailable = await checkCommandAvailable('copilot');

  // Register Claude MCP
  if (claudeAvailable) {
    try {
      result.claude = await registerClaudeMCP();
    } catch (error: any) {
      result.claude = { success: false, message: error.message };
    }
  } else {
    result.claude = { success: false, message: 'Claude CLI not installed' };
  }

  // Register Gemini MCP
  if (geminiAvailable) {
    try {
      result.gemini = await registerGeminiMCP();
    } catch (error: any) {
      result.gemini = { success: false, message: error.message };
    }
  } else {
    result.gemini = { success: false, message: 'Gemini CLI not installed' };
  }

  // Register Copilot MCP (manual JSON file)
  if (copilotAvailable) {
    try {
      result.copilot = await registerCopilotMCP();
    } catch (error: any) {
      result.copilot = { success: false, message: error.message };
    }
  } else {
    result.copilot = { success: false, message: 'Copilot CLI not installed' };
  }

  return result;
}

/**
 * Check if a command is available in PATH
 */
async function checkCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Register CrewX MCP server for Claude CLI
 */
async function registerClaudeMCP(): Promise<{ success: boolean; message: string }> {
  try {
    // Remove existing if any
    try {
      await execAsync('claude mcp remove crewx -s user');
    } catch {
      // Ignore error if not exists
    }

    // Add new registration
    const { stdout, stderr } = await execAsync(
      'claude mcp add -s user crewx crewx mcp'
    );

    if (stderr && !stderr.includes('File modified')) {
      return { success: false, message: stderr };
    }

    return { 
      success: true, 
      message: 'Claude MCP registered successfully. Use: claude "Use crewx_listAgents tool"' 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Register CrewX MCP server for Gemini CLI
 */
async function registerGeminiMCP(): Promise<{ success: boolean; message: string }> {
  try {
    // Remove existing if any
    try {
      await execAsync('gemini mcp remove crewx');
    } catch {
      // Ignore error if not exists
    }

    // Add new registration
    const { stdout, stderr } = await execAsync(
      'gemini mcp add -s user --trust crewx crewx mcp'
    );

    if (stderr && stderr.includes('error')) {
      return { success: false, message: stderr };
    }

    return { 
      success: true, 
      message: 'Gemini MCP registered successfully. Use: gemini -p "Use crewx_listAgents" --allowed-mcp-server-names=crewx --yolo' 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Register CrewX MCP server for Copilot CLI (manual JSON)
 */
async function registerCopilotMCP(): Promise<{ success: boolean; message: string }> {
  try {
    const homeDir = os.homedir();
    const copilotConfigDir = path.join(homeDir, '.config', 'github-copilot');
    const copilotConfigPath = path.join(copilotConfigDir, 'mcp-servers.json');

    // Create directory if not exists
    if (!fs.existsSync(copilotConfigDir)) {
      fs.mkdirSync(copilotConfigDir, { recursive: true });
    }

    // Read existing config or create new
    let config: any = { mcpServers: {} };
    if (fs.existsSync(copilotConfigPath)) {
      const content = fs.readFileSync(copilotConfigPath, 'utf-8');
      config = JSON.parse(content);
    }

    // Add CrewX MCP server
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.crewx = {
      command: 'crewx',
      args: ['mcp']
    };

    // Write config
    fs.writeFileSync(copilotConfigPath, JSON.stringify(config, null, 2));

    return { 
      success: true, 
      message: 'Copilot MCP config updated. Note: MCP tools may not work in CLI mode (VS Code only)' 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Check MCP registration status for all AI CLIs
 */
export async function checkMCPRegistration(): Promise<{
  claude: boolean;
  gemini: boolean;
  copilot: boolean;
}> {
  const result = {
    claude: false,
    gemini: false,
    copilot: false,
  };

  // Check Claude MCP
  try {
    const homeDir = os.homedir();
    const claudeConfigPath = path.join(homeDir, '.claude.json');
    if (fs.existsSync(claudeConfigPath)) {
      const content = fs.readFileSync(claudeConfigPath, 'utf-8');
      result.claude = content.includes('"crewx"');
    }
  } catch {
    // Ignore error
  }

  // Check Gemini MCP
  try {
    const { stdout } = await execAsync('gemini mcp list');
    result.gemini = stdout.includes('crewx');
  } catch {
    // Ignore error
  }

  // Check Copilot MCP
  try {
    const homeDir = os.homedir();
    const copilotConfigPath = path.join(homeDir, '.config', 'github-copilot', 'mcp-servers.json');
    if (fs.existsSync(copilotConfigPath)) {
      const content = fs.readFileSync(copilotConfigPath, 'utf-8');
      result.copilot = content.includes('"crewx"');
    }
  } catch {
    // Ignore error
  }

  return result;
}
