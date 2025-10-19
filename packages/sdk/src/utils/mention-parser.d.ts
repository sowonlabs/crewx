export interface MentionTask {
    agents: string[];
    task: string;
    type: 'shared' | 'individual';
    models?: Map<string, string>;
}
export interface ParsedMentions {
    tasks: MentionTask[];
    unmatchedText: string[];
    errors: string[];
}
export declare class MentionParser {
    private readonly agentPattern;
    private readonly validAgents;
    constructor(validAgents: string[]);
    parse(text: string): ParsedMentions;
}
export declare function loadAvailableAgents(configPath?: string): Promise<string[]>;
