import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiKnowledgeService {
    private readonly logger = new Logger(AiKnowledgeService.name);
    private knowledgeBase: string = "";

    constructor() {
        this.loadKnowledgeBase();
    }

    private loadKnowledgeBase() {
        try {
            const kbPath = path.join(__dirname, '..', '..', 'src', 'ai', 'knowledge');
            if (fs.existsSync(kbPath)) {
                const files = fs.readdirSync(kbPath);
                let combinedText = "";
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const content = fs.readFileSync(path.join(kbPath, file), 'utf-8');
                        const data = JSON.parse(content);
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                combinedText += `- ${item.topic}: ${item.content}\n`;
                            });
                        }
                    }
                }
                this.knowledgeBase = combinedText;
                this.logger.log(`Knowledge base loaded: ${files.length} files`);
            }
        } catch (error) {
            this.logger.error('Failed to load knowledge base', error);
        }
    }

    getKnowledgeContext(): string {
        return this.knowledgeBase ? `\nKNOWLEDGE BASE (Thông tin công ty):\n${this.knowledgeBase}\n` : '';
    }
}
