import { INestApplicationContext } from '@nestjs/common';
import { HelpService } from '../services/help.service';

export async function handleHelp(app: INestApplicationContext): Promise<void> {
  const helpService = app.get(HelpService);
  helpService.showHelp();
  return new Promise(resolve => setTimeout(resolve, 100));
}
