import { z } from 'zod'

const bilingualText = z.object({
  de: z.string(),
  en: z.string(),
})

export type BilingualText = z.infer<typeof bilingualText>

const pickOptionSchema = z.object({
  id: z.string(),
  text: bilingualText,
  correct: z.boolean(),
})

export type PickOption = z.infer<typeof pickOptionSchema>

const categorySchema = z.object({
  label: z.string(),
  text: bilingualText,
})

export type Category = z.infer<typeof categorySchema>

const statementSchema = z.object({
  id: z.string(),
  text: bilingualText,
  correctCategory: z.string(),
})

export type Statement = z.infer<typeof statementSchema>

const pickQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('pick'),
  points: z.number().positive(),
  stem: bilingualText,
  options: z.array(pickOptionSchema).min(2),
  explanation: bilingualText.optional(),
  lgs: z.array(z.string()).optional(),
})

export type PickQuestion = z.infer<typeof pickQuestionSchema>

const categoryQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('category'),
  points: z.number().positive(),
  stem: bilingualText,
  categories: z.array(categorySchema).min(2),
  statements: z.array(statementSchema).min(1),
  explanation: bilingualText.optional(),
  lgs: z.array(z.string()).optional(),
})

export type CategoryQuestion = z.infer<typeof categoryQuestionSchema>

export const questionSchema = z.discriminatedUnion('type', [
  pickQuestionSchema,
  categoryQuestionSchema,
])

export type Question = z.infer<typeof questionSchema>

export const questionsArraySchema = z.array(questionSchema)

export function validateQuestions(data: unknown) {
  return questionsArraySchema.safeParse(data)
}
