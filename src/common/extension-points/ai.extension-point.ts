export const AI_ASSISTANT_SERVICE = 'AI_ASSISTANT_SERVICE';

export interface AiAssistantBridge {
  parseJDCompetencies(description: string): Promise<any>;
  evaluateAssessment(prompt: string): Promise<any>;
  generateRecruitmentQuestions(jobDescription: string, cvUrl?: string): Promise<any>;
}
