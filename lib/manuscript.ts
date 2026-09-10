import { z } from 'zod';

export const ManuscriptChapterSchema = z.object({
  outlineCardId: z.string().min(1).max(100),
  content: z.string().max(1500000),
  revisionNotes: z.string().max(200000),
  revision: z.number().int().min(0),
  updatedAt: z.string(),
});

export const ManuscriptListSchema = z.object({
  items: z.array(ManuscriptChapterSchema).max(2000),
});

export type ManuscriptChapter = z.infer<typeof ManuscriptChapterSchema>;

export const manuscriptWordCount = (s: string) => Array.from(s.replace(/\s/g, '')).length;
