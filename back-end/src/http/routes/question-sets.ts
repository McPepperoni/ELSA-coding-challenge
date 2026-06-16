// AI Generated code <PURPOSE>: expose question set creation REST route
import { Hono } from 'hono'

import { validateQuestionSet } from '@/domain/validation.js'

import { httpError } from '../errors.js'
import type { HttpDependencies } from '../app.js'
import {
  arrayField,
  isRecord,
  numberField,
  optionalNumberField,
  readJsonBody,
  stringField,
} from '../request.js'
import { serializeQuestionSet } from '../serializers.js'

const parseQuestionSetInput = (body: unknown) => {
  const record = isRecord(body) ? body : {}

  return {
    title: stringField(record, 'title'),
    defaultTimeLimitSeconds: numberField(record, 'defaultTimeLimitSeconds'),
    questions: arrayField(record, 'questions').map((rawQuestion) => {
      const question = isRecord(rawQuestion) ? rawQuestion : {}

      return {
        prompt: stringField(question, 'prompt'),
        timeLimitSeconds: optionalNumberField(question, 'timeLimitSeconds'),
        options: arrayField(question, 'options').map((rawOption) => {
          const option = isRecord(rawOption) ? rawOption : {}
          return {
            optionText: stringField(option, 'text'),
            isCorrect: option.isCorrect === true,
          }
        }),
      }
    }),
  }
}

export const createQuestionSetRoutes = (dependencies: HttpDependencies): Hono => {
  const app = new Hono()

  app.post('/', async (c) => {
    const input = parseQuestionSetInput(await readJsonBody(c))
    const validation = validateQuestionSet(input)

    if (!validation.ok) {
      throw httpError(400, validation.reason, validation.message)
    }

    const questionSet = await dependencies.questionSets.createFullQuestionSet(input)
    return c.json({ questionSet: serializeQuestionSet(questionSet) }, 201)
  })

  return app
}
